const Owner = require('../models/Owner');
const Pet = require('../models/Pet');
const validator = require('validator');
const sanitizeHtml = require('sanitize-html');

const sanitizeText = (str) => (typeof str === 'string' ? sanitizeHtml(str, { allowedTags: [], allowedAttributes: {} }).trim() : str);

const sanitizeOwnerBody = (body) => {
  const clean = { ...body };
  ['firstName', 'middleName', 'lastName', 'suffix', 'notes'].forEach((f) => {
    if (clean[f]) clean[f] = sanitizeText(clean[f]);
  });
  if (clean.address) {
    clean.address = { ...clean.address };
    ['houseStreet', 'barangay', 'municipality', 'province', 'zipCode'].forEach((f) => {
      if (clean.address[f]) clean.address[f] = sanitizeText(clean.address[f]);
    });
  }
  return clean;
};

const mobileRegex = /^09\d{9}$/;

const validateOwnerFields = (body, { partial = false } = {}) => {
  const errors = [];
  const { firstName, lastName, mobileNumber, email, address } = body;

  if (!partial) {
    if (!firstName) errors.push({ field: 'firstName', message: 'First name is required' });
    if (!lastName) errors.push({ field: 'lastName', message: 'Last name is required' });
    if (!mobileNumber) errors.push({ field: 'mobileNumber', message: 'Mobile number is required' });
    if (!address?.municipality) errors.push({ field: 'address.municipality', message: 'Municipality is required' });
    if (!address?.province) errors.push({ field: 'address.province', message: 'Province is required' });
  }

  if (mobileNumber && !mobileRegex.test(mobileNumber)) {
    errors.push({ field: 'mobileNumber', message: 'Mobile number must be a valid PH number (e.g. 09171234567)' });
  }

  if (email && !validator.isEmail(email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }

  return errors;
};

// GET /api/owners
// GET /api/owners
const getOwners = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      municipality,
      province,
      preferredContactMethod,
      sortBy = 'lastName',
      sortOrder = 'asc',
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (municipality) query['address.municipality'] = municipality;
    if (province) query['address.province'] = province;
    if (preferredContactMethod) query.preferredContactMethod = preferredContactMethod;

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { middleName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { mobileNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [owners, total] = await Promise.all([
      Owner.find(query).sort(sort).skip(skip).limit(Number(limit)),
      Owner.countDocuments(query),
    ]);

    const ownersWithPetCount = await Promise.all(
      owners.map(async (o) => ({
        ...o.toJSON(),
        petCount: await Pet.countDocuments({ owner: o._id }),
      }))
    );

    res.json({
      success: true,
      data: {
        owners: ownersWithPetCount,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};  

// GET /api/owners/:id
const getOwnerById = async (req, res) => {
  try {
    const owner = await Owner.findById(req.params.id);
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found', errors: [] });

    const pets = await Pet.find({ owner: owner._id });
    const activePets = pets.filter((p) => p.status === 'active').length;

    res.json({
      success: true,
      data: {
        owner,
        pets,
        summary: {
          totalPets: pets.length,
          activePets,
          inactivePets: pets.length - activePets,
          lastVisit: null, // wire up once appointments module exists
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/owners
const createOwner = async (req, res) => {
  try {
    req.body = sanitizeOwnerBody(req.body);
    const errors = validateOwnerFields(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const { firstName, lastName, mobileNumber, email } = req.body;

    const duplicate = await Owner.findOne({
      $or: [
        { mobileNumber },
        ...(email ? [{ email }] : []),
        { firstName, lastName },
      ],
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'A possible duplicate owner already exists',
        errors: [{ field: 'mobileNumber', message: 'Owner with matching info already exists', existingOwnerId: duplicate._id }],
      });
    }

    const owner = await Owner.create(req.body);
    res.status(201).json({ success: true, data: { owner } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// PUT /api/owners/:id
const updateOwner = async (req, res) => {
  try {
    req.body = sanitizeOwnerBody(req.body);
    const errors = validateOwnerFields(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const owner = await Owner.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found', errors: [] });
    res.json({ success: true, data: { owner } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// PATCH /api/owners/:id
const patchOwner = async (req, res) => {
  try {
    req.body = sanitizeOwnerBody(req.body);
    const errors = validateOwnerFields(req.body, { partial: true });
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const owner = await Owner.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found', errors: [] });
    res.json({ success: true, data: { owner } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// DELETE /api/owners/:id (soft delete)
// DELETE /api/owners/:id (soft delete)
const deactivateOwner = async (req, res) => {
  try {
    const owner = await Owner.findById(req.params.id);
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found', errors: [] });

    if (owner.status === 'inactive') {
      return res.status(400).json({ success: false, message: 'Owner is already inactive', errors: [] });
    }

    const petCount = await Pet.countDocuments({ owner: owner._id });

    // Not blocking — just informing. Historical data is preserved either way via soft delete.
    owner.status = 'inactive';
    await owner.save();

    res.json({
      success: true,
      message: petCount > 0
        ? `Owner deactivated. ${petCount} associated pet record(s) will be preserved.`
        : 'Owner deactivated.',
      data: { owner, petCount },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// PATCH /api/owners/:id/status
const updateOwnerStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'status', message: 'Invalid status value' }],
      });
    }
    const owner = await Owner.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found', errors: [] });
    res.json({ success: true, data: { owner } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/owners/:id/pets
const getOwnerPets = async (req, res) => {
  try {
    const pets = await Pet.find({ owner: req.params.id }).select('name petType breed sex birthDate status photo');
    res.json({ success: true, data: { pets } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/owners/:id/summary
const getOwnerSummary = async (req, res) => {
  try {
    const pets = await Pet.find({ owner: req.params.id });
    const activePets = pets.filter((p) => p.status === 'active').length;

    res.json({
      success: true,
      data: {
        totalPets: pets.length,
        activePets,
        inactivePets: pets.length - activePets,
        totalAppointments: 0,
        completedAppointments: 0,
        upcomingAppointments: 0,
        lastVisit: null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/owners/search?q=
const searchOwners = async (req, res) => {
  try {
    const { q } = req.query;
    const owners = await Owner.find({
      $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { middleName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { mobileNumber: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    }).limit(10);

    const matches = await Promise.all(
      owners.map(async (o) => ({
        _id: o._id,
        name: o.fullName,
        mobileNumber: o.mobileNumber,
        petCount: await Pet.countDocuments({ owner: o._id }),
      }))
    );

    res.json({ success: true, data: { matches } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

module.exports = {
  getOwners,
  getOwnerById,
  createOwner,
  updateOwner,
  patchOwner,
  deactivateOwner,
  updateOwnerStatus,
  getOwnerPets,
  getOwnerSummary,
  searchOwners,
};