const { run, get, all } = require('../db/database');

async function createQuestion({ questionText, questionType, options, label }) {
  const optJson =
    options == null ? null : typeof options === 'string' ? options : JSON.stringify(options);
  const r = await run(
    `INSERT INTO feedback_question_bank (question_text, question_type, options, label)
     VALUES (?, ?, CAST(? AS JSONB), ?)`,
    [questionText, questionType, optJson, label || null]
  );
  return r.lastID;
}

async function listQuestionsByLabel(label) {
  if (label) {
    return await all(
      `SELECT * FROM feedback_question_bank WHERE label = ? ORDER BY id DESC`,
      [label]
    );
  }
  return await all(`SELECT * FROM feedback_question_bank ORDER BY id DESC`);
}

async function createTemplate({ title, description, createdByUserId }) {
  const r = await run(
    `INSERT INTO feedback_template (title, description, created_by_user_id) VALUES (?, ?, ?)`,
    [title, description || null, createdByUserId]
  );
  return r.lastID;
}

async function listTemplates() {
  return await all(`SELECT * FROM feedback_template ORDER BY id DESC`);
}

async function getTemplate(id) {
  return await get(`SELECT * FROM feedback_template WHERE id = ?`, [id]);
}

async function setTemplateQuestions(templateId, orderedQuestionIds) {
  await run(`DELETE FROM feedback_template_questions WHERE template_id = ?`, [templateId]);
  let idx = 0;
  for (const qid of orderedQuestionIds) {
    idx += 1;
    await run(
      `INSERT INTO feedback_template_questions (template_id, question_id, order_index) VALUES (?, ?, ?)`,
      [templateId, qid, idx]
    );
  }
}

async function listTemplateQuestions(templateId) {
  return await all(
    `SELECT q.*, ftq.order_index
     FROM feedback_template_questions ftq
     JOIN feedback_question_bank q ON q.id = ftq.question_id
     WHERE ftq.template_id = ?
     ORDER BY ftq.order_index`,
    [templateId]
  );
}

async function createFormInstance({
  templateId,
  facultyId,
  courseSectionId,
  startDate,
  endDate,
  status,
}) {
  const r = await run(
    `INSERT INTO feedback_form_instance (template_id, faculty_id, course_section_id, start_date, end_date, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [templateId, facultyId, courseSectionId, startDate, endDate, status || 'active']
  );
  return r.lastID;
}

async function listFormsForFaculty(facultyId) {
  return await all(
    `SELECT fi.*, t.title AS template_title, cs.section_name, c.course_code, c.course_name
     FROM feedback_form_instance fi
     JOIN feedback_template t ON t.id = fi.template_id
     JOIN course_section cs ON cs.id = fi.course_section_id
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN course c ON c.id = co.course_id
     WHERE fi.faculty_id = ?
     ORDER BY fi.id DESC`,
    [facultyId]
  );
}

async function formStats(formId) {
  const sectionRow = await get(`SELECT course_section_id FROM feedback_form_instance WHERE id = ?`, [formId]);
  if (!sectionRow) return null;
  const total = await get(
    `SELECT COUNT(*)::int AS c FROM student_enrollment WHERE course_section_id = ?`,
    [sectionRow.course_section_id]
  );
  const submitted = await get(
    `SELECT COUNT(*)::int AS c FROM feedback_response WHERE form_id = ?`,
    [formId]
  );
  const tc = total?.c ?? 0;
  const sc = submitted?.c ?? 0;
  return { total_students: tc, submitted: sc, pending: Math.max(0, tc - sc) };
}

async function listActiveFormsForStudent(studentId) {
  return await all(
    `SELECT fi.*, t.title, t.description, c.course_code, cs.section_name,
            r.id AS response_id
     FROM student_enrollment se
     JOIN feedback_form_instance fi ON fi.course_section_id = se.course_section_id
     JOIN feedback_template t ON t.id = fi.template_id
     JOIN course_section cs ON cs.id = fi.course_section_id
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN course c ON c.id = co.course_id
     LEFT JOIN feedback_response r
       ON r.form_id = fi.id AND r.student_id = se.student_id
     WHERE se.student_id = ?
       AND fi.status = 'active'
       AND fi.start_date <= CURRENT_DATE
       AND fi.end_date >= CURRENT_DATE
     ORDER BY fi.end_date ASC`
  );
}

async function getFormForStudent(formId, studentId) {
  const row = await get(
    `SELECT fi.*, t.title, t.description
     FROM feedback_form_instance fi
     JOIN feedback_template t ON t.id = fi.template_id
     JOIN student_enrollment se ON se.course_section_id = fi.course_section_id AND se.student_id = ?
     WHERE fi.id = ?`,
    [studentId, formId]
  );
  return row;
}

async function getResponse(formId, studentId) {
  return await get(`SELECT * FROM feedback_response WHERE form_id = ? AND student_id = ?`, [formId, studentId]);
}

async function createResponse(formId, studentId) {
  const r = await run(`INSERT INTO feedback_response (form_id, student_id) VALUES (?, ?)`, [formId, studentId]);
  return r.lastID;
}

async function upsertAnswer(responseId, questionId, answer) {
  const text = typeof answer === 'string' ? answer : JSON.stringify(answer ?? '');
  await run(
    `INSERT INTO feedback_answers (response_id, question_id, answer) VALUES (?, ?, ?)
     ON CONFLICT (response_id, question_id) DO UPDATE SET answer = EXCLUDED.answer`,
    [responseId, questionId, text]
  );
}

async function listAnswersForResponse(responseId) {
  return await all(`SELECT * FROM feedback_answers WHERE response_id = ?`, [responseId]);
}

async function analyticsByFacultyForCourse(courseId, opts = {}) {
  const where = [`co.course_id = ?`, `fq.question_type = 'rating'`];
  const params = [courseId];

  if (opts.course_section_id) {
    where.push(`cs.id = ?`);
    params.push(Number(opts.course_section_id));
  }
  if (opts.faculty_ids && Array.isArray(opts.faculty_ids) && opts.faculty_ids.length) {
    const ids = opts.faculty_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x));
    if (ids.length) {
      where.push(`fi.faculty_id IN (${ids.map(() => '?').join(',')})`);
      params.push(...ids);
    }
  }
  if (opts.date_from) {
    where.push(`fr.submitted_at >= CAST(? AS timestamptz)`);
    params.push(`${opts.date_from}T00:00:00Z`);
  }
  if (opts.date_to) {
    where.push(`fr.submitted_at <= CAST(? AS timestamptz)`);
    params.push(`${opts.date_to}T23:59:59Z`);
  }

  return await all(
    `SELECT fi.faculty_id, f.name AS faculty_name, fq.id AS question_id, fq.question_text, fq.question_type,
            AVG(
              CASE
                WHEN fq.question_type = 'rating' AND fa.answer ~ '^[0-9]+(\\.[0-9]+)?$' THEN fa.answer::numeric
                ELSE NULL
              END
            ) AS avg_rating,
            COUNT(fa.id) AS answer_count
     FROM feedback_form_instance fi
     JOIN faculty f ON f.id = fi.faculty_id
     JOIN course_section cs ON cs.id = fi.course_section_id
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN feedback_response fr ON fr.form_id = fi.id
     JOIN feedback_answers fa ON fa.response_id = fr.id
     JOIN feedback_question_bank fq ON fq.id = fa.question_id
     WHERE ${where.join(' AND ')}
     GROUP BY fi.faculty_id, f.name, fq.id, fq.question_text, fq.question_type
     ORDER BY f.name, fq.question_text`,
    params
  );
}

async function listDetailedResponsesForCourse(courseId, opts = {}) {
  const where = [`co.course_id = ?`];
  const params = [courseId];

  if (opts.course_section_id) {
    where.push(`cs.id = ?`);
    params.push(Number(opts.course_section_id));
  }
  if (opts.faculty_id) {
    where.push(`fi.faculty_id = ?`);
    params.push(Number(opts.faculty_id));
  }
  if (opts.date_from) {
    where.push(`fr.submitted_at >= CAST(? AS timestamptz)`);
    params.push(`${opts.date_from}T00:00:00Z`);
  }
  if (opts.date_to) {
    where.push(`fr.submitted_at <= CAST(? AS timestamptz)`);
    params.push(`${opts.date_to}T23:59:59Z`);
  }

  return await all(
    `SELECT
       fr.id AS response_id,
       fr.submitted_at,
       fi.id AS form_id,
       fi.faculty_id,
       f.name AS faculty_name,
       cs.id AS course_section_id,
       cs.section_name,
       s.id AS student_id,
       s.usn,
       s.name AS student_name,
       fq.id AS question_id,
       fq.question_text,
       fq.question_type,
       fa.answer
     FROM feedback_response fr
     JOIN feedback_form_instance fi ON fi.id = fr.form_id
     JOIN faculty f ON f.id = fi.faculty_id
     JOIN course_section cs ON cs.id = fi.course_section_id
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN students s ON s.id = fr.student_id
     JOIN feedback_answers fa ON fa.response_id = fr.id
     JOIN feedback_question_bank fq ON fq.id = fa.question_id
     WHERE ${where.join(' AND ')}
     ORDER BY fr.submitted_at DESC, fr.id DESC, fq.id ASC`,
    params
  );
}

module.exports = {
  createQuestion,
  listQuestionsByLabel,
  createTemplate,
  listTemplates,
  getTemplate,
  setTemplateQuestions,
  listTemplateQuestions,
  createFormInstance,
  listFormsForFaculty,
  formStats,
  listActiveFormsForStudent,
  getFormForStudent,
  getResponse,
  createResponse,
  upsertAnswer,
  listAnswersForResponse,
  analyticsByFacultyForCourse,
  listDetailedResponsesForCourse,
};
