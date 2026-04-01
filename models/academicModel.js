const { run, get, all } = require('../db/database');

async function listUniversities() {
  return await all(`SELECT * FROM university ORDER BY name`);
}

async function getUniversity(id) {
  return await get(`SELECT * FROM university WHERE id = ?`, [id]);
}

async function createUniversity(row) {
  const r = await run(
    `INSERT INTO university (name, abbreviation, address, email, phone, website)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.name, row.abbreviation || null, row.address || null, row.email || null, row.phone || null, row.website || null]
  );
  return r.lastID;
}

async function updateUniversity(id, row) {
  await run(
    `UPDATE university SET name=?, abbreviation=?, address=?, email=?, phone=?, website=?,
     updated_at = datetime('now') WHERE id=?`,
    [
      row.name,
      row.abbreviation || null,
      row.address || null,
      row.email || null,
      row.phone || null,
      row.website || null,
      id,
    ]
  );
}

async function deleteUniversity(id) {
  await run(`DELETE FROM university WHERE id = ?`, [id]);
}

async function listCampuses() {
  return await all(
    `SELECT c.*, u.name AS university_name FROM campus c
     JOIN university u ON u.id = c.university_id ORDER BY u.name, c.name`
  );
}

async function getCampus(id) {
  return await get(`SELECT * FROM campus WHERE id = ?`, [id]);
}

async function createCampus(row) {
  const r = await run(
    `INSERT INTO campus (university_id, name, abbreviation, address) VALUES (?, ?, ?, ?)`,
    [row.university_id, row.name, row.abbreviation || null, row.address || null]
  );
  return r.lastID;
}

async function updateCampus(id, row) {
  await run(
    `UPDATE campus SET university_id=?, name=?, abbreviation=?, address=? WHERE id=?`,
    [row.university_id, row.name, row.abbreviation || null, row.address || null, id]
  );
}

async function deleteCampus(id) {
  await run(`DELETE FROM campus WHERE id = ?`, [id]);
}

async function listSchools() {
  return await all(
    `SELECT s.*, c.name AS campus_name FROM school s
     JOIN campus c ON c.id = s.campus_id ORDER BY c.name, s.name`
  );
}

async function getSchool(id) {
  return await get(`SELECT * FROM school WHERE id = ?`, [id]);
}

async function createSchool(row) {
  const r = await run(
    `INSERT INTO school (campus_id, name, abbreviation) VALUES (?, ?, ?)`,
    [row.campus_id, row.name, row.abbreviation || null]
  );
  return r.lastID;
}

async function updateSchool(id, row) {
  await run(
    `UPDATE school SET campus_id=?, name=?, abbreviation=? WHERE id=?`,
    [row.campus_id, row.name, row.abbreviation || null, id]
  );
}

async function deleteSchool(id) {
  await run(`DELETE FROM school WHERE id = ?`, [id]);
}

async function listPrograms() {
  return await all(
    `SELECT p.*, sch.name AS school_name FROM program p
     JOIN school sch ON sch.id = p.school_id ORDER BY sch.name, p.name`
  );
}

async function getProgram(id) {
  return await get(`SELECT * FROM program WHERE id = ?`, [id]);
}

async function createProgram(row) {
  const exitYears =
    typeof row.exit_years === 'string' ? row.exit_years : JSON.stringify(row.exit_years || [4]);
  const r = await run(
    `INSERT INTO program (school_id, name, abbreviation, duration_years, exit_years)
     VALUES (?, ?, ?, ?, ?)`,
    [
      row.school_id,
      row.name,
      row.abbreviation || null,
      row.duration_years ?? 4,
      exitYears,
    ]
  );
  return r.lastID;
}

async function updateProgram(id, row) {
  const exitYears =
    typeof row.exit_years === 'string' ? row.exit_years : JSON.stringify(row.exit_years || [4]);
  await run(
    `UPDATE program SET school_id=?, name=?, abbreviation=?, duration_years=?, exit_years=? WHERE id=?`,
    [row.school_id, row.name, row.abbreviation || null, row.duration_years ?? 4, exitYears, id]
  );
}

async function deleteProgram(id) {
  await run(`DELETE FROM program WHERE id = ?`, [id]);
}

async function listBatches() {
  return await all(
    `SELECT b.*, p.name AS program_name FROM batch b
     JOIN program p ON p.id = b.program_id ORDER BY b.joining_year DESC, p.name`
  );
}

async function getBatch(id) {
  return await get(`SELECT * FROM batch WHERE id = ?`, [id]);
}

async function createBatch(row) {
  const r = await run(
    `INSERT INTO batch (program_id, joining_year) VALUES (?, ?)`,
    [row.program_id, row.joining_year]
  );
  return r.lastID;
}

async function updateBatch(id, row) {
  await run(`UPDATE batch SET program_id=?, joining_year=? WHERE id=?`, [
    row.program_id,
    row.joining_year,
    id,
  ]);
}

async function deleteBatch(id) {
  await run(`DELETE FROM batch WHERE id = ?`, [id]);
}

async function listCourseGroups() {
  return await all(
    `SELECT cg.*, sch.name AS school_name, p.name AS program_name FROM course_group cg
     JOIN school sch ON sch.id = cg.school_id
     LEFT JOIN program p ON p.id = cg.program_id
     ORDER BY sch.name, cg.name`
  );
}

async function getCourseGroup(id) {
  return await get(`SELECT * FROM course_group WHERE id = ?`, [id]);
}

async function createCourseGroup(row) {
  const r = await run(
    `INSERT INTO course_group (school_id, program_id, name, track) VALUES (?, ?, ?, ?)`,
    [row.school_id, row.program_id || null, row.name, row.track]
  );
  return r.lastID;
}

async function updateCourseGroup(id, row) {
  await run(
    `UPDATE course_group SET school_id=?, program_id=?, name=?, track=? WHERE id=?`,
    [row.school_id, row.program_id || null, row.name, row.track, id]
  );
}

async function deleteCourseGroup(id) {
  await run(`DELETE FROM course_group WHERE id = ?`, [id]);
}

async function listCourses() {
  return await all(
    `SELECT c.*, cg.name AS course_group_name FROM course c
     JOIN course_group cg ON cg.id = c.course_group_id ORDER BY c.course_code`
  );
}

async function getCourse(id) {
  return await get(`SELECT * FROM course WHERE id = ?`, [id]);
}

async function createCourse(row) {
  const r = await run(
    `INSERT INTO course (course_group_id, course_name, course_code, credits, lecture_hours, tutorial_hours, practical_hours)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.course_group_id,
      row.course_name,
      row.course_code,
      row.credits ?? 0,
      row.lecture_hours ?? 0,
      row.tutorial_hours ?? 0,
      row.practical_hours ?? 0,
    ]
  );
  return r.lastID;
}

async function updateCourse(id, row) {
  await run(
    `UPDATE course SET course_group_id=?, course_name=?, course_code=?, credits=?, lecture_hours=?, tutorial_hours=?, practical_hours=? WHERE id=?`,
    [
      row.course_group_id,
      row.course_name,
      row.course_code,
      row.credits ?? 0,
      row.lecture_hours ?? 0,
      row.tutorial_hours ?? 0,
      row.practical_hours ?? 0,
      id,
    ]
  );
}

async function deleteCourse(id) {
  await run(`DELETE FROM course WHERE id = ?`, [id]);
}

async function getCourseWithGroup(courseId) {
  return await get(
    `SELECT c.*, cg.school_id AS cg_school_id, cg.program_id AS cg_program_id
     FROM course c
     JOIN course_group cg ON cg.id = c.course_group_id
     WHERE c.id = ?`,
    [courseId]
  );
}

async function getBatchWithProgram(batchId) {
  return await get(
    `SELECT b.*, p.school_id AS program_school_id
     FROM batch b
     JOIN program p ON p.id = b.program_id
     WHERE b.id = ?`,
    [batchId]
  );
}

async function listCourseOfferings() {
  return await all(
    `SELECT co.*, c.course_name, c.course_code, b.joining_year, p.name AS program_name
     FROM course_offering co
     JOIN course c ON c.id = co.course_id
     JOIN batch b ON b.id = co.batch_id
     JOIN program p ON p.id = b.program_id
     ORDER BY co.id DESC`
  );
}

async function getCourseOffering(id) {
  return await get(`SELECT * FROM course_offering WHERE id = ?`, [id]);
}

async function createCourseOffering(row) {
  const r = await run(
    `INSERT INTO course_offering (course_id, batch_id) VALUES (?, ?)`,
    [row.course_id, row.batch_id]
  );
  return r.lastID;
}

async function updateCourseOffering(id, row) {
  await run(`UPDATE course_offering SET course_id=?, batch_id=? WHERE id=?`, [
    row.course_id,
    row.batch_id,
    id,
  ]);
}

async function deleteCourseOffering(id) {
  await run(`DELETE FROM course_offering WHERE id = ?`, [id]);
}

async function listCourseSections() {
  return await all(
    `SELECT cs.*, c.course_code, b.joining_year
     FROM course_section cs
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN course c ON c.id = co.course_id
     JOIN batch b ON b.id = co.batch_id
     ORDER BY cs.id DESC`
  );
}

async function getCourseSection(id) {
  return await get(`SELECT * FROM course_section WHERE id = ?`, [id]);
}

async function createCourseSection(row) {
  const r = await run(
    `INSERT INTO course_section (course_offering_id, section_name) VALUES (?, ?)`,
    [row.course_offering_id, row.section_name]
  );
  return r.lastID;
}

async function updateCourseSection(id, row) {
  await run(`UPDATE course_section SET course_offering_id=?, section_name=? WHERE id=?`, [
    row.course_offering_id,
    row.section_name,
    id,
  ]);
}

async function deleteCourseSection(id) {
  await run(`DELETE FROM course_section WHERE id = ?`, [id]);
}

module.exports = {
  listUniversities,
  getUniversity,
  createUniversity,
  updateUniversity,
  deleteUniversity,
  listCampuses,
  getCampus,
  createCampus,
  updateCampus,
  deleteCampus,
  listSchools,
  getSchool,
  createSchool,
  updateSchool,
  deleteSchool,
  listPrograms,
  getProgram,
  createProgram,
  updateProgram,
  deleteProgram,
  listBatches,
  getBatch,
  createBatch,
  updateBatch,
  deleteBatch,
  listCourseGroups,
  getCourseGroup,
  createCourseGroup,
  updateCourseGroup,
  deleteCourseGroup,
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseWithGroup,
  getBatchWithProgram,
  listCourseOfferings,
  getCourseOffering,
  createCourseOffering,
  updateCourseOffering,
  deleteCourseOffering,
  listCourseSections,
  getCourseSection,
  createCourseSection,
  updateCourseSection,
  deleteCourseSection,
};
