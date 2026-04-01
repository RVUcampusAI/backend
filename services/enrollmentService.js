const { get, all, run } = require('../db/database');
const academic = require('../models/academicModel');

async function getStudent(studentId) {
  return await get(`SELECT * FROM students WHERE id = ?`, [studentId]);
}

async function getSectionWithCourse(sectionId) {
  return await get(
    `SELECT cs.*, c.course_group_id, cg.track AS group_track, cg.program_id AS cg_program_id, cg.school_id AS cg_school_id
     FROM course_section cs
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN course c ON c.id = co.course_id
     JOIN course_group cg ON cg.id = c.course_group_id
     WHERE cs.id = ?`,
    [sectionId]
  );
}

/**
 * Enroll student in all sections for core courses offered to their batch (matching program/school on course group).
 */
async function autoEnrollCoreCourses(studentId) {
  const stu = await getStudent(studentId);
  if (!stu || !stu.batch_id || !stu.program_id || !stu.school_id) return { added: 0 };

  const batch = await academic.getBatch(stu.batch_id);
  if (!batch || batch.program_id !== stu.program_id) return { added: 0 };

  const coreGroups = await all(
    `SELECT id FROM course_group
     WHERE track = 'core'
       AND school_id = ?
       AND (program_id IS NULL OR program_id = ?)`,
    [stu.school_id, stu.program_id]
  );
  if (!coreGroups.length) return { added: 0 };

  const groupIds = coreGroups.map((g) => g.id);
  const placeholders = groupIds.map(() => '?').join(', ');
  const sections = await all(
    `SELECT DISTINCT cs.id
     FROM course_section cs
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN course c ON c.id = co.course_id
     WHERE co.batch_id = ? AND c.course_group_id IN (${placeholders})`,
    [stu.batch_id, ...groupIds]
  );

  let added = 0;
  for (const { id: secId } of sections) {
    const before = await get(
      `SELECT 1 FROM student_enrollment WHERE student_id = ? AND course_section_id = ?`,
      [studentId, secId]
    );
    await run(
      `INSERT INTO student_enrollment (student_id, course_section_id) VALUES (?, ?)
       ON CONFLICT (student_id, course_section_id) DO NOTHING`,
      [studentId, secId]
    );
    const after = await get(
      `SELECT 1 FROM student_enrollment WHERE student_id = ? AND course_section_id = ?`,
      [studentId, secId]
    );
    if (!before && after) added += 1;
  }
  return { added };
}

/**
 * Manual enrollment: minors/electives — course group track must match intent; electives may be cross-school.
 */
async function validateManualEnrollment(studentId, courseSectionId) {
  const stu = await getStudent(studentId);
  const sec = await getSectionWithCourse(courseSectionId);
  if (!stu) return { ok: false, message: 'Student not found' };
  if (!sec) return { ok: false, message: 'Section not found' };

  const track = sec.group_track;
  if (track === 'core') {
    return { ok: false, message: 'Core courses are enrolled automatically from program and batch' };
  }
  if (track === 'major' || track === 'specialization') {
    return { ok: false, message: 'Use affiliation fields for major/specialization mappings' };
  }
  if (track === 'minor') {
    if (!stu.minor_id || stu.minor_id !== sec.course_group_id) {
      return { ok: false, message: 'Minor enrollment must match the student minor course group' };
    }
  }
  if (track === 'elective') {
    // cross-school allowed — only require student has batch/program set
    if (!stu.batch_id) return { ok: false, message: 'Student needs a batch for elective enrollment' };
  }

  const offering = await get(
    `SELECT co.batch_id FROM course_offering co
     JOIN course_section cs ON cs.course_offering_id = co.id WHERE cs.id = ?`,
    [courseSectionId]
  );
  if (offering && offering.batch_id !== stu.batch_id) {
    return { ok: false, message: 'Section batch must match the student batch' };
  }

  return { ok: true };
}

module.exports = {
  autoEnrollCoreCourses,
  validateManualEnrollment,
  getSectionWithCourse,
};
