// server/controllers/appointmentController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper para duración
const getDuration = (serviceId) => {
  const id = parseInt(serviceId);
  if (id === 1) return 30;
  if (id === 2) return 50;
  if (id === 3) return 90;
  return 30;
};

// --- NUEVA FUNCIÓN: Verificar Disponibilidad ---
// Devuelve TRUE si hay un cruce, FALSE si está libre
const checkOverlap = async (newStart, newEnd, excludeAppointmentId = null) => {
    // Lógica de cruce de horarios:
    // Una cita existente se cruza si:
    // (Su inicio es ANTES de mi nuevo fin) Y (Su fin es DESPUÉS de mi nuevo inicio)
    const whereClause = {
        AND: [
          { fechaInicio: { lt: newEnd } }, // Existing start < New end
          { fechaFin: { gt: newStart } },  // Existing end > New start
        ],
        // Opcional: Si tuvieras estado 'CANCELADO', añadirías:
        // estado: { not: 'CANCELADO' }
    };

    // Si estamos reprogramando, excluimos la cita actual para que no choque consigo misma
    if (excludeAppointmentId) {
        whereClause.id = { not: parseInt(excludeAppointmentId) };
    }

    const overlappingCount = await prisma.appointment.count({
        where: whereClause
    });

    return overlappingCount > 0; // Si es mayor a 0, hay cruce
};


// 1. Crear Cita (Con validación)
const createAppointment = async (req, res) => {
  try {
    const { clientName, clientDni, clientPhone, serviceId, dateISO } = req.body;

    // Validaciones básicas
    if(!dateISO || !serviceId) return res.status(400).json({error: "Faltan datos"});

    // Calcular fechas
    const inicio = new Date(dateISO);
    const duracion = getDuration(serviceId);
    const fin = new Date(inicio.getTime() + duracion * 60000);

    // VALIDACIÓN DE CRUCE: Verificar si ya está ocupado
    const isBusy = await checkOverlap(inicio, fin);
    if (isBusy) {
        // Retornamos error 409 (Conflict) y un mensaje claro
        return res.status(409).json({ 
            error: '¡Lo sentimos! Ese horario ya está reservado. Por favor, elige otra hora.' 
        });
    }

    // Si está libre, procedemos a crear
    const newAppointment = await prisma.appointment.create({
      data: {
        clienteNombre: clientName,
        clienteDni: clientDni,
        clientePhone: clientPhone,
        serviceId: parseInt(serviceId),
        fechaInicio: inicio,
        fechaFin: fin,
        estado: "PENDIENTE"
      },
    });
    res.status(201).json(newAppointment);
  } catch (error) {
    console.error("Error al crear:", error);
    res.status(500).json({ error: 'Error interno del servidor al crear la cita' });
  }
};

// 2. Buscar Citas por DNI (Igual que antes)
const getAppointmentsByDni = async (req, res) => {
  try {
    const { dni } = req.params;
    const appointments = await prisma.appointment.findMany({
      where: { clienteDni: dni },
      orderBy: { fechaInicio: 'desc' }
    });
    res.json(appointments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al buscar citas' });
  }
};

// 3. Reprogramar Cita (Con validación)
const rescheduleAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDateISO } = req.body;

    if(!newDateISO) return res.status(400).json({error: "Falta la nueva fecha"});

    // 1. Buscar la cita actual para saber qué servicio es
    const currentAppt = await prisma.appointment.findUnique({
      where: { id: parseInt(id) }
    });
    if (!currentAppt) return res.status(404).json({ error: 'Cita no encontrada' });

    // 2. Calcular nuevos horarios
    const inicio = new Date(newDateISO);
    const duracion = getDuration(currentAppt.serviceId);
    const fin = new Date(inicio.getTime() + duracion * 60000);

    // 3. VALIDACIÓN DE CRUCE: Verificar si el nuevo horario está ocupado
    // (Pasamos el 'id' actual para excluirlo de la búsqueda)
    const isBusy = await checkOverlap(inicio, fin, id);
    if (isBusy) {
        return res.status(409).json({ 
            error: 'No se puede reprogramar: El nuevo horario seleccionado ya está ocupado.' 
        });
    }

    // 4. Si está libre, actualizamos
    const updatedAppointment = await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: { 
        fechaInicio: inicio,
        fechaFin: fin
      }
    });
    res.json(updatedAppointment);
  } catch (error) {
    console.error("Error al reprogramar:", error);
    res.status(500).json({ error: 'Error interno al reprogramar' });
  }
};
// 4. Cancelar Cita (Cambia estado a CANCELADO)
const cancelAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await prisma.appointment.update({
            where: { id: parseInt(id) },
            data: { estado: 'CANCELADO' }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error al cancelar la cita' });
    }
};

// 5. Obtener TODAS las citas (Para el Admin)
const getAllAppointments = async (req, res) => {
    try {
        const appts = await prisma.appointment.findMany({
            include: { service: true }, // Incluir detalles del servicio
            orderBy: { fechaInicio: 'desc' }
        });
        res.json(appts);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener citas' });
    }
};

module.exports = { 
    createAppointment, 
    getAppointmentsByDni, 
    rescheduleAppointment, 
    cancelAppointment, 
    getAllAppointments 
};