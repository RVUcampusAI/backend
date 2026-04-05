const { ok, fail } = require('../utils/apiResponse');
const { get } = require('../db/database');
const attendance = require('../models/attendanceModel');
const examModel = require('../models/examModel');

const EXAM_TYPES = new Set(['cie1', 'cie2', 'cie3', 'see']);
const EXAM_MODES = new Set(['online', 'offline']);
const FORMULA_TYPES = new Set(['SUM', 'WEIGHTED']);
const ST = new Set(['present', 'absent']);

function normalizeFormulaType(input) {
  const v = String(input ?? '').toUpperCase();
  return FORMULA_TYPES.has(v) ? v : null;
}

function normalizeComponentWeightage(weightage) {
  const w = Number(weightage);
  if (!Number.isFinite(w) || w < 0) return 0;
  // Accept either multiplier (0..1) or percentage (0..100).
  if (w <= 1) return w;
  if (w <= 100) return w / 100;
  return w;
}

async function resolveFaculty(req) {
  const fac = await attendance.getFacultyByEmail(req.user.email);
  if (!fac) return null;
  return fac;
}

async function assertFacultyExamAccess(facultyId, exam) {
  if (!exam) return false;
  return examModel.facultyTeachesSection(facultyId, exam.course_section_id);
}

async function createExam(req, res) {
  try {
    const fac = await resolveFaculty(req);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const {
      course_section_id,
      exam_type,
      exam_mode,
      exam_date,
      components,
      formula_type,
      course_id,
    } = req.body || {};
    if (!course_section_id || !exam_type || !exam_mode || !exam_date) {
      return fail(res, 'course_section_id, exam_type, exam_mode, exam_date required', 400);
    }
    if (!EXAM_TYPES.has(exam_type)) return fail(res, 'Invalid exam_type', 400);
    if (!EXAM_MODES.has(exam_mode)) return fail(res, 'Invalid exam_mode', 400);
    const okTeach = await examModel.facultyTeachesSection(fac.id, course_section_id);
    if (!okTeach) return fail(res, 'You are not assigned to this section', 403);
    const sectionCourseId = await examModel.getSectionCourseId(course_section_id);
    if (!sectionCourseId) return fail(res, 'Invalid course_section_id', 400);
    if (course_id != null && Number(sectionCourseId) !== Number(course_id)) {
      return fail(res, 'course_id does not match this section offering', 400);
    }
    const formulaType = normalizeFormulaType(formula_type) || 'SUM';

    // total_marks is auto-computed from component max_marks (if components are provided).
    let initialTotalMarks = 0;
    const parsedComponents = Array.isArray(components) ? components : [];
    if (parsedComponents.length) {
      for (const c of parsedComponents) {
        const maxMarks = Number(c.max_marks ?? c.maxMarks ?? 0);
        const weightage = Number(c.weightage ?? c.weightage_percent ?? c.weightage_value ?? 0);
        if (!Number.isFinite(maxMarks) || maxMarks < 0) return fail(res, 'Invalid component max_marks', 400);
        if (formulaType === 'SUM') initialTotalMarks += maxMarks;
        else initialTotalMarks += maxMarks * normalizeComponentWeightage(weightage);
      }
    }

    const examId = await examModel.createExamRow({
      courseId: sectionCourseId,
      courseSectionId: course_section_id,
      examType: exam_type,
      examMode: exam_mode,
      formulaType,
      totalMarks: initialTotalMarks,
      examDate: exam_date,
      createdByFacultyId: fac.id,
    });

    // Optional step: create components at exam creation time.
    if (parsedComponents.length) {
      const comps = parsedComponents
        .map((c) => ({
          componentName: String(c.component_name ?? c.componentName ?? '').trim(),
          maxMarks: Number(c.max_marks ?? c.maxMarks ?? 0),
          weightage: Number(c.weightage ?? c.weightage_percent ?? c.weightage_value ?? 0),
        }))
        .filter((c) => !!c.componentName);

      if (comps.length) {
        await examModel.replaceExamComponents(examId, { formulaType, components: comps });
      }
    }

    const enrollments = await examModel.listEnrollmentsForSectionWithIds(course_section_id);
    await examModel.seedExamStudents(examId, enrollments);

    const exam = await examModel.getExamById(examId);
    const comps = await examModel.listExamComponents(examId);
    const students = await examModel.listExamStudents(examId);
    return ok(res, 'Exam created', { item: exam, components: comps, exam_students: students }, 201);
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to create exam', 500);
  }
}

async function addExamComponents(req, res) {
  try {
    const fac = await resolveFaculty(req);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const examId = Number(req.params.id);
    const exam = await examModel.getExamById(examId);
    if (!exam) return fail(res, 'Exam not found', 404);
    if (!(await assertFacultyExamAccess(fac.id, exam))) return fail(res, 'Exam not found', 404);

    const { formula_type, components } = req.body || {};
    if (!Array.isArray(components) || !components.length) return fail(res, 'components[] required', 400);

    const formulaType = normalizeFormulaType(formula_type) || exam.formula_type || 'SUM';

    const comps = components
      .map((c) => ({
        componentName: String(c.component_name ?? c.componentName ?? '').trim(),
        maxMarks: Number(c.max_marks ?? c.maxMarks ?? 0),
        weightage: Number(c.weightage ?? c.weightage_percent ?? c.weightage_value ?? 0),
      }))
      .filter((c) => !!c.componentName);

    if (!comps.length) return fail(res, 'At least one valid component row is required', 400);

    await examModel.replaceExamComponents(examId, { formulaType, components: comps });

    // Update obtained totals + exam summary for all students in this exam.
    const students = await examModel.listExamStudents(examId);
    for (const s of students) {
      await examModel.syncObtainedMarksFromComponents(examId, Number(s.student_id));
      await examModel.recalculateExamSummary(Number(s.student_id), exam.course_id, 1);
    }

    const updated = await examModel.getExamById(examId);
    const updatedComponents = await examModel.listExamComponents(examId);
    const updatedStudents = await examModel.listExamStudents(examId);
    return ok(res, 'Components saved', { item: updated, components: updatedComponents, exam_students: updatedStudents });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to save components', 500);
  }
}

async function listExamsForSection(req, res) {
  try {
    const fac = await resolveFaculty(req);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const sectionId = Number(req.query.course_section_id);
    if (!sectionId) return fail(res, 'course_section_id query required', 400);
    const okTeach = await examModel.facultyTeachesSection(fac.id, sectionId);
    if (!okTeach) return fail(res, 'No access to this section', 403);
    const items = await examModel.listExamsForSection(sectionId);
    return ok(res, 'OK', { items });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to list exams', 500);
  }
}

async function getExamDetail(req, res) {
  try {
    const fac = await resolveFaculty(req);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const examId = Number(req.params.id);
    const exam = await examModel.getExamById(examId);
    if (!(await assertFacultyExamAccess(fac.id, exam))) return fail(res, 'Exam not found', 404);
    const components = await examModel.listExamComponents(examId);
    const examStudents = await examModel.listExamStudents(examId);
    const compMarks = await examModel.listAllComponentMarksForExam(examId);
    for (const s of examStudents) {
      for (const m of compMarks) {
        if (Number(m.student_id) === Number(s.student_id)) {
          s[`comp_${m.exam_component_id}`] = m.marks_obtained;
        }
      }
    }
    return ok(res, 'OK', { item: exam, components, exam_students: examStudents });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to load exam', 500);
  }
}

async function patchExamStudents(req, res) {
  try {
    const fac = await resolveFaculty(req);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const examId = Number(req.params.id);
    const exam = await examModel.getExamById(examId);
    if (!(await assertFacultyExamAccess(fac.id, exam))) return fail(res, 'Exam not found', 404);
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || !rows.length) {
      return fail(res, 'rows[] required', 400);
    }
    const allowed = new Set((await examModel.listExamStudents(examId)).map((r) => r.id));
    const studentIds = new Set();
    for (const r of rows) {
      const id = Number(r.exam_student_id);
      if (!allowed.has(id)) return fail(res, 'Invalid exam_student_id', 400);
      if (r.status != null && !ST.has(r.status)) return fail(res, 'status must be present or absent', 400);
      await examModel.updateExamStudentRow(id, {
        status: r.status,
        attendance_percentage:
          r.attendance_percentage != null ? Number(r.attendance_percentage) : undefined,
        attempt_number: r.attempt_number != null ? Number(r.attempt_number) : undefined,
      });
      const sid = Number(r.student_id);
      if (!Number.isNaN(sid)) studentIds.add(sid);
      else {
        const row = await get(`SELECT student_id FROM exam_student WHERE id = ?`, [id]);
        if (row) studentIds.add(row.student_id);
      }
    }
    for (const sid of studentIds) {
      await examModel.recalculateExamSummary(sid, exam.course_id, 1);
    }
    const examStudents = await examModel.listExamStudents(examId);
    return ok(res, 'Updated', { exam_students: examStudents });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to update exam students', 500);
  }
}

async function patchExamStudentByRow(req, res) {
  try {
    const fac = await resolveFaculty(req);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const examId = Number(req.params.examId);
    const exam = await examModel.getExamById(examId);
    if (!(await assertFacultyExamAccess(fac.id, exam))) return fail(res, 'Exam not found', 404);
    const rows = await examModel.listExamStudents(examId);
    const target = rows.find((x) => Number(x.student_id) === Number(req.params.studentId));
    if (!target) return fail(res, 'Student not in this exam', 404);
    const { status, attendance_percentage, attempt_number } = req.body || {};
    if (status != null && !ST.has(status)) return fail(res, 'status must be present or absent', 400);
    await examModel.updateExamStudentRow(target.id, {
      status,
      attendance_percentage: attendance_percentage != null ? Number(attendance_percentage) : undefined,
      attempt_number: attempt_number != null ? Number(attempt_number) : undefined,
    });
    await examModel.recalculateExamSummary(target.student_id, exam.course_id, 1);
    const examStudents = await examModel.listExamStudents(examId);
    return ok(res, 'Updated', { exam_students: examStudents });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to update', 500);
  }
}

async function putComponentMarks(req, res) {
  try {
    const fac = await resolveFaculty(req);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const componentId = Number(req.params.componentId);
    const compRow = await get(
      `SELECT ec.exam_id, e.course_section_id, e.course_id, ec.max_marks
       FROM exam_component ec
       JOIN exam e ON e.id = ec.exam_id
       WHERE ec.id = ?`,
      [componentId]
    );
    if (!compRow) return fail(res, 'Component not found', 404);
    if (!(await examModel.facultyTeachesSection(fac.id, compRow.course_section_id))) {
      return fail(res, 'Forbidden', 403);
    }
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || !rows.length) return fail(res, 'rows[] required', 400);
    const examId = compRow.exam_id;
    const maxMarks = compRow.max_marks != null ? Number(compRow.max_marks) : null;
    for (const r of rows) {
      const sid = Number(r.student_id);
      const marksObtained = Number(r.marks_obtained ?? 0);
      if (!Number.isFinite(sid) || Number.isNaN(sid)) return fail(res, 'Invalid student_id', 400);
      if (!Number.isFinite(marksObtained) || marksObtained < 0) return fail(res, 'marks_obtained must be >= 0', 400);
      if (maxMarks != null && Number.isFinite(maxMarks) && marksObtained > maxMarks) {
        return fail(res, `marks_obtained cannot exceed max_marks (${maxMarks})`, 400);
      }
      await examModel.upsertComponentMark(componentId, sid, marksObtained);
      await examModel.syncObtainedMarksFromComponents(examId, sid);
    }
    const exam = await examModel.getExamById(examId);
    for (const r of rows) {
      await examModel.recalculateExamSummary(Number(r.student_id), exam.course_id, 1);
    }
    return ok(res, 'Marks saved', {});
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to save component marks', 500);
  }
}

async function postRecalculateSummary(req, res) {
  try {
    const fac = await resolveFaculty(req);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const examId = Number(req.params.id);
    const exam = await examModel.getExamById(examId);
    if (!(await assertFacultyExamAccess(fac.id, exam))) return fail(res, 'Exam not found', 404);
    const students = await examModel.listExamStudents(examId);
    for (const s of students) {
      await examModel.recalculateExamSummary(s.student_id, exam.course_id, 1);
    }
    return ok(res, 'Summary recalculated', {});
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed', 500);
  }
}

async function listExamsAdmin(req, res) {
  try {
    const items = await examModel.listAllExamsAdmin();
    return ok(res, 'OK', { items });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to list exams', 500);
  }
}

module.exports = {
  createExam,
  addExamComponents,
  listExamsForSection,
  getExamDetail,
  patchExamStudents,
  patchExamStudentByRow,
  putComponentMarks,
  postRecalculateSummary,
  listExamsAdmin,
};
