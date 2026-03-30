const db = require('../config/db');

// Get all courses (Curriculum)
const getCurriculum = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM public.course');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create course record
const createCurriculum = async (req, res) => {
  try {
    const { course_group_id, name, course_code, credits_l, credits_t, credits_p } = req.body;
    const query = `
      INSERT INTO public.course (course_group_id, name, course_code, credits_l, credits_t, credits_p)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `;
    const result = await db.query(query, [course_group_id, name, course_code, credits_l, credits_t, credits_p]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getCurriculum,
  createCurriculum,
};
