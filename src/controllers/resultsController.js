const db = require('../config/db');

// Get all results
const getResults = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM public.exam_result');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create result record
const createResult = async (req, res) => {
  try {
    const { enrollment_id, total_marks, grade, grade_point, result_status } = req.body;
    const query = `
      INSERT INTO public.exam_result (enrollment_id, total_marks, grade, grade_point, result_status)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const result = await db.query(query, [enrollment_id, total_marks, grade, grade_point, result_status]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getResults,
  createResult,
};
