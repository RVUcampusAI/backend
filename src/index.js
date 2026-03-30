const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Route Imports
const universityRoutes = require('./routes/universityRoutes');
const campusRoutes = require('./routes/campusRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const resultsRoutes = require('./routes/resultsRoutes');
const curriculumRoutes = require('./routes/curriculumRoutes');
const authRoutes = require('./routes/authRoutes');
const roleRoutes = require('./routes/roleRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/university', universityRoutes);
app.use('/api/campus', campusRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/curriculum', curriculumRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Campus ERP Backend - Fully Organized Structure');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
