const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. OBTENER CITAS (Para pintar la agenda y validar horarios)
const getAppointments = async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: { service: true }, // Traemos info del servicio (nombre, precio)
      orderBy: { fechaInicio: 'desc' }
    });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener citas' });
  }
};

// 2. CREAR CITA (Calculando Fecha Fin Automáticamente)
const createAppointment = async (req, res) => {
  try {
    const { clientName, clientDni, clientPhone, dateISO, serviceId } = req.body;

    // Buscamos cuánto dura el servicio para calcular la hora de salida
    const service = await prisma.service.findUnique({ where: { id: parseInt(serviceId) } });
    if (!service) return res.status(400).json({ error: 'Servicio no encontrado' });

    const fechaInicio = new Date(dateISO);
    // Calculamos fecha fin: Inicio + Duración del servicio (en minutos)
    const fechaFin = new Date(fechaInicio.getTime() + service.duracion * 60000);

    const newAppointment = await prisma.appointment.create({
      data: {
        clienteNombre: clientName,
        clienteDni: clientDni,
        clientePhone: clientPhone,
        fechaInicio: fechaInicio,
        fechaFin: fechaFin, // ¡AQUÍ ESTABA EL ERROR ANTES!
        serviceId: parseInt(serviceId),
        estado: "PENDIENTE" // Por defecto String
      }
    });

    res.json(newAppointment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la cita' });
  }
};

// 3. ACTUALIZAR ESTADO (Para Cobrar o Reprogramar)
const updateAppointment = async (req, res) => {
  const { id } = req.params;
  const { estado, newDateISO } = req.body; // Recibimos estado ("COMPLETADO") o nueva fecha

  try {
    let dataToUpdate = {};

    if (estado) dataToUpdate.estado = estado;
    
    // Si estamos reprogramando, hay que recalcular la fecha fin
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
    res.status(500).json({ error: 'Error al actualizar la cita' });
  }
};

// 4. CANCELAR CITA
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

// 5. BUSCAR POR DNI (Para el cliente)
const getAppointmentsByDni = async (req, res) => {
    const { dni } = req.params;
    try {
        const appts = await prisma.appointment.findMany({
            where: { clienteDni: dni },
            include: { service: true },
            orderBy: { fechaInicio: 'desc' }
        });
        res.json(appts);
    } catch (error) {
        res.status(500).json({ error: 'Error buscando dni' });
    }
};

module.exports = { getAppointments, createAppointment, updateAppointment, cancelAppointment, getAppointmentsByDni };