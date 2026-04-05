const { ok, fail } = require('../utils/apiResponse');
const attendance = require('../models/attendanceModel');
const academic = require('../models/academicModel');

const SESSION_TYPES = new Set(['L', 'T', 'P']);
const STATUSES = new Set(['present', 'absent', 'leave']);

async function getLookups(req, res) {
  try {
    const fac = await attendance.getFacultyByEmail(req.user.email);
    if (!fac) return fail(res, 'Faculty profile not found for this account', 404);
    const [schools, programs, batches, courseGroups, courses, offerings, sections] = await Promise.all([
      academic.listSchools(),
      academic.listPrograms(),
      academic.listBatches(),
      academic.listCourseGroups(),
      academic.listCourses(),
      academic.listCourseOfferings(),
      academic.listCourseSections(),
    ]);
    return ok(res, 'OK', {
      faculty_id: fac.id,
      schools,
      programs,
      batches,
      courseGroups,
      courses,
      offerings,
      sections,
    });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to load lookups', 500);
  }
}

async function getMySections(req, res) {
  try {
    const fac = await attendance.getFacultyByEmail(req.user.email);
    if (!fac) return fail(res, 'Faculty profile not found for this account', 404);
    const items = await attendance.listFacultySectionMappings(fac.id);
    return ok(res, 'OK', { items, faculty_id: fac.id });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to load sections', 500);
  }
}

async function createSession(req, res) {
  try {
    const fac = await attendance.getFacultyByEmail(req.user.email);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const { course_offering_faculty_id, session_date, start_time, end_time, session_type } = req.body || {};
    if (!course_offering_faculty_id || !session_date || !start_time || !end_time || !session_type) {
      return fail(res, 'course_offering_faculty_id, session_date, start_time, end_time, session_type required', 400);
    }
    const st = String(session_type).toUpperCase();
    if (!SESSION_TYPES.has(st)) return fail(res, 'session_type must be L, T, or P', 400);

    const mappings = await attendance.listFacultySectionMappings(fac.id);
    const allowed = mappings.some(
      (m) => Number(m.course_offering_faculty_id) === Number(course_offering_faculty_id)
    );
    if (!allowed) return fail(res, 'Invalid faculty mapping for this session', 403);

    const dupCof = await attendance.findClassSessionDuplicateForCof(
      course_offering_faculty_id,
      session_date,
      start_time,
      end_time
    );
    if (dupCof) {
      return fail(res, 'A class session already exists for this faculty slot (same date and time)', 409);
    }
    const sectionId = await attendance.getCourseSectionIdForCof(course_offering_faculty_id);
    const dupSection = await attendance.findClassSessionSlotConflict(
      sectionId,
      session_date,
      start_time,
      end_time
    );
    if (dupSection) {
      return fail(
        res,
        'This section already has a class session at the same date and time (all faculty share the section calendar)',
        409
      );
    }

    let id;
    try {
      id = await attendance.createClassSession({
        courseOfferingFacultyId: course_offering_faculty_id,
        sessionDate: session_date,
        startTime: start_time,
        endTime: end_time,
        sessionType: st,
      });
    } catch (e) {
      if (e && e.code === '23505') {
        return fail(res, 'Duplicate class session violates database constraint', 409);
      }
      throw e;
    }
    const created = await attendance.getClassSession(id);
    return ok(res, 'Session created', { item: created }, 201);
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to create session', 500);
  }
}

async function listSessions(req, res) {
  try {
    const fac = await attendance.getFacultyByEmail(req.user.email);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const cofId = Number(req.query.course_offering_faculty_id);
    if (!cofId) return fail(res, 'course_offering_faculty_id query required', 400);
    const mappings = await attendance.listFacultySectionMappings(fac.id);
    const allowed = mappings.some((m) => Number(m.course_offering_faculty_id) === cofId);
    if (!allowed) return fail(res, 'Invalid faculty mapping', 403);
    const items = await attendance.listClassSessionsForFacultyMapping(cofId);
    return ok(res, 'OK', { items });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to list sessions', 500);
  }
}

async function listSectionStudents(req, res) {
  try {
    const fac = await attendance.getFacultyByEmail(req.user.email);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const sectionId = Number(req.params.sectionId);
    const mappings = await attendance.listFacultySectionMappings(fac.id);
    const allowed = mappings.some((m) => Number(m.course_section_id) === sectionId);
    if (!allowed) return fail(res, 'No access to this section', 403);
    const items = await attendance.listEnrolledStudentsForSection(sectionId);
    return ok(res, 'OK', { items });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to list students', 500);
  }
}

async function getSessionAttendance(req, res) {
  try {
    const fac = await attendance.getFacultyByEmail(req.user.email);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const sessionId = Number(req.params.sessionId);
    const okOwn = await attendance.assertSessionOwnedByFaculty(sessionId, fac.id);
    if (!okOwn) return fail(res, 'Session not found', 404);
    const items = await attendance.listAttendanceForSession(sessionId);
    return ok(res, 'OK', { items });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to load attendance', 500);
  }
}

async function saveAttendance(req, res) {
  try {
    const fac = await attendance.getFacultyByEmail(req.user.email);
    if (!fac) return fail(res, 'Faculty profile not found', 404);
    const sessionId = Number(req.body?.class_session_id);
    const rows = req.body?.rows;
    if (!sessionId || !Array.isArray(rows)) {
      return fail(res, 'class_session_id and rows[] array required', 400);
    }
    const okOwn = await attendance.assertSessionOwnedByFaculty(sessionId, fac.id);
    if (!okOwn) return fail(res, 'Session not found', 404);

    const sess = await attendance.getClassSession(sessionId);
    const cofRow = await attendance.listFacultySectionMappings(fac.id);
    const cof = cofRow.find((m) => Number(m.course_offering_faculty_id) === Number(sess.course_offering_faculty_id));
    if (!cof) return fail(res, 'Invalid session', 403);
    const sectionId = cof.course_section_id;

    const enrolled = await attendance.listEnrolledStudentsForSection(sectionId);
    const allowedIds = new Set(enrolled.map((s) => s.id));
    const byStudent = new Map(rows.map((r) => [Number(r.student_id), r.status]));

    for (const r of rows) {
      const sid = Number(r.student_id);
      if (!allowedIds.has(sid)) {
        return fail(res, `Student ${sid} is not enrolled in this section`, 400);
      }
      if (!STATUSES.has(r.status)) {
        return fail(res, 'Each row needs status: present, absent, or leave', 400);
      }
    }

    for (const s of enrolled) {
      const status = byStudent.has(s.id) ? byStudent.get(s.id) : 'absent';
      if (!STATUSES.has(status)) {
        return fail(res, 'Each row needs status: present, absent, or leave', 400);
      }
      await attendance.upsertAttendance({ studentId: s.id, classSessionId: sessionId, status });
    }

    const items = await attendance.listAttendanceForSession(sessionId);
    return ok(res, 'Attendance saved', { items, saved_count: enrolled.length });
  } catch (e) {
    console.error(e);
    if (e && e.code === '23505') {
      return fail(res, 'Duplicate attendance row (student + session must be unique)', 409);
    }
    return fail(res, 'Failed to save attendance', 500);
  }
}

module.exports = {
  getLookups,
  getMySections,
  createSession,
  listSessions,
  listSectionStudents,
  getSessionAttendance,
  saveAttendance,
};
