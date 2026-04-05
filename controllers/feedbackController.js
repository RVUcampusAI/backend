const { ok, fail } = require('../utils/apiResponse');
const { get } = require('../db/database');
const attendance = require('../models/attendanceModel');
const feedbackModel = require('../models/feedbackModel');

const Q_TYPES = new Set(['mcq', 'rating', 'text']);

async function adminCreateQuestion(req, res) {
  try {
    const { question_text, question_type, options, label } = req.body || {};
    if (!question_text || !question_type) return fail(res, 'question_text and question_type required', 400);
    if (!Q_TYPES.has(question_type)) return fail(res, 'Invalid question_type', 400);
    const id = await feedbackModel.createQuestion({
      questionText: String(question_text).trim(),
      questionType: question_type,
      options,
      label: label ? String(label).trim() : null,
    });
    const item = await get(`SELECT * FROM feedback_question_bank WHERE id = ?`, [id]);
    return ok(res, 'Question created', { item }, 201);
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to create question', 500);
  }
}

async function adminListQuestions(req, res) {
  try {
    const label = req.query.label ? String(req.query.label) : null;
    const items = await feedbackModel.listQuestionsByLabel(label);
    return ok(res, 'OK', { items });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to list questions', 500);
  }
}

async function adminCreateTemplate(req, res) {
  try {
    const uid = req.user.userId;
    if (!uid) return fail(res, 'Invalid session', 401);
    const { title, description } = req.body || {};
    if (!title || !String(title).trim()) return fail(res, 'title required', 400);
    const id = await feedbackModel.createTemplate({
      title: String(title).trim(),
      description: description ? String(description) : null,
      createdByUserId: uid,
    });
    const item = await feedbackModel.getTemplate(id);
    return ok(res, 'Template created', { item }, 201);
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to create template', 500);
  }
}

async function adminListTemplates(req, res) {
  try {
    const items = await feedbackModel.listTemplates();
    return ok(res, 'OK', { items });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to list templates', 500);
  }
}

async function adminGetTemplateQuestions(req, res) {
  try {
    const templateId = Number(req.params.id);
    const t = await feedbackModel.getTemplate(templateId);
    if (!t) return fail(res, 'Template not found', 404);
    const items = await feedbackModel.listTemplateQuestions(templateId);
    return ok(res, 'OK', { items });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to load template questions', 500);
  }
}

async function adminSetTemplateQuestions(req, res) {
  try {
    const templateId = Number(req.params.id);
    const t = await feedbackModel.getTemplate(templateId);
    if (!t) return fail(res, 'Template not found', 404);
    const { question_ids } = req.body || {};
    if (!Array.isArray(question_ids) || !question_ids.length) {
      return fail(res, 'question_ids[] required', 400);
    }
    await feedbackModel.setTemplateQuestions(
      templateId,
      question_ids.map((x) => Number(x))
    );
    const items = await feedbackModel.listTemplateQuestions(templateId);
    return ok(res, 'Template questions saved', { items });
  } catch (e) {
    console.error(e);
    if (e && e.code === '23505') return fail(res, 'Duplicate order or question in template', 409);
    if (e && e.code === '23503') return fail(res, 'Invalid question id', 400);
    return fail(res, 'Failed to save template questions', 500);
  }
}

async function adminCreateFormInstance(req, res) {
  try {
    const { template_id, faculty_id, course_section_id, start_date, end_date, status } = req.body || {};
    if (!template_id || !faculty_id || !course_section_id || !start_date || !end_date) {
      return fail(res, 'template_id, faculty_id, course_section_id, start_date, end_date required', 400);
    }
    const t = await feedbackModel.getTemplate(Number(template_id));
    if (!t) return fail(res, 'Template not found', 404);
    const id = await feedbackModel.createFormInstance({
      templateId: Number(template_id),
      facultyId: Number(faculty_id),
      courseSectionId: Number(course_section_id),
      startDate: start_date,
      endDate: end_date,
      status: status === 'closed' ? 'closed' : 'active',
    });
    return ok(res, 'Form assigned', { id }, 201);
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to assign form', 500);
  }
}

async function adminFeedbackAnalytics(req, res) {
  try {
    const courseId = Number(req.query.course_id);
    if (!courseId) return fail(res, 'course_id query required', 400);
    const facultyIds = req.query.faculty_ids
      ? String(req.query.faculty_ids)
          .split(',')
          .map((x) => Number(x.trim()))
          .filter((x) => Number.isFinite(x))
      : [];
    const items = await feedbackModel.analyticsByFacultyForCourse(courseId, {
      course_section_id: req.query.course_section_id ? Number(req.query.course_section_id) : null,
      faculty_ids: facultyIds,
      date_from: req.query.date_from ? String(req.query.date_from) : null,
      date_to: req.query.date_to ? String(req.query.date_to) : null,
    });
    return ok(res, 'OK', { items });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to load analytics', 500);
  }
}

async function adminFeedbackResponses(req, res) {
  try {
    const courseId = Number(req.query.course_id);
    if (!courseId) return fail(res, 'course_id query required', 400);
    const items = await feedbackModel.listDetailedResponsesForCourse(courseId, {
      course_section_id: req.query.course_section_id ? Number(req.query.course_section_id) : null,
      faculty_id: req.query.faculty_id ? Number(req.query.faculty_id) : null,
      date_from: req.query.date_from ? String(req.query.date_from) : null,
      date_to: req.query.date_to ? String(req.query.date_to) : null,
    });
    return ok(res, 'OK', { items });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to load responses', 500);
  }
}

async function facultyListForms(req, res) {
  try {
    const fac = await attendance.getFacultyByEmail(req.user.email);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const items = await feedbackModel.listFormsForFaculty(fac.id);
    const withStats = [];
    for (const fi of items) {
      const st = await feedbackModel.formStats(fi.id);
      withStats.push({ ...fi, stats: st });
    }
    return ok(res, 'OK', { items: withStats });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to list forms', 500);
  }
}

async function facultyFormStats(req, res) {
  try {
    const fac = await attendance.getFacultyByEmail(req.user.email);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const formId = Number(req.params.id);
    const items = await feedbackModel.listFormsForFaculty(fac.id);
    if (!items.some((x) => x.id === formId)) return fail(res, 'Form not found', 404);
    const stats = await feedbackModel.formStats(formId);
    return ok(res, 'OK', { stats });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed', 500);
  }
}

async function studentListFeedbackForms(req, res) {
  try {
    const stu = await attendance.getStudentByEmail(req.user.email);
    if (!stu) return fail(res, 'Student profile not found', 404);
    const items = await feedbackModel.listActiveFormsForStudent(stu.id);
    return ok(res, 'OK', { items });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to list forms', 500);
  }
}

async function studentGetFeedbackForm(req, res) {
  try {
    const stu = await attendance.getStudentByEmail(req.user.email);
    if (!stu) return fail(res, 'Student profile not found', 404);
    const formId = Number(req.params.id);
    const form = await feedbackModel.getFormForStudent(formId, stu.id);
    if (!form) return fail(res, 'Form not available', 404);
    const questions = await feedbackModel.listTemplateQuestions(form.template_id);
    const existing = await feedbackModel.getResponse(formId, stu.id);
    let answers = [];
    if (existing) {
      answers = await feedbackModel.listAnswersForResponse(existing.id);
    }
    return ok(res, 'OK', { form, questions, response: existing, answers });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to load form', 500);
  }
}

async function studentSubmitFeedback(req, res) {
  try {
    const stu = await attendance.getStudentByEmail(req.user.email);
    if (!stu) return fail(res, 'Student profile not found', 404);
    const formId = Number(req.params.id);
    const form = await feedbackModel.getFormForStudent(formId, stu.id);
    if (!form) return fail(res, 'Form not available', 404);
    if (form.status !== 'active') return fail(res, 'Form is closed', 400);
    const answers = req.body?.answers;
    if (!Array.isArray(answers)) return fail(res, 'answers[] required', 400);
    const questions = await feedbackModel.listTemplateQuestions(form.template_id);
    const qIds = new Set(questions.map((q) => q.id));
    for (const a of answers) {
      if (!qIds.has(Number(a.question_id))) return fail(res, 'Invalid question in form', 400);
    }
    let resp = await feedbackModel.getResponse(formId, stu.id);
    if (!resp) {
      const rid = await feedbackModel.createResponse(formId, stu.id);
      resp = { id: rid };
    }
    for (const a of answers) {
      await feedbackModel.upsertAnswer(resp.id, Number(a.question_id), a.answer);
    }
    return ok(res, 'Submitted', { response_id: resp.id });
  } catch (e) {
    console.error(e);
    if (e && e.code === '23505') return fail(res, 'Already submitted', 409);
    return fail(res, 'Failed to submit', 500);
  }
}

module.exports = {
  adminCreateQuestion,
  adminListQuestions,
  adminCreateTemplate,
  adminListTemplates,
  adminGetTemplateQuestions,
  adminSetTemplateQuestions,
  adminCreateFormInstance,
  adminFeedbackAnalytics,
  adminFeedbackResponses,
  facultyListForms,
  facultyFormStats,
  studentListFeedbackForms,
  studentGetFeedbackForm,
  studentSubmitFeedback,
};
