const academic = require('../models/academicModel');

async function validateStudentAffiliation({
  school_id,
  program_id,
  batch_id,
  major_id,
  minor_id,
  specialization_id,
}) {
  const sid = school_id ?? null;
  const pid = program_id ?? null;
  const bid = batch_id ?? null;

  if (pid && sid) {
    const prog = await academic.getProgram(pid);
    if (!prog) return { ok: false, message: 'Program not found' };
    if (prog.school_id !== sid) {
      return { ok: false, message: 'Program must belong to the selected school' };
    }
  }

  if (bid && pid) {
    const batch = await academic.getBatch(bid);
    if (!batch) return { ok: false, message: 'Batch not found' };
    if (batch.program_id !== pid) {
      return { ok: false, message: 'Batch must belong to the selected program' };
    }
  }

  async function checkCg(cgId, expectedTrack) {
    if (!cgId) return { ok: true };
    const cg = await academic.getCourseGroup(cgId);
    if (!cg) return { ok: false, message: 'Course group not found' };
    if (cg.track !== expectedTrack) {
      return {
        ok: false,
        message: `Selected course group must have track "${expectedTrack}"`,
      };
    }
    if (sid && cg.school_id !== sid) {
      return { ok: false, message: 'Course group must belong to the student school' };
    }
    if (pid && cg.program_id != null && cg.program_id !== pid) {
      return { ok: false, message: 'Course group must match the student program' };
    }
    return { ok: true };
  }

  for (const [cgId, track] of [
    [major_id, 'major'],
    [minor_id, 'minor'],
    [specialization_id, 'specialization'],
  ]) {
    const r = await checkCg(cgId, track);
    if (!r.ok) return r;
  }

  return { ok: true };
}

module.exports = { validateStudentAffiliation };
