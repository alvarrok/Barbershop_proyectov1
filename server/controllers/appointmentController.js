const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. OBTENER TODAS LAS CITAS (Incluyendo Barbero)
const getAppointments = async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: { 
        service: true,
        barber: true // <--- AGREGADO: Para ver el nombre del barbero en la tabla
      },
      orderBy: { fechaInicio: 'desc' }
    });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener citas' });
  }
};

// 2. CREAR CITA (CORREGIDO PARA RELACIONES)
const createAppointment = async (req, res) => {
  try {
    // 1. Recibimos barberId del frontend
    const { clientName, clientDni, clientPhone, dateISO, serviceId, barberId } = req.body;

    // 2. Validación estricta
    if (!serviceId || !barberId) {
        return res.status(400).json({ error: 'Faltan datos obligatorios (Servicio o Barbero)' });
    }

    // 3. Obtener duración del servicio para calcular hora fin
    const service = await prisma.service.findUnique({ where: { id: parseInt(serviceId) } });
    if (!service) return res.status(400).json({ error: 'Servicio no encontrado' });

    const fechaInicio = new Date(dateISO);
    const fechaFin = new Date(fechaInicio.getTime() + (service.duracion || 30) * 60000); // 30 min por defecto si falla

    // 4. Crear la cita usando "connect" para las relaciones
    const newAppointment = await prisma.appointment.create({
      data: {
        clienteNombre: clientName,
        clienteDni: clientDni,
        clientePhone: clientPhone,
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        estado: "PENDIENTE",
        // USAMOS CONNECT PARA EVITAR ERRORES DE RELACIÓN
        service: { connect: { id: parseInt(serviceId) } },
        barber: { connect: { id: parseInt(barberId) } }
      }
    });

    res.json(newAppointment);
  } catch (error) {
    console.error("Error creando cita:", error);
    // Devolvemos el detalle del error para que sepas qué pasó en los logs de Render
    res.status(500).json({ error: 'Error al crear la cita', details: error.message });
  }
};

// 3. ACTUALIZAR (Reprogramar o Completar)
const updateAppointment = async (req, res) => {
  const { id } = req.params;
  const { estado, newDateISO } = req.body;

  try {
    let dataToUpdate = {};
    if (estado) dataToUpdate.estado = estado;
    
    if (newDateISO) {
        const appt = await prisma.appointment.findUnique({ where: { id: parseInt(id) }, include: { service: true }});
        const fechaInicio = new Date(newDateISO);
        const fechaFin = new Date(fechaInicio.getTime() + (appt.service.duracion || 30) * 60000);
        dataToUpdate.fechaInicio = fechaInicio;
        dataToUpdate.fechaFin = fechaFin;
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
      include: { service: true, barber: true } // Devolvemos datos completos
    });

    res.json(updatedAppointment);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
};

// 4. CANCELAR
const cancelAppointment = async (req, res) => {
    const { id } = req.params;
    try {
        const cancelled = await prisma.appointment.update({
            where: { id: parseInt(id) },
            data: { estado: "CANCELADO" }
        });
        res.json(cancelled);
    } catch (error) {
        res.status(500).json({ error: 'Error al cancelar' });
    }
};

// 5. BUSCAR POR DNI (Para "Mis Citas")
const getAppointmentsByDni = async (req, res) => {
    const { dni } = req.params;
    try {
        const appts = await prisma.appointment.findMany({
            where: { clienteDni: dni },
            include: { 
                service: true,
                barber: true // <--- AGREGADO: El cliente quiere ver con quién reservó
            },
            orderBy: { fechaInicio: 'desc' }
        });
        res.json(appts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error buscando por DNI' });
    }
};

module.exports = { 
    getAppointments, 
    createAppointment, 
    updateAppointment, 
    cancelAppointment, 
    getAppointmentsByDni 
};