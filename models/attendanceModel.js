const { run, get, all } = require('../db/database');

async function getFacultyByEmail(email) {
  return await get(`SELECT * FROM faculty WHERE email = ?`, [email]);
}

async function getStudentByEmail(email) {
  return await get(`SELECT * FROM students WHERE email = ?`, [email]);
}

async function listFacultySectionMappings(facultyId) {
  return await all(
    `SELECT cof.id AS course_offering_faculty_id, cof.role AS faculty_role,
            cs.id AS course_section_id, cs.section_name,
            c.course_code, c.course_name,
            b.joining_year, p.name AS program_name, sch.name AS school_name,
            cg.name AS course_group_name
     FROM course_offering_faculty cof
     JOIN course_section cs ON cs.id = cof.course_section_id
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN course c ON c.id = co.course_id
     JOIN course_group cg ON cg.id = c.course_group_id
     JOIN batch b ON b.id = co.batch_id
     JOIN program p ON p.id = b.program_id
     JOIN school sch ON sch.id = p.school_id
     WHERE cof.faculty_id = ?
     ORDER BY cs.id, cof.role`,
    [facultyId]
  );
}

async function listEnrolledStudentsForSection(courseSectionId) {
  return await all(
    `SELECT s.id, s.name, s.usn, s.email
     FROM students s
     JOIN student_enrollment se ON se.student_id = s.id
     WHERE se.course_section_id = ?
     ORDER BY s.usn`,
    [courseSectionId]
  );
}

async function getCourseSectionIdForCof(courseOfferingFacultyId) {
  const row = await get(`SELECT course_section_id FROM course_offering_faculty WHERE id = ?`, [
    courseOfferingFacultyId,
  ]);
  return row ? row.course_section_id : null;
}

/** Same section + date + start/end must not repeat (any faculty mapping on that section). */
async function findClassSessionSlotConflict(courseSectionId, sessionDate, startTime, endTime) {
  if (!courseSectionId) return null;
  return await get(
    `SELECT id FROM class_session
     WHERE course_section_id = ?
       AND session_date = ?
       AND start_time = CAST(? AS TIME)
       AND end_time = CAST(? AS TIME)`,
    [courseSectionId, sessionDate, startTime, endTime]
  );
}

/** Spec: duplicate for same faculty mapping + slot. */
async function findClassSessionDuplicateForCof(courseOfferingFacultyId, sessionDate, startTime, endTime) {
  return await get(
    `SELECT id FROM class_session
     WHERE course_offering_faculty_id = ?
       AND session_date = ?
       AND start_time = CAST(? AS TIME)
       AND end_time = CAST(? AS TIME)`,
    [courseOfferingFacultyId, sessionDate, startTime, endTime]
  );
}

async function createClassSession({ courseOfferingFacultyId, sessionDate, startTime, endTime, sessionType }) {
  const r = await run(
    `INSERT INTO class_session (course_offering_faculty_id, course_section_id, session_date, start_time, end_time, session_type)
     SELECT ?, cof.course_section_id, ?, CAST(? AS TIME), CAST(? AS TIME), ?
     FROM course_offering_faculty cof WHERE cof.id = ?`,
    [courseOfferingFacultyId, sessionDate, startTime, endTime, sessionType, courseOfferingFacultyId]
  );
  return r.lastID;
}

async function listClassSessionsForFacultyMapping(courseOfferingFacultyId) {
  return await all(
    `SELECT id, session_date, start_time, end_time, session_type, created_at
     FROM class_session
     WHERE course_offering_faculty_id = ?
     ORDER BY session_date DESC, start_time DESC`,
    [courseOfferingFacultyId]
  );
}

async function getClassSession(id) {
  return await get(`SELECT * FROM class_session WHERE id = ?`, [id]);
}

async function assertSessionOwnedByFaculty(classSessionId, facultyId) {
  const row = await get(
    `SELECT s.id FROM class_session s
     JOIN course_offering_faculty cof ON cof.id = s.course_offering_faculty_id
     WHERE s.id = ? AND cof.faculty_id = ?`,
    [classSessionId, facultyId]
  );
  return !!row;
}

async function upsertAttendance({ studentId, classSessionId, status }) {
  await run(
    `INSERT INTO attendance (student_id, class_session_id, status) VALUES (?, ?, ?)
     ON CONFLICT (student_id, class_session_id)
     DO UPDATE SET status = EXCLUDED.status`,
    [studentId, classSessionId, status]
  );
}

async function listAttendanceForSession(classSessionId) {
  return await all(
    `SELECT a.*, s.usn, s.name
     FROM attendance a
     JOIN students s ON s.id = a.student_id
     WHERE a.class_session_id = ?
     ORDER BY s.usn`,
    [classSessionId]
  );
}

async function listStudentAttendanceSummary(studentId) {
  return await all(`SELECT * FROM attendance_summary WHERE student_id = ? ORDER BY course_section_id`, [studentId]);
}

async function listAttendanceSummaryAll(studentId) {
  if (studentId !== null && studentId !== undefined && !Number.isNaN(Number(studentId))) {
    return await all(`SELECT * FROM attendance_summary WHERE student_id = ? ORDER BY course_section_id`, [
      studentId,
    ]);
  }
  return await all(`SELECT * FROM attendance_summary ORDER BY student_id, course_section_id`);
}

async function listStudentEnrollmentsWithCourses(studentId) {
  return await all(
    `SELECT se.course_section_id, cs.section_name, c.course_code, c.course_name, cg.name AS course_group_name
     FROM student_enrollment se
     JOIN course_section cs ON cs.id = se.course_section_id
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN course c ON c.id = co.course_id
     JOIN course_group cg ON cg.id = c.course_group_id
     WHERE se.student_id = ?
     ORDER BY c.course_code`,
    [studentId]
  );
}

async function createFacultyMapping({ courseSectionId, facultyId, role }) {
  const r = await run(
    `INSERT INTO course_offering_faculty (course_section_id, faculty_id, role) VALUES (?, ?, ?)
     ON CONFLICT (course_section_id, faculty_id, role) DO NOTHING
     RETURNING id`,
    [courseSectionId, facultyId, role]
  );
  return r.lastID;
}

async function listFacultyMappingsAdmin() {
  return await all(
    `SELECT cof.*, f.name AS faculty_name, f.email AS faculty_email, f.faculty_code,
            cs.section_name, c.course_code, c.course_name
     FROM course_offering_faculty cof
     JOIN faculty f ON f.id = cof.faculty_id
     JOIN course_section cs ON cs.id = cof.course_section_id
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN course c ON c.id = co.course_id
     ORDER BY cof.id DESC`
  );
}

async function deleteFacultyMapping(id) {
  await run(`DELETE FROM course_offering_faculty WHERE id = ?`, [id]);
}

async function listEnrollmentsAdmin() {
  return await all(
    `SELECT se.*, s.name AS student_name, s.usn, s.email AS student_email,
            cs.section_name, c.course_code, c.course_name
     FROM student_enrollment se
     JOIN students s ON s.id = se.student_id
     JOIN course_section cs ON cs.id = se.course_section_id
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN course c ON c.id = co.course_id
     ORDER BY se.id DESC`
  );
}

async function deleteEnrollment(id) {
  await run(`DELETE FROM student_enrollment WHERE id = ?`, [id]);
}

async function createEnrollmentAdmin(studentId, courseSectionId) {
  const r = await run(
    `INSERT INTO student_enrollment (student_id, course_section_id) VALUES (?, ?)
     ON CONFLICT (student_id, course_section_id) DO NOTHING`,
    [studentId, courseSectionId]
  );
  return r.lastID;
}

module.exports = {
  getFacultyByEmail,
  getStudentByEmail,
  listFacultySectionMappings,
  listEnrolledStudentsForSection,
  getCourseSectionIdForCof,
  findClassSessionSlotConflict,
  findClassSessionDuplicateForCof,
  createClassSession,
  listClassSessionsForFacultyMapping,
  getClassSession,
  assertSessionOwnedByFaculty,
  upsertAttendance,
  listAttendanceForSession,
  listStudentAttendanceSummary,
  listAttendanceSummaryAll,
  listStudentEnrollmentsWithCourses,
  createFacultyMapping,
  listFacultyMappingsAdmin,
  deleteFacultyMapping,
  listEnrollmentsAdmin,
  deleteEnrollment,
  createEnrollmentAdmin,
};
