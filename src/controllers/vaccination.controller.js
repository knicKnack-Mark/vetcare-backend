const mongoose = require('mongoose');
const Vaccination = require('../models/Vaccination');
const Pet = require('../models/Pet');
const Owner = require('../models/Owner');
const Appointment = require('../models/Appointment');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const ACTIVE_STATUSES = ['administered'];

const validateInput = async (body) => {
  const errors = [];
  const { pet, vaccineType, vaccineName, administrationDate, nextDueDate, appointment, veterinarian } = body;

  if (!pet || !isValidId(pet)) errors.push({ field: 'pet', message: 'Valid pet is required' });
  if (!vaccineType) errors.push({ field: 'vaccineType', message: 'Vaccine type is required' });
  if (!vaccineName) errors.push({ field: 'vaccineName', message: 'Vaccine name is required' });
  if (!administrationDate || isNaN(new Date(administrationDate).getTime())) errors.push({ field: 'administrationDate', message: 'Valid administration date is required' });

  if (errors.length > 0) return { errors };

  const petDoc = await Pet.findById(pet);
  if (!petDoc) { errors.push({ field: 'pet', message: 'Pet not found' }); return { errors }; }

  // Owner is always derived from the pet relationship — never trust frontend-supplied owner
  const owner = petDoc.owner;

  if (nextDueDate && new Date(nextDueDate) <= new Date(administrationDate)) {
    errors.push({ field: 'nextDueDate', message: 'Next due date must be after administration date' });
  }

  if (appointment) {
    if (!isValidId(appointment)) errors.push({ field: 'appointment', message: 'Invalid appointment ID' });
    else {
      const apptDoc = await Appointment.findById(appointment);
      if (!apptDoc) errors.push({ field: 'appointment', message: 'Appointment not found' });
      else if (apptDoc.pet.toString() !== pet.toString()) errors.push({ field: 'appointment', message: 'Appointment does not belong to this pet' });
    }
  }

  if (veterinarian && !isValidId(veterinarian)) errors.push({ field: 'veterinarian', message: 'Invalid veterinarian ID' });

  return { errors, owner };
};

// GET /api/vaccinations
const getVaccinations = async (req, res) => {
  try {
    const {
      page = 1, limit = 10, search, pet, owner, vaccineType, vaccineName, veterinarian, status,
      date, dateFrom, dateTo, sortBy = 'administrationDate', sortOrder = 'desc',
    } = req.query;

    const query = { status: { $ne: 'voided' } };
    if (pet) query.pet = pet;
    if (owner) query.owner = owner;
    if (vaccineType) query.vaccineType = vaccineType;
    if (vaccineName) query.vaccineName = vaccineName;
    if (veterinarian) query.veterinarian = veterinarian;
    if (status) query.status = status;
    if (date) {
      const d = new Date(date);
      query.administrationDate = { $gte: new Date(d.setHours(0, 0, 0, 0)), $lte: new Date(d.setHours(23, 59, 59, 999)) };
    } else if (dateFrom || dateTo) {
      query.administrationDate = {};
      if (dateFrom) query.administrationDate.$gte = new Date(dateFrom);
      if (dateTo) query.administrationDate.$lte = new Date(dateTo);
    }

    let records = await Vaccination.find(query)
      .populate('pet', 'name petType breed')
      .populate('owner', 'firstName lastName mobileNumber')
      .populate('veterinarian', 'name')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });

    if (search) {
      const s = search.toLowerCase();
      records = records.filter((v) =>
        v.pet?.name?.toLowerCase().includes(s) ||
        `${v.owner?.firstName} ${v.owner?.lastName}`.toLowerCase().includes(s) ||
        v.owner?.mobileNumber?.includes(search) ||
        v.vaccineName?.toLowerCase().includes(s) ||
        v.vaccineType?.toLowerCase().includes(s) ||
        v.manufacturer?.toLowerCase().includes(s) ||
        v.batchNumber?.toLowerCase().includes(s) ||
        v.lotNumber?.toLowerCase().includes(s)
      );
    }

    const total = records.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = records.slice(skip, skip + Number(limit));

    res.json({ success: true, data: { vaccinations: paginated, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/vaccinations/summary
const getSummary = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
    const in14Days = new Date(now.getTime() + 14 * 86400000);

    const [total, thisMonth, today, upcoming, dueToday, overdue] = await Promise.all([
      Vaccination.countDocuments({ status: 'administered' }),
      Vaccination.countDocuments({ status: 'administered', administrationDate: { $gte: startOfMonth } }),
      Vaccination.countDocuments({ status: 'administered', administrationDate: { $gte: startOfDay, $lte: endOfDay } }),
      Vaccination.countDocuments({ status: 'administered', nextDueDate: { $gte: now, $lte: in14Days } }),
      Vaccination.countDocuments({ status: 'administered', nextDueDate: { $gte: startOfDay, $lte: endOfDay } }),
      Vaccination.countDocuments({ status: 'administered', nextDueDate: { $lt: startOfDay } }),
    ]);

    res.json({ success: true, data: { total, thisMonth, today, upcoming, dueToday, overdue } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/vaccinations/upcoming?days=14
const getUpcoming = async (req, res) => {
  try {
    const days = Number(req.query.days) || 14;
    const now = new Date();
    const future = new Date(now.getTime() + days * 86400000);

    const records = await Vaccination.find({ status: 'administered', nextDueDate: { $gte: now, $lte: future } })
      .populate('pet', 'name')
      .populate('owner', 'firstName lastName mobileNumber')
      .sort({ nextDueDate: 1 });

    const data = records.map((v) => ({
      _id: v._id, pet: v.pet, owner: v.owner, vaccineName: v.vaccineName,
      lastAdministered: v.administrationDate, nextDueDate: v.nextDueDate,
      daysRemaining: Math.ceil((v.nextDueDate - now) / 86400000),
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/vaccinations/overdue
const getOverdue = async (req, res) => {
  try {
    const now = new Date();
    const records = await Vaccination.find({ status: 'administered', nextDueDate: { $lt: now } })
      .populate('pet', 'name')
      .populate('owner', 'firstName lastName mobileNumber')
      .sort({ nextDueDate: 1 });

    // Exclude if a newer administered vaccination for the same pet+vaccineName already has a later nextDueDate
    const filtered = [];
    for (const v of records) {
      const newer = await Vaccination.findOne({
        pet: v.pet._id, vaccineName: v.vaccineName, status: 'administered',
        administrationDate: { $gt: v.administrationDate },
      });
      if (!newer) filtered.push(v);
    }

    const data = filtered.map((v) => ({
      _id: v._id, pet: v.pet, owner: v.owner, vaccineName: v.vaccineName,
      previousDate: v.administrationDate, dueDate: v.nextDueDate,
      daysOverdue: Math.ceil((now - v.nextDueDate) / 86400000),
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/vaccinations/today
const getToday = async (req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);

    const records = await Vaccination.find({
      $or: [
        { administrationDate: { $gte: start, $lte: end } },
        { nextDueDate: { $gte: start, $lte: end } },
      ],
    }).populate('pet', 'name').populate('owner', 'firstName lastName');

    res.json({ success: true, data: { vaccinations: records } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/vaccinations/:id
const getById = async (req, res) => {
  try {
    const v = await Vaccination.findById(req.params.id)
      .populate('pet').populate('owner').populate('veterinarian', 'name').populate('appointment');
    if (!v) return res.status(404).json({ success: false, message: 'Vaccination record not found', errors: [] });
    res.json({ success: true, data: { vaccination: v } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/vaccinations
const createVaccination = async (req, res) => {
  try {
    const { errors, owner } = await validateInput(req.body);
    if (errors.length > 0) return res.status(400).json({ success: false, message: 'Validation failed', errors });

    const vaccination = await Vaccination.create({ ...req.body, owner, status: 'administered' });

    // If linked to an appointment, complete it (only when explicitly linked, never auto-complete unrelated appointments)
    if (req.body.appointment) {
      await Appointment.findByIdAndUpdate(req.body.appointment, {
        status: 'completed',
        completion: { completedAt: new Date(), completedBy: req.user._id },
      });
    }

    res.status(201).json({ success: true, data: { vaccination } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// PUT /api/vaccinations/:id
const updateVaccination = async (req, res) => {
  try {
    const existing = await Vaccination.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Vaccination record not found', errors: [] });
    if (existing.status === 'voided') return res.status(400).json({ success: false, message: 'Cannot edit a voided record', errors: [] });

    const { errors } = await validateInput({ ...existing.toObject(), ...req.body });
    if (errors.length > 0) return res.status(400).json({ success: false, message: 'Validation failed', errors });

    const vaccination = await Vaccination.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: { vaccination } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// PATCH /api/vaccinations/:id
const patchVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!vaccination) return res.status(404).json({ success: false, message: 'Vaccination record not found', errors: [] });
    res.json({ success: true, data: { vaccination } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// DELETE /api/vaccinations/:id (void, not delete)
const voidVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findById(req.params.id);
    if (!vaccination) return res.status(404).json({ success: false, message: 'Vaccination record not found', errors: [] });

    vaccination.status = 'voided';
    vaccination.voidReason = req.body.reason || '';
    vaccination.voidedAt = new Date();
    vaccination.voidedBy = req.user._id;
    await vaccination.save();

    res.json({ success: true, message: 'Vaccination record voided', data: { vaccination } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/pets/:petId/vaccinations
const getPetVaccinations = async (req, res) => {
  try {
    const records = await Vaccination.find({ pet: req.params.petId, status: { $ne: 'voided' } })
      .populate('veterinarian', 'name').sort({ administrationDate: -1 });
    res.json({ success: true, data: { vaccinations: records } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/owners/:ownerId/vaccinations
const getOwnerVaccinations = async (req, res) => {
  try {
    const records = await Vaccination.find({ owner: req.params.ownerId, status: { $ne: 'voided' } })
      .populate('pet', 'name').sort({ administrationDate: -1 });
    res.json({ success: true, data: { vaccinations: records } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

module.exports = {
  getVaccinations, getSummary, getUpcoming, getOverdue, getToday, getById,
  createVaccination, updateVaccination, patchVaccination, voidVaccination,
  getPetVaccinations, getOwnerVaccinations,
};