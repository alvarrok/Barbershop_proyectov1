// server/routes/appointmentRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/appointmentController');

router.post('/', controller.createAppointment);
router.get('/', controller.getAllAppointments); // NUEVO: Para el admin (ver todo)
router.get('/:dni', controller.getAppointmentsByDni);
router.put('/:id', controller.rescheduleAppointment);
router.put('/:id/cancel', controller.cancelAppointment); // NUEVO: Cancelar

module.exports = router;