const { ok, fail } = require('../utils/apiResponse');
const attendance = require('../models/attendanceModel');

async function getEnrollments(req, res) {
  try {
    const stu = await attendance.getStudentByEmail(req.user.email);
    if (!stu) return fail(res, 'Student profile not found for this account', 404);
    const items = await attendance.listStudentEnrollmentsWithCourses(stu.id);
    return ok(res, 'OK', { items });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to load enrollments', 500);
  }
}

async function getAttendanceSummary(req, res) {
  try {
    const stu = await attendance.getStudentByEmail(req.user.email);
    if (!stu) return fail(res, 'Student profile not found', 404);
    const items = await attendance.listStudentAttendanceSummary(stu.id);
    return ok(res, 'OK', { items });
  } catch (e) {
    console.error(e);
    return fail(res, 'Failed to load attendance', 500);
  }
}

module.exports = { getEnrollments, getAttendanceSummary };
