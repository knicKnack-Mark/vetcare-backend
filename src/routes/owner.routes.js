const express = require('express');
const router = express.Router();
const {
  getOwners, getOwnerById, createOwner, updateOwner, patchOwner,
  deactivateOwner, updateOwnerStatus, getOwnerPets, getOwnerSummary, searchOwners,
} = require('../controllers/owner.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');
const { getOwnerAppointments } = require('../controllers/appointment.controller');

router.use(authenticateUser);

router.get('/search', searchOwners);
router.get('/', getOwners);
router.get('/:id', getOwnerById);
router.get('/:id/pets', getOwnerPets);
router.get('/:id/summary', getOwnerSummary);

router.post('/', requireRole('ADMIN', 'RECEPTIONIST'), createOwner);
router.put('/:id', requireRole('ADMIN', 'RECEPTIONIST'), updateOwner);
router.patch('/:id', requireRole('ADMIN', 'RECEPTIONIST'), patchOwner);
router.patch('/:id/status', requireRole('ADMIN', 'RECEPTIONIST'), updateOwnerStatus);
router.delete('/:id', requireRole('ADMIN'), deactivateOwner);
router.get('/:id/appointments', getOwnerAppointments);
module.exports = router;