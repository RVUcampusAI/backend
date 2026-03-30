const db = require('../config/db');

// Get all attendance
const getAttendance = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM public.attendance');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create attendance record
const createAttendance = async (req, res) => {
  try {
    const { enrollment_id, class_session_id, status } = req.body;
    const query = 'INSERT INTO public.attendance (enrollment_id, class_session_id, status) VALUES ($1, $2, $3) RETURNING *';
    const result = await db.query(query, [enrollment_id, class_session_id, status]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAttendance,
  createAttendance,
};
