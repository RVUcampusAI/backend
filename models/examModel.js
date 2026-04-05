const { run, get, all } = require('../db/database');

async function facultyTeachesSection(facultyId, courseSectionId) {
  const row = await get(
    `SELECT 1 FROM course_offering_faculty WHERE faculty_id = ? AND course_section_id = ? LIMIT 1`,
    [facultyId, courseSectionId]
  );
  return !!row;
}

async function getSectionCourseId(courseSectionId) {
  const row = await get(
    `SELECT co.course_id FROM course_section cs
     JOIN course_offering co ON co.id = cs.course_offering_id
     WHERE cs.id = ?`,
    [courseSectionId]
  );
  return row ? row.course_id : null;
}

async function listEnrollmentsForSectionWithIds(courseSectionId) {
  return await all(
    `SELECT se.id AS enrollment_id, se.student_id, s.usn, s.name
     FROM student_enrollment se
     JOIN students s ON s.id = se.student_id
     WHERE se.course_section_id = ?
     ORDER BY s.usn`,
    [courseSectionId]
  );
}

async function createExamRow({
  courseId,
  courseSectionId,
  examType,
  examMode,
  formulaType,
  totalMarks,
  examDate,
  createdByFacultyId,
}) {
  const r = await run(
    `INSERT INTO exam (course_id, course_section_id, exam_type, exam_mode, formula_type, total_marks, exam_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [courseId, courseSectionId, examType, examMode, formulaType || 'SUM', totalMarks, examDate, createdByFacultyId]
  );
  return r.lastID;
}

async function addExamComponent(examId, { componentName, maxMarks, weightage }) {
  const r = await run(
    `INSERT INTO exam_component (exam_id, component_name, max_marks, weightage) VALUES (?, ?, ?, ?)`,
    [examId, componentName, maxMarks ?? 0, weightage ?? 0]
  );
  return r.lastID;
}

async function seedExamStudents(examId, enrollments) {
  for (const e of enrollments) {
    await run(
      `INSERT INTO exam_student (exam_id, student_id, enrollment_id, usn, attendance_percentage, status, attempt_number)
       VALUES (?, ?, ?, ?, NULL, 'absent', 1)
       ON CONFLICT (exam_id, student_id) DO NOTHING`,
      [examId, e.student_id, e.enrollment_id, e.usn]
    );
  }
}

async function listExamsForSection(courseSectionId) {
  return await all(
    `SELECT e.*, f.name AS created_by_name
     FROM exam e
     JOIN faculty f ON f.id = e.created_by
     WHERE e.course_section_id = ?
     ORDER BY e.exam_date DESC, e.id DESC`,
    [courseSectionId]
  );
}

async function listAllExamsAdmin() {
  return await all(
    `SELECT e.*, c.course_code, c.course_name, cs.section_name, sch.name AS school_name, p.name AS program_name
     FROM exam e
     JOIN course c ON c.id = e.course_id
     JOIN course_section cs ON cs.id = e.course_section_id
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN batch b ON b.id = co.batch_id
     JOIN program p ON p.id = b.program_id
     JOIN school sch ON sch.id = p.school_id
     ORDER BY e.id DESC`
  );
}

async function getExamById(examId) {
  return await get(`SELECT * FROM exam WHERE id = ?`, [examId]);
}

async function listExamComponents(examId) {
  return await all(`SELECT * FROM exam_component WHERE exam_id = ? ORDER BY id`, [examId]);
}

async function listExamStudents(examId) {
  return await all(
    `SELECT es.*, s.name AS student_name
     FROM exam_student es
     JOIN students s ON s.id = es.student_id
     WHERE es.exam_id = ?
     ORDER BY s.usn`,
    [examId]
  );
}

async function listAllComponentMarksForExam(examId) {
  return await all(
    `SELECT m.student_id, m.exam_component_id, m.marks_obtained
     FROM exam_component_marks m
     JOIN exam_component ec ON ec.id = m.exam_component_id
     WHERE ec.exam_id = ?`,
    [examId]
  );
}

async function updateExamStudentRow(examStudentId, patch) {
  const fields = [];
  const vals = [];
  if (patch.obtained_marks !== undefined) {
    fields.push('obtained_marks = ?');
    vals.push(patch.obtained_marks);
  }
  if (patch.status !== undefined) {
    fields.push('status = ?');
    vals.push(patch.status);
  }
  if (patch.attendance_percentage !== undefined) {
    fields.push('attendance_percentage = ?');
    vals.push(patch.attendance_percentage);
  }
  if (patch.attempt_number !== undefined) {
    fields.push('attempt_number = ?');
    vals.push(patch.attempt_number);
  }
  if (!fields.length) return;
  vals.push(examStudentId);
  await run(`UPDATE exam_student SET ${fields.join(', ')} WHERE id = ?`, vals);
}

async function upsertComponentMark(examComponentId, studentId, marksObtained) {
  await run(
    `INSERT INTO exam_component_marks (exam_component_id, student_id, marks_obtained) VALUES (?, ?, ?)
     ON CONFLICT (exam_component_id, student_id)
     DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained`,
    [examComponentId, studentId, marksObtained]
  );
}

async function sumComponentMarksForStudent(examId, studentId) {
  const row = await get(
    `SELECT COALESCE(SUM(m.marks_obtained), 0)::numeric AS total
     FROM exam_component ec
     JOIN exam_component_marks m ON m.exam_component_id = ec.id
     WHERE ec.exam_id = ? AND m.student_id = ?`,
    [examId, studentId]
  );
  return row ? row.total : 0;
}

function normalizeWeightageNumber(weightage) {
  const w = Number(weightage);
  if (!Number.isFinite(w) || w < 0) return 0;
  // Accept either multiplier (0..1) or percentage (0..100).
  if (w <= 1) return w;
  if (w <= 100) return w / 100;
  return w;
}

async function computeExamStudentTotal(examId, studentId) {
  const row = await get(
    `SELECT
       e.formula_type,
       CASE
         WHEN e.formula_type = 'SUM'
           THEN COALESCE(SUM(COALESCE(m.marks_obtained, 0)), 0)::numeric
         ELSE
           COALESCE(
             SUM(
               COALESCE(m.marks_obtained, 0)
               * CASE
                   WHEN ec.weightage <= 1 THEN ec.weightage
                   WHEN ec.weightage <= 100 THEN ec.weightage / 100
                   ELSE ec.weightage
                 END
             ),
             0
           )::numeric
       END AS total
     FROM exam e
     JOIN exam_component ec ON ec.exam_id = e.id
     LEFT JOIN exam_component_marks m
       ON m.exam_component_id = ec.id AND m.student_id = ?
     WHERE e.id = ?
     GROUP BY e.formula_type`,
    [studentId, examId]
  );
  return row ? row.total : 0;
}

async function syncObtainedMarksFromComponents(examId, studentId) {
  const total = await computeExamStudentTotal(examId, studentId);
  await run(`UPDATE exam_student SET obtained_marks = ? WHERE exam_id = ? AND student_id = ?`, [
    total,
    examId,
    studentId,
  ]);
}

async function replaceExamComponents(examId, { formulaType, components }) {
  const ft = formulaType === 'WEIGHTED' ? 'WEIGHTED' : 'SUM';
  const comps = Array.isArray(components) ? components : [];

  // Compute total_marks from component max_marks + formula.
  let totalMarks = 0;
  for (const c of comps) {
    const maxMarks = Number(c.maxMarks ?? c.max_marks ?? 0);
    const weightage = Number(c.weightage ?? c.weightage_value ?? c.weightage_percent ?? 0);
    if (!Number.isFinite(maxMarks) || maxMarks < 0) throw new Error('Invalid component max_marks');
    if (ft === 'SUM') totalMarks += maxMarks;
    else totalMarks += maxMarks * normalizeWeightageNumber(weightage);
  }

  await run(
    `
    DELETE FROM exam_component_marks
    WHERE exam_component_id IN (SELECT id FROM exam_component WHERE exam_id = ?)
    `,
    [examId]
  );
  await run(`DELETE FROM exam_component WHERE exam_id = ?`, [examId]);

  for (const c of comps) {
    const componentName = String(c.componentName ?? c.component_name ?? '').trim();
    const maxMarks = Number(c.maxMarks ?? c.max_marks ?? 0);
    const weightage = Number(c.weightage ?? c.weightage_value ?? c.weightage_percent ?? 0);
    if (!componentName) throw new Error('component_name is required');
    if (!Number.isFinite(maxMarks) || maxMarks < 0) throw new Error('Invalid component max_marks');
    if (!Number.isFinite(weightage) || weightage < 0) throw new Error('Invalid component weightage');
    await run(
      `INSERT INTO exam_component (exam_id, component_name, max_marks, weightage) VALUES (?, ?, ?, ?)`,
      [examId, componentName, maxMarks, weightage]
    );
  }

  await run(`UPDATE exam SET formula_type = ?, total_marks = ? WHERE id = ?`, [ft, totalMarks, examId]);
}

async function recalculateExamSummary(studentId, courseId, attemptNumber = 1) {
  const stu = await get(`SELECT usn FROM students WHERE id = ?`, [studentId]);
  if (!stu) return;
  const pick = async (examType) => {
    const row = await get(
      `SELECT es.obtained_marks FROM exam_student es
       JOIN exam e ON e.id = es.exam_id
       WHERE es.student_id = ? AND e.course_id = ? AND e.exam_type = ?
       ORDER BY e.exam_date DESC NULLS LAST, e.id DESC
       LIMIT 1`,
      [studentId, courseId, examType]
    );
    return row?.obtained_marks ?? null;
  };
  const cie1 = await pick('cie1');
  const cie2 = await pick('cie2');
  const cie3 = await pick('cie3');
  const see = await pick('see');
  await run(
    `INSERT INTO exam_summary (student_id, usn, course_id, cie1_marks, cie2_marks, cie3_marks, see_marks, attempt_number, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON CONFLICT (student_id, course_id, attempt_number)
     DO UPDATE SET
       usn = EXCLUDED.usn,
       cie1_marks = EXCLUDED.cie1_marks,
       cie2_marks = EXCLUDED.cie2_marks,
       cie3_marks = EXCLUDED.cie3_marks,
       see_marks = EXCLUDED.see_marks,
       updated_at = NOW()`,
    [studentId, stu.usn, courseId, cie1, cie2, cie3, see, attemptNumber]
  );
}

module.exports = {
  facultyTeachesSection,
  getSectionCourseId,
  listEnrollmentsForSectionWithIds,
  createExamRow,
  addExamComponent,
  seedExamStudents,
  listExamsForSection,
  listAllExamsAdmin,
  getExamById,
  listExamComponents,
  listExamStudents,
  listAllComponentMarksForExam,
  updateExamStudentRow,
  upsertComponentMark,
  syncObtainedMarksFromComponents,
  replaceExamComponents,
  recalculateExamSummary,
};
