const mongoose = require('mongoose');
const Deworming = require('../models/Deworming');
const Pet = require('../models/Pet');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const validateInput = async (body) => {
  const errors = [];
  const { pet, medicineName, administrationDate, nextDueDate } = body;

  if (!pet || !isValidId(pet)) errors.push({ field: 'pet', message: 'Valid pet is required' });
  if (!medicineName) errors.push({ field: 'medicineName', message: 'Medicine name is required' });
  if (!administrationDate || isNaN(new Date(administrationDate).getTime())) errors.push({ field: 'administrationDate', message: 'Valid administration date is required' });

  if (errors.length > 0) return { errors };

  const petDoc = await Pet.findById(pet);
  if (!petDoc) { errors.push({ field: 'pet', message: 'Pet not found' }); return { errors }; }

  if (nextDueDate && new Date(nextDueDate) <= new Date(administrationDate)) {
    errors.push({ field: 'nextDueDate', message: 'Next due date must be after administration date' });
  }

  return { errors, owner: petDoc.owner };
};

const getDewormings = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, pet, owner, status, sortBy = 'administrationDate', sortOrder = 'desc' } = req.query;
    const query = { status: { $ne: 'voided' } };
    if (pet) query.pet = pet;
    if (owner) query.owner = owner;
    if (status) query.status = status;

    let records = await Deworming.find(query)
      .populate('pet', 'name petType breed')
      .populate('owner', 'firstName lastName mobileNumber')
      .populate('veterinarian', 'name')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });

    if (search) {
      const s = search.toLowerCase();
      records = records.filter((d) =>
        d.pet?.name?.toLowerCase().includes(s) ||
        `${d.owner?.firstName} ${d.owner?.lastName}`.toLowerCase().includes(s) ||
        d.medicineName?.toLowerCase().includes(s)
      );
    }

    const total = records.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = records.slice(skip, skip + Number(limit));

    res.json({ success: true, data: { dewormings: paginated, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

const getSummary = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);

    const [total, thisMonth, upcoming, overdue] = await Promise.all([
      Deworming.countDocuments({ status: 'administered' }),
      Deworming.countDocuments({ status: 'administered', administrationDate: { $gte: startOfMonth } }),
      Deworming.countDocuments({ status: 'administered', nextDueDate: { $gte: now, $lte: new Date(now.getTime() + 14 * 86400000) } }),
      Deworming.countDocuments({ status: 'administered', nextDueDate: { $lt: startOfDay } }),
    ]);

    res.json({ success: true, data: { total, thisMonth, upcoming, overdue } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

const getUpcoming = async (req, res) => {
  try {
    const days = Number(req.query.days) || 14;
    const now = new Date();
    const future = new Date(now.getTime() + days * 86400000);
    const records = await Deworming.find({ status: 'administered', nextDueDate: { $gte: now, $lte: future } })
      .populate('pet', 'name').populate('owner', 'firstName lastName mobileNumber').sort({ nextDueDate: 1 });

    const data = records.map((d) => ({
      _id: d._id, pet: d.pet, owner: d.owner, medicineName: d.medicineName,
      nextDueDate: d.nextDueDate, daysRemaining: Math.ceil((d.nextDueDate - now) / 86400000),
    }));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

const getOverdue = async (req, res) => {
  try {
    const now = new Date();
    const records = await Deworming.find({ status: 'administered', nextDueDate: { $lt: now } })
      .populate('pet', 'name').populate('owner', 'firstName lastName mobileNumber').sort({ nextDueDate: 1 });

    const data = records.map((d) => ({
      _id: d._id, pet: d.pet, owner: d.owner, medicineName: d.medicineName,
      dueDate: d.nextDueDate, daysOverdue: Math.ceil((now - d.nextDueDate) / 86400000),
    }));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

const getById = async (req, res) => {
  try {
    const d = await Deworming.findById(req.params.id).populate('pet').populate('owner').populate('veterinarian', 'name');
    if (!d) return res.status(404).json({ success: false, message: 'Deworming record not found', errors: [] });
    res.json({ success: true, data: { deworming: d } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

const createDeworming = async (req, res) => {
  try {
    const { errors, owner } = await validateInput(req.body);
    if (errors.length > 0) return res.status(400).json({ success: false, message: 'Validation failed', errors });
    const deworming = await Deworming.create({ ...req.body, owner, status: 'administered' });
    res.status(201).json({ success: true, data: { deworming } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

const updateDeworming = async (req, res) => {
  try {
    const existing = await Deworming.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Deworming record not found', errors: [] });
    const deworming = await Deworming.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: { deworming } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

const voidDeworming = async (req, res) => {
  try {
    const deworming = await Deworming.findById(req.params.id);
    if (!deworming) return res.status(404).json({ success: false, message: 'Deworming record not found', errors: [] });
    deworming.status = 'voided';
    deworming.voidReason = req.body.reason || '';
    deworming.voidedAt = new Date();
    deworming.voidedBy = req.user._id;
    await deworming.save();
    res.json({ success: true, message: 'Deworming record voided', data: { deworming } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

const getPetDewormings = async (req, res) => {
  try {
    const records = await Deworming.find({ pet: req.params.petId, status: { $ne: 'voided' } }).sort({ administrationDate: -1 });
    res.json({ success: true, data: { dewormings: records } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

const getOwnerDewormings = async (req, res) => {
  try {
    const records = await Deworming.find({ owner: req.params.ownerId, status: { $ne: 'voided' } }).populate('pet', 'name').sort({ administrationDate: -1 });
    res.json({ success: true, data: { dewormings: records } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

module.exports = { getDewormings, getSummary, getUpcoming, getOverdue, getById, createDeworming, updateDeworming, voidDeworming, getPetDewormings, getOwnerDewormings };