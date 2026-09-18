const Appointment = require('../models/Appointment');

const ACTIVE_STATUSES = ['scheduled', 'confirmed', 'in_progress'];

// Converts "HH:mm" + date into comparable minutes-of-day for overlap checking
const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const hasConflict = async ({ date, startTime, endTime, veterinarian, excludeId }) => {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const query = {
    date: { $gte: dayStart, $lte: dayEnd },
    status: { $in: ACTIVE_STATUSES },
  };
  if (veterinarian) query.veterinarian = veterinarian;
  if (excludeId) query._id = { $ne: excludeId };

  const candidates = await Appointment.find(query);

  const newStart = toMinutes(startTime);
  const newEnd = toMinutes(endTime);

  return candidates.some((appt) => {
    const existingStart = toMinutes(appt.startTime);
    const existingEnd = toMinutes(appt.endTime);
    return newStart < existingEnd && existingStart < newEnd;
  });
};

const VALID_TRANSITIONS = {
  scheduled: ['confirmed', 'in_progress', 'cancelled', 'no_show'],
  confirmed: ['in_progress', 'completed', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

const isValidTransition = (from, to) => VALID_TRANSITIONS[from]?.includes(to);

module.exports = { hasConflict, isValidTransition, ACTIVE_STATUSES };