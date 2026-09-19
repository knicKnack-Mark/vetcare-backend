const express = require('express');
const router = express.Router();
const { getPets, getPetById, createPet, updatePet, archivePet, restorePet } = require('../controllers/pet.controller');
const { getPetAppointments } = require('../controllers/appointment.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');
const { getPetVaccinations } = require('../controllers/vaccination.controller');
const { getPetDewormings } = require('../controllers/deworming.controller');


router.use(authenticateUser);

router.get('/', getPets);
router.post('/', requireRole('ADMIN', 'RECEPTIONIST', 'VETERINARIAN'), createPet);
router.get('/:id', getPetById);
router.put('/:id', requireRole('ADMIN', 'RECEPTIONIST', 'VETERINARIAN'), updatePet);
router.patch('/:id/archive', requireRole('ADMIN', 'RECEPTIONIST'), archivePet);
router.patch('/:id/restore', requireRole('ADMIN', 'RECEPTIONIST'), restorePet);
router.get('/:id/appointments', getPetAppointments);
router.get('/:id/vaccinations', getPetVaccinations);
router.get('/:id/dewormings', getPetDewormings);

module.exports = router;