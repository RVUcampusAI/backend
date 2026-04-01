const { getCourseWithGroup, getBatchWithProgram } = require('../models/academicModel');

async function assertValidCourseOffering(courseId, batchId) {
  const courseRow = await getCourseWithGroup(courseId);
  const batchRow = await getBatchWithProgram(batchId);
  if (!courseRow) return { ok: false, message: 'Course not found' };
  if (!batchRow) return { ok: false, message: 'Batch not found' };
  if (courseRow.cg_program_id != null) {
    if (batchRow.program_id !== courseRow.cg_program_id) {
      return {
        ok: false,
        message: 'Batch must belong to the same program as the course group',
      };
    }
  } else if (batchRow.program_school_id !== courseRow.cg_school_id) {
    return {
      ok: false,
      message: 'When course group has no program, batch program must be under the same school',
    };
  }
  return { ok: true };
}

module.exports = { assertValidCourseOffering };
