const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Pet = require('../models/Pet');
const Owner = require('../models/Owner');
const { hasConflict, isValidTransition } = require('../services/appointment.service');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const validateAppointmentInput = async (body) => {
  const errors = [];
  const { pet, owner, appointmentType, date, startTime, endTime } = body;

  if (!pet || !isValidId(pet)) errors.push({ field: 'pet', message: 'Valid pet is required' });
  if (!owner || !isValidId(owner)) errors.push({ field: 'owner', message: 'Valid owner is required' });
  if (!appointmentType) errors.push({ field: 'appointmentType', message: 'Appointment type is required' });
  if (!date || isNaN(new Date(date).getTime())) errors.push({ field: 'date', message: 'Valid date is required' });
  if (!startTime || !endTime) errors.push({ field: 'startTime', message: 'Start and end time are required' });
  else if (startTime >= endTime) errors.push({ field: 'endTime', message: 'End time must be after start time' });

  if (errors.length > 0) return errors;

  const petDoc = await Pet.findById(pet);
  if (!petDoc) errors.push({ field: 'pet', message: 'Pet not found' });

  const ownerDoc = await Owner.findById(owner);
  if (!ownerDoc) errors.push({ field: 'owner', message: 'Owner not found' });

  if (petDoc && ownerDoc && petDoc.owner.toString() !== ownerDoc._id.toString()) {
    errors.push({ field: 'owner', message: "Selected owner does not match the pet's registered owner" });
  }

  return errors;
};

// GET /api/appointments
const getAppointments = async (req, res) => {
  try {
    const {
      page = 1, limit = 10, search, status, appointmentType, priority,
      pet, owner, veterinarian, date, dateFrom, dateTo,
      sortBy = 'date', sortOrder = 'asc',
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (appointmentType) query.appointmentType = appointmentType;
    if (priority) query.priority = priority;
    if (pet) query.pet = pet;
    if (owner) query.owner = owner;
    if (veterinarian) query.veterinarian = veterinarian;
    if (date) {
      const d = new Date(date);
      query.date = { $gte: new Date(d.setHours(0, 0, 0, 0)), $lte: new Date(d.setHours(23, 59, 59, 999)) };
    } else if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) query.date.$lte = new Date(dateTo);
    }

    let appointments = await Appointment.find(query)
      .populate('pet', 'name petType breed')
      .populate('owner', 'firstName lastName mobileNumber')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });

    if (search) {
      const s = search.toLowerCase();
      appointments = appointments.filter((a) =>
        a.pet?.name?.toLowerCase().includes(s) ||
        `${a.owner?.firstName} ${a.owner?.lastName}`.toLowerCase().includes(s) ||
        a.owner?.mobileNumber?.includes(search) ||
        a.title?.toLowerCase().includes(s) ||
        a.service?.toLowerCase().includes(s) ||
        a.appointmentType?.toLowerCase().includes(s)
      );
    }

    const total = appointments.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = appointments.slice(skip, skip + Number(limit));

    res.json({
      success: true,
      data: {
        appointments: paginated,
        pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/appointments/today
const getTodayAppointments = async (req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({ date: { $gte: start, $lte: end } })
      .populate('pet', 'name petType')
      .populate('owner', 'firstName lastName')
      .sort({ startTime: 1 });

    res.json({ success: true, data: { appointments } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/appointments/upcoming
const getUpcomingAppointments = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const appointments = await Appointment.find({
      date: { $gte: new Date() },
      status: { $nin: ['cancelled', 'completed', 'no_show'] },
    })
      .populate('pet', 'name petType')
      .populate('owner', 'firstName lastName')
      .sort({ date: 1, startTime: 1 })
      .limit(Number(limit));

    res.json({ success: true, data: { appointments } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/appointments/calendar
const getCalendarAppointments = async (req, res) => {
  try {
    const { start, end, veterinarian, appointmentType, status, priority } = req.query;
    const query = {};
    if (start || end) {
      query.date = {};
      if (start) query.date.$gte = new Date(start);
      if (end) query.date.$lte = new Date(end);
    }
    if (veterinarian) query.veterinarian = veterinarian;
    if (appointmentType) query.appointmentType = appointmentType;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const appointments = await Appointment.find(query).populate('pet', 'name');

    const events = appointments.map((a) => ({
      id: a._id,
      title: `${a.pet?.name || 'Unknown'} - ${a.appointmentType}`,
      start: `${a.date.toISOString().split('T')[0]}T${a.startTime}:00`,
      end: `${a.date.toISOString().split('T')[0]}T${a.endTime}:00`,
      status: a.status,
      appointmentType: a.appointmentType,
      petId: a.pet?._id,
      ownerId: a.owner,
    }));

    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/appointments/summary
const getSummary = async (req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const todayQuery = { date: { $gte: start, $lte: end } };

    const [today, scheduled, confirmed, inProgress, completedToday, cancelledToday, noShowToday, upcoming] = await Promise.all([
      Appointment.countDocuments(todayQuery),
      Appointment.countDocuments({ status: 'scheduled' }),
      Appointment.countDocuments({ status: 'confirmed' }),
      Appointment.countDocuments({ status: 'in_progress' }),
      Appointment.countDocuments({ ...todayQuery, status: 'completed' }),
      Appointment.countDocuments({ ...todayQuery, status: 'cancelled' }),
      Appointment.countDocuments({ ...todayQuery, status: 'no_show' }),
      Appointment.countDocuments({ date: { $gt: end }, status: { $nin: ['cancelled', 'completed', 'no_show'] } }),
    ]);

    res.json({ success: true, data: { today, scheduled, confirmed, inProgress, completedToday, cancelledToday, noShowToday, upcoming } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/appointments/:id
const getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('pet')
      .populate('owner')
      .populate('veterinarian', 'name email role');

    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found', errors: [] });

    res.json({
      success: true,
      data: {
        appointment,
        pet: appointment.pet,
        owner: appointment.owner,
        veterinarian: appointment.veterinarian,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/appointments
const createAppointment = async (req, res) => {
  try {
    const errors = await validateAppointmentInput(req.body);
    if (errors.length > 0) return res.status(400).json({ success: false, message: 'Validation failed', errors });

    const conflict = await hasConflict({
      date: req.body.date, startTime: req.body.startTime, endTime: req.body.endTime, veterinarian: req.body.veterinarian,
    });
    if (conflict) {
      return res.status(409).json({ success: false, message: 'The selected time conflicts with another appointment.', errors: [] });
    }

    const appointment = await Appointment.create({ ...req.body, status: 'scheduled', priority: req.body.priority || 'normal' });
    res.status(201).json({ success: true, data: { appointment } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// PUT /api/appointments/:id
const updateAppointment = async (req, res) => {
  try {
    const existing = await Appointment.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Appointment not found', errors: [] });

    if (['completed', 'cancelled'].includes(existing.status)) {
      return res.status(400).json({ success: false, message: 'Cannot fully edit a completed or cancelled appointment', errors: [] });
    }

    const errors = await validateAppointmentInput({ ...existing.toObject(), ...req.body });
    if (errors.length > 0) return res.status(400).json({ success: false, message: 'Validation failed', errors });

    const dateChanged = req.body.date || req.body.startTime || req.body.endTime;
    if (dateChanged) {
      const conflict = await hasConflict({
        date: req.body.date || existing.date,
        startTime: req.body.startTime || existing.startTime,
        endTime: req.body.endTime || existing.endTime,
        veterinarian: req.body.veterinarian || existing.veterinarian,
        excludeId: existing._id,
      });
      if (conflict) return res.status(409).json({ success: false, message: 'The selected time conflicts with another appointment.', errors: [] });
    }

    const appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: { appointment } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// PATCH /api/appointments/:id/status
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found', errors: [] });

    if (!isValidTransition(appointment.status, status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${appointment.status} to ${status}`,
        errors: [{ field: 'status', message: 'Invalid status transition' }],
      });
    }

    appointment.status = status;
    if (status === 'completed') {
      appointment.completion = { completedAt: new Date(), completedBy: req.user._id };
    }
    if (status === 'cancelled') {
      appointment.cancellation = { reason: req.body.reason || '', cancelledAt: new Date(), cancelledBy: req.user._id };
    }

    await appointment.save();
    res.json({ success: true, data: { appointment } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/appointments/:id/cancel
const cancelAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found', errors: [] });

    if (!isValidTransition(appointment.status, 'cancelled')) {
      return res.status(400).json({ success: false, message: `Cannot cancel an appointment with status ${appointment.status}`, errors: [] });
    }

    appointment.status = 'cancelled';
    appointment.cancellation = { reason: req.body.reason || '', cancelledAt: new Date(), cancelledBy: req.user._id };
    await appointment.save();

    res.json({ success: true, data: { appointment } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/appointments/:id/reschedule
const rescheduleAppointment = async (req, res) => {
  try {
    const { date, startTime, endTime, reason } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found', errors: [] });

    if (['completed', 'cancelled', 'no_show'].includes(appointment.status)) {
      return res.status(400).json({ success: false, message: `Cannot reschedule an appointment with status ${appointment.status}`, errors: [] });
    }

    const conflict = await hasConflict({ date, startTime, endTime, veterinarian: appointment.veterinarian, excludeId: appointment._id });
    if (conflict) return res.status(409).json({ success: false, message: 'The selected time conflicts with another appointment.', errors: [] });

    appointment.date = date;
    appointment.startTime = startTime;
    appointment.endTime = endTime;
    appointment.status = 'scheduled';
    appointment.notes = `${appointment.notes || ''}\nRescheduled: ${reason || 'No reason given'}`.trim();
    await appointment.save();

    res.json({ success: true, data: { appointment } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/appointments/:id/complete
const completeAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found', errors: [] });

    if (!isValidTransition(appointment.status, 'completed')) {
      return res.status(400).json({ success: false, message: `Cannot complete an appointment with status ${appointment.status}`, errors: [] });
    }

    appointment.status = 'completed';
    appointment.completion = { completedAt: new Date(), completedBy: req.user._id };
    if (req.body.notes) appointment.notes = `${appointment.notes || ''}\n${req.body.notes}`.trim();
    await appointment.save();

    res.json({ success: true, data: { appointment } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/appointments/:id/no-show
const markNoShow = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found', errors: [] });

    if (!isValidTransition(appointment.status, 'no_show')) {
      return res.status(400).json({ success: false, message: `Cannot mark appointment with status ${appointment.status} as no-show`, errors: [] });
    }

    appointment.status = 'no_show';
    await appointment.save();

    res.json({ success: true, data: { appointment } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/pets/:petId/appointments
const getPetAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ pet: req.params.petId }).sort({ date: -1 });
    res.json({ success: true, data: { appointments } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/owners/:ownerId/appointments
const getOwnerAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ owner: req.params.ownerId }).populate('pet', 'name').sort({ date: -1 });
    res.json({ success: true, data: { appointments } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

module.exports = {
  getAppointments, getTodayAppointments, getUpcomingAppointments, getCalendarAppointments, getSummary,
  getAppointmentById, createAppointment, updateAppointment, updateStatus,
  cancelAppointment, rescheduleAppointment, completeAppointment, markNoShow,
  getPetAppointments, getOwnerAppointments,
};