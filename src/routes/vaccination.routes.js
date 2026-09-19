const express = require('express');
const router = express.Router();
const {
  getVaccinations, getSummary, getUpcoming, getOverdue, getToday, getById,
  createVaccination, updateVaccination, patchVaccination, voidVaccination,
} = require('../controllers/vaccination.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

router.use(authenticateUser);

router.get('/summary', getSummary);
router.get('/upcoming', getUpcoming);
router.get('/overdue', getOverdue);
router.get('/today', getToday);

router.get('/', getVaccinations);
router.post('/', requireRole('ADMIN', 'VETERINARIAN'), createVaccination);
router.get('/:id', getById);
router.put('/:id', requireRole('ADMIN', 'VETERINARIAN'), updateVaccination);
router.patch('/:id', requireRole('ADMIN', 'VETERINARIAN'), patchVaccination);
router.delete('/:id', requireRole('ADMIN', 'VETERINARIAN'), voidVaccination);

module.exports = router;