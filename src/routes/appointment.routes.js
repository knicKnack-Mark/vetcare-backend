const express = require('express');
const router = express.Router();
const {
  getAppointments, getTodayAppointments, getUpcomingAppointments, getCalendarAppointments, getSummary,
  getAppointmentById, createAppointment, updateAppointment, updateStatus,
  cancelAppointment, rescheduleAppointment, completeAppointment, markNoShow,
} = require('../controllers/appointment.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

router.use(authenticateUser);

// Fixed routes BEFORE /:id
router.get('/summary', getSummary);
router.get('/today', getTodayAppointments);
router.get('/upcoming', getUpcomingAppointments);
router.get('/calendar', getCalendarAppointments);

router.get('/', getAppointments);
router.post('/', requireRole('ADMIN', 'RECEPTIONIST', 'VETERINARIAN'), createAppointment);

router.get('/:id', getAppointmentById);
router.put('/:id', requireRole('ADMIN', 'RECEPTIONIST', 'VETERINARIAN'), updateAppointment);
router.patch('/:id/status', requireRole('ADMIN', 'RECEPTIONIST', 'VETERINARIAN'), updateStatus);
router.post('/:id/cancel', requireRole('ADMIN', 'RECEPTIONIST', 'VETERINARIAN'), cancelAppointment);
router.post('/:id/reschedule', requireRole('ADMIN', 'RECEPTIONIST', 'VETERINARIAN'), rescheduleAppointment);
router.post('/:id/complete', requireRole('ADMIN', 'RECEPTIONIST', 'VETERINARIAN'), completeAppointment);
router.post('/:id/no-show', requireRole('ADMIN', 'RECEPTIONIST', 'VETERINARIAN'), markNoShow);

module.exports = router;