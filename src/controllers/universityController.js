const db = require('../config/db');

// Get all universities
const getUniversities = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM public.university');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new university
const createUniversity = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const query = 'INSERT INTO public.university (name) VALUES ($1) RETURNING *';
    const result = await db.query(query, [name]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update university
const updateUniversity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const query = 'UPDATE public.university SET name = $1, updated_at = $2 WHERE id = $3 RETURNING *';
    const result = await db.query(query, [name, new Date(), id]);
    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete university
const deleteUniversity = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM public.university WHERE id = $1', [id]);
    res.status(200).json({ message: 'University deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getUniversities,
  createUniversity,
  updateUniversity,
  deleteUniversity,
};
