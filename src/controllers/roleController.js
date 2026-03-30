const db = require('../config/db');

// Get all roles
const getRoles = async (req, res) => {
  try {
    const result = await db.query('SELECT id, name FROM public.role');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getRoles,
};
