const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. OBTENER TODAS LAS CITAS
const getAppointments = async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: { service: true },
      orderBy: { fechaInicio: 'desc' }
    });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener citas' });
  }
};

// 2. CREAR CITA
const createAppointment = async (req, res) => {
  try {
    const { clientName, clientDni, clientPhone, dateISO, serviceId } = req.body;

    const service = await prisma.service.findUnique({ where: { id: parseInt(serviceId) } });
    if (!service) return res.status(400).json({ error: 'Servicio no encontrado' });

    const fechaInicio = new Date(dateISO);
    const fechaFin = new Date(fechaInicio.getTime() + service.duracion * 60000);

    const newAppointment = await prisma.appointment.create({
      data: {
        clienteNombre: clientName,
        clienteDni: clientDni,
        clientePhone: clientPhone,
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        serviceId: parseInt(serviceId),
        estado: "PENDIENTE"
      }
    });

    res.json(newAppointment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la cita' });
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
        const fechaFin = new Date(fechaInicio.getTime() + appt.service.duracion * 60000);
        dataToUpdate.fechaInicio = fechaInicio;
        dataToUpdate.fechaFin = fechaFin;
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
    });

    res.json(updatedAppointment);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
};

// 4. CANCELAR (Ruta específica)
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

// 5. BUSCAR POR DNI (Esta es la nueva que seguro faltaba en rutas)
const getAppointmentsByDni = async (req, res) => {
    const { dni } = req.params;
    try {
        // Busca citas donde el clienteDni coincida
        // OJO: Si tu base de datos usa otro nombre, ajusta aquí.
        const appts = await prisma.appointment.findMany({
            where: { clienteDni: dni },
            include: { service: true },
            orderBy: { fechaInicio: 'desc' }
        });
        res.json(appts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error buscando por DNI' });
    }
};

// IMPORTANTE: Asegúrate de que todas están aquí dentro de las llaves
module.exports = { 
    getAppointments, 
    createAppointment, 
    updateAppointment, 
    cancelAppointment, 
    getAppointmentsByDni 
};