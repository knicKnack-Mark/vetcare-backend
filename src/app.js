const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
const ownerRoutes = require('./routes/owner.routes');
const petRoutes = require('./routes/pet.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const vaccinationRoutes = require('./routes/vaccination.routes');
const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/owners', ownerRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/vaccinations', vaccinationRoutes);


app.get('/', (req, res) => res.json({ message: 'VetCare API running' }));

module.exports = app;