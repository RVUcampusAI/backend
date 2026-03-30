const db = require('../config/db');

// Get all campuses
const getCampuses = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM public.campus');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new campus
const createCampus = async (req, res) => {
  try {
    const { university_id, name } = req.body;
    if (!university_id || !name) {
      return res.status(400).json({ error: 'university_id and name are required' });
    }

    const query = 'INSERT INTO public.campus (university_id, name) VALUES ($1, $2) RETURNING *';
    const result = await db.query(query, [university_id, name]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getCampuses,
  createCampus,
};
