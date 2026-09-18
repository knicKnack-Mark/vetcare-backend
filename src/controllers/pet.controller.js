const mongoose = require('mongoose');
const Pet = require('../models/Pet');
const Owner = require('../models/Owner');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  const years = (Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return years < 1 ? `${Math.round(years * 12)}mo` : `${Math.floor(years)}y`;
};

// GET /api/pets
const getPets = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search, petType, breed, sex, status = 'active',
      sortBy = 'name', sortOrder = 'asc',
    } = req.query;

    const query = {};
    if (status !== 'all') query.status = status;
    if (petType) query.petType = petType;
    if (breed) query.breed = breed;
    if (sex) query.sex = sex;

    let pets = await Pet.find(query).populate('owner', 'firstName lastName mobileNumber');

    if (search) {
      const s = search.toLowerCase();
      pets = pets.filter((p) =>
        p.name.toLowerCase().includes(s) ||
        p._id.toString().includes(search) ||
        `${p.owner?.firstName} ${p.owner?.lastName}`.toLowerCase().includes(s) ||
        p.owner?.mobileNumber?.includes(search) ||
        p.breed?.toLowerCase().includes(s)
      );
    }

    pets.sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      return a[sortBy] > b[sortBy] ? dir : a[sortBy] < b[sortBy] ? -dir : 0;
    });

    const total = pets.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = pets.slice(skip, skip + Number(limit)).map((p) => ({
      ...p.toObject(),
      age: calculateAge(p.birthDate),
      vaccinationStatus: 'up_to_date', // placeholder until Vaccination module exists
      dewormingStatus: 'up_to_date',
      lastVisit: null,
    }));

    // Stats for the whole active set (not just this page)
    const activePets = await Pet.find({ status: 'active' });
    const stats = {
      total: activePets.length,
      dogs: activePets.filter((p) => p.petType === 'Dog').length,
      cats: activePets.filter((p) => p.petType === 'Cat').length,
      vaccineDue: 0, // wire up once Vaccination module exists
      dewormDue: 0,
    };

    res.json({
      success: true,
      data: {
        pets: paginated,
        stats,
        pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/pets/:id
const getPetById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ success: false, message: 'Pet not found', errors: [] });

    const pet = await Pet.findById(req.params.id).populate('owner');
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found', errors: [] });

    res.json({ success: true, data: { pet: { ...pet.toObject(), age: calculateAge(pet.birthDate) } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/pets
const createPet = async (req, res) => {
  try {
    const { name, petType, sex, owner } = req.body;
    const errors = [];
    if (!name) errors.push({ field: 'name', message: 'Pet name is required' });
    if (!petType) errors.push({ field: 'petType', message: 'Pet type is required' });
    if (!sex) errors.push({ field: 'sex', message: 'Sex is required' });
    if (!owner || !isValidId(owner)) errors.push({ field: 'owner', message: 'Valid owner is required' });

    if (errors.length > 0) return res.status(400).json({ success: false, message: 'Validation failed', errors });

    const ownerDoc = await Owner.findById(owner);
    if (!ownerDoc) return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'owner', message: 'Owner not found' }] });

    const pet = await Pet.create(req.body);
    res.status(201).json({ success: true, data: { pet } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// PUT /api/pets/:id
const updatePet = async (req, res) => {
  try {
    const pet = await Pet.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found', errors: [] });
    res.json({ success: true, data: { pet } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// PATCH /api/pets/:id/archive
const archivePet = async (req, res) => {
  try {
    const pet = await Pet.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found', errors: [] });
    res.json({ success: true, message: 'Pet archived', data: { pet } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// PATCH /api/pets/:id/restore
const restorePet = async (req, res) => {
  try {
    const pet = await Pet.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found', errors: [] });
    res.json({ success: true, data: { pet } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

module.exports = { getPets, getPetById, createPet, updatePet, archivePet, restorePet };