const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Función auxiliar para verificar disponibilidad del barbero
const checkBarberAvailability = async (barberId, start, end, excludeApptId = null) => {
    const overlapping = await prisma.appointment.findFirst({
        where: {
            barberId: parseInt(barberId),
            estado: { not: 'CANCELADO' }, // Ignorar canceladas
            id: excludeApptId ? { not: parseInt(excludeApptId) } : undefined, // Ignorar la misma cita al editar
            OR: [
                // La nueva cita empieza dentro de otra existente
                { AND: [{ fechaInicio: { lte: start } }, { fechaFin: { gt: start } }] },
                // La nueva cita termina dentro de otra existente
                { AND: [{ fechaInicio: { lt: end } }, { fechaFin: { gte: end } }] }
            ]
        }
    });
    return !overlapping; // Retorna true si está libre
};

// 1. OBTENER TODAS
const getAppointments = async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: { service: true, barber: true },
      orderBy: { fechaInicio: 'desc' }
    });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener citas' });
  }
};

// 2. CREAR CITA (Con validación de Barbero)
const createAppointment = async (req, res) => {
  try {
    const { clientName, clientDni, clientPhone, dateISO, serviceId, barberId } = req.body;

    if (!serviceId || !barberId) return res.status(400).json({ error: 'Falta servicio o barbero' });

    // Obtener servicio para saber duración
    const service = await prisma.service.findUnique({ where: { id: parseInt(serviceId) } });
    if (!service) return res.status(400).json({ error: 'Servicio no encontrado' });

    const fechaInicio = new Date(dateISO);
    const fechaFin = new Date(fechaInicio.getTime() + (service.duracion || 30) * 60000);

    // VERIFICAR DISPONIBILIDAD DEL BARBERO
    const isAvailable = await checkBarberAvailability(barberId, fechaInicio, fechaFin);
    if (!isAvailable) {
        return res.status(400).json({ error: 'El barbero ya tiene una cita en ese horario.' });
    }

    const newAppointment = await prisma.appointment.create({
      data: {
        clienteNombre: clientName,
        clienteDni: clientDni,
        clientePhone: clientPhone,
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        estado: "PENDIENTE",
        // USAMOS CONNECT PARA EVITAR EL ERROR "Service is missing"
        service: { connect: { id: parseInt(serviceId) } },
        barber: { connect: { id: parseInt(barberId) } }
      }
    });

    res.json(newAppointment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear cita' });
  }
};

// 3. ACTUALIZAR (Reprogramar validando Barbero)
const updateAppointment = async (req, res) => {
  const { id } = req.params;
  const { estado, newDateISO } = req.body;

  try {
    const apptId = parseInt(id);
    let dataToUpdate = {};
    
    if (estado) dataToUpdate.estado = estado;
    
    // SI SE CAMBIA LA FECHA, VALIDAR DISPONIBILIDAD DEL BARBERO
    if (newDateISO) {
        // Obtenemos la cita actual para saber duración y barbero
        const currentAppt = await prisma.appointment.findUnique({ 
            where: { id: apptId }, 
            include: { service: true } 
        });

        if (!currentAppt) return res.status(404).json({ error: 'Cita no encontrada' });

        const fechaInicio = new Date(newDateISO);
        const fechaFin = new Date(fechaInicio.getTime() + (currentAppt.service.duracion || 30) * 60000);

        // Validamos si el barbero de esa cita está libre en la nueva hora
        const isAvailable = await checkBarberAvailability(currentAppt.barberId, fechaInicio, fechaFin, apptId);
        
        if (!isAvailable) {
            return res.status(400).json({ error: 'El barbero no está disponible en ese nuevo horario.' });
        }

        dataToUpdate.fechaInicio = fechaInicio;
        dataToUpdate.fechaFin = fechaFin;
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: apptId },
      data: dataToUpdate,
      include: { service: true, barber: true }
    });

    res.json(updatedAppointment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
};

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

const getAppointmentsByDni = async (req, res) => {
    const { dni } = req.params;
    try {
        const appts = await prisma.appointment.findMany({
            where: { clienteDni: dni },
            include: { service: true, barber: true },
            orderBy: { fechaInicio: 'desc' }
        });
        res.json(appts);
    } catch (error) {
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