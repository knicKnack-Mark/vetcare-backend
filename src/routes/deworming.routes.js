const express = require('express');
const router = express.Router();
const { getDewormings, getSummary, getUpcoming, getOverdue, getById, createDeworming, updateDeworming, voidDeworming } = require('../controllers/deworming.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

router.use(authenticateUser);
router.get('/summary', getSummary);
router.get('/upcoming', getUpcoming);
router.get('/overdue', getOverdue);
router.get('/', getDewormings);
router.post('/', requireRole('ADMIN', 'VETERINARIAN'), createDeworming);
router.get('/:id', getById);
router.put('/:id', requireRole('ADMIN', 'VETERINARIAN'), updateDeworming);
router.delete('/:id', requireRole('ADMIN', 'VETERINARIAN'), voidDeworming);

module.exports = router;