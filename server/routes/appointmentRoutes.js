const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

// Verificar que el controlador se cargó bien (Debugging)
if (!appointmentController) {
    console.error("ERROR CRÍTICO: No se pudo cargar appointmentController");
}

// 1. Obtener todas las citas
router.get('/', appointmentController.getAppointments);

// 2. Crear nueva cita
router.post('/', appointmentController.createAppointment);

// 3. Buscar por DNI (Esta ruta es nueva y la usa el buscador del Home)
// Es importante ponerla ANTES de las rutas con :id para evitar conflictos
router.get('/dni/:dni', appointmentController.getAppointmentsByDni);

// 4. Actualizar cita (Reprogramar o Completar)
router.put('/:id', appointmentController.updateAppointment);

// 5. Cancelar cita
router.put('/:id/cancel', appointmentController.cancelAppointment);

module.exports = router;