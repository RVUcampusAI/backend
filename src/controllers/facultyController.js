const db = require('../config/db');

// Get Faculty Dashboard Stats
const getDashboardStats = async (req, res) => {
  try {
    const { faculty_id } = req.params;

    // Total Courses
    const coursesResult = await db.query(
      'SELECT COUNT(*) FROM public.course_offering_faculty WHERE faculty_id = $1',
      [faculty_id]
    );

    // Total Students (Distinct students across all course offerings)
    const studentsResult = await db.query(
      `SELECT COUNT(DISTINCT e.student_id) 
       FROM public.enrollment e
       JOIN public.course_offering_faculty cof ON e.course_offering_id = cof.course_offering_id
       WHERE cof.faculty_id = $1`,
      [faculty_id]
    );

    // Classes Today
    const today = new Date().toISOString().split('T')[0];
    const classesTodayResult = await db.query(
      `SELECT COUNT(*) 
       FROM public.class_session cs
       JOIN public.session_faculty sf ON cs.id = sf.class_session_id
       WHERE sf.faculty_id = $1 AND cs.date = $2`,
      [faculty_id, today]
    );

    // Pending Evaluations (Exam entries without marks_obtained for components belonging to faculty's offerings)
    const pendingResult = await db.query(
      `SELECT COUNT(*) 
       FROM public.exam_entry ee
       JOIN public.exam_component ec ON ee.exam_component_id = ec.id
       JOIN public.course_offering_faculty cof ON ec.course_offering_id = cof.course_offering_id
       WHERE cof.faculty_id = $1 AND ee.marks_obtained IS NULL`,
      [faculty_id]
    );

    res.status(200).json({
      totalCourses: coursesResult.rows[0].count,
      totalStudents: studentsResult.rows[0].count,
      classesToday: classesTodayResult.rows[0].count,
      pendingEvaluations: pendingResult.rows[0].count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Today's Teaching Schedule
const getTodaySchedule = async (req, res) => {
  try {
    const { faculty_id } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const query = `
      SELECT cs.id, c.name as subject, ts.start_time, ts.end_time, co.section, co.semester
      FROM public.class_session cs
      JOIN public.session_faculty sf ON cs.id = sf.class_session_id
      JOIN public.course_offering co ON cs.course_offering_id = co.id
      JOIN public.course c ON co.course_id = c.id
      JOIN public.time_slot ts ON cs.time_slot_id = ts.id
      WHERE sf.faculty_id = $1 AND cs.date = $2
      ORDER BY ts.start_time
    `;
    const result = await db.query(query, [faculty_id, today]);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Faculty Courses
const getCourses = async (req, res) => {
  try {
    const { faculty_id } = req.params;
    const query = `
      SELECT c.course_code as code, c.name, co.semester, co.section, 
             (SELECT COUNT(*) FROM public.enrollment e WHERE e.course_offering_id = co.id) as students
      FROM public.course_offering_faculty cof
      JOIN public.course_offering co ON cof.course_offering_id = co.id
      JOIN public.course c ON co.course_id = c.id
      WHERE cof.faculty_id = $1
    `;
    const result = await db.query(query, [faculty_id]);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Faculty Students
const getStudents = async (req, res) => {
  try {
    const { faculty_id } = req.params;
    const query = `
      SELECT s.name, s.usn, s.email, c.name as course, co.section,
             COALESCE(asum.percentage, 0) as attendance
      FROM public.student s
      JOIN public.enrollment e ON s.id = e.student_id
      JOIN public.course_offering co ON e.course_offering_id = co.id
      JOIN public.course c ON co.course_id = c.id
      JOIN public.course_offering_faculty cof ON co.id = cof.course_offering_id
      LEFT JOIN public.attendance_summary asum ON e.id = asum.enrollment_id
      WHERE cof.faculty_id = $1
      ORDER BY c.name, s.name
    `;
    const result = await db.query(query, [faculty_id]);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Faculty Timetable
const getTimetable = async (req, res) => {
  try {
    const { faculty_id } = req.params;
    const query = `
      SELECT t.day_of_week, ts.start_time, ts.end_time, c.name as course, t.room_no as room, cs.type
      FROM public.timetable t
      JOIN public.course_offering co ON t.course_offering_id = co.id
      JOIN public.course c ON co.course_id = c.id
      JOIN public.course_offering_faculty cof ON co.id = cof.course_offering_id
      JOIN public.time_slot ts ON t.time_slot_id = ts.id
      LEFT JOIN public.class_session cs ON cs.course_offering_id = co.id AND cs.time_slot_id = ts.id
      WHERE cof.faculty_id = $1
      ORDER BY t.day_of_week, ts.start_time
    `;
    const result = await db.query(query, [faculty_id]);
    
    // Map day numbers to names if needed, or handle in frontend
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getDashboardStats,
  getTodaySchedule,
  getCourses,
  getStudents,
  getTimetable
};
