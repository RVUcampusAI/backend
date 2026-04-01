const { ok, fail } = require('../utils/apiResponse');
const academic = require('../models/academicModel');
const studentModel = require('../models/studentModel');
const { assertValidCourseOffering } = require('../services/courseOfferingValidation');
const { validateStudentAffiliation } = require('../services/studentAffiliationValidator');

const TRACKS = new Set(['core', 'minor', 'major', 'specialization', 'elective']);

function handleDbError(res, e, fallback = 'Operation failed') {
  if (e && e.message && e.message.includes('UNIQUE')) {
    return fail(res, 'Duplicate value violates unique constraint', 409);
  }
  if (e && e.message && e.message.includes('FOREIGN KEY')) {
    return fail(res, 'Invalid reference or related data prevents this action', 409);
  }
  console.error(e);
  return fail(res, fallback, 500);
}

async function listUniversities(req, res) {
  try {
    const rows = await academic.listUniversities();
    return ok(res, 'OK', { items: rows });
  } catch (e) {
    return handleDbError(res, e, 'Failed to list universities');
  }
}

async function createUniversity(req, res) {
  try {
    const { name, abbreviation, address, email, phone, website } = req.body || {};
    if (!name || !String(name).trim()) return fail(res, 'name is required');
    const id = await academic.createUniversity({
      name: name.trim(),
      abbreviation,
      address,
      email,
      phone,
      website,
    });
    const row = await academic.getUniversity(id);
    return ok(res, 'University created', { item: row }, 201);
  } catch (e) {
    return handleDbError(res, e, 'Failed to create university');
  }
}

async function updateUniversity(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getUniversity(id);
    if (!existing) return fail(res, 'Not found', 404);
    const { name, abbreviation, address, email, phone, website } = req.body || {};
    if (!name || !String(name).trim()) return fail(res, 'name is required');
    await academic.updateUniversity(id, {
      name: name.trim(),
      abbreviation,
      address,
      email,
      phone,
      website,
    });
    const row = await academic.getUniversity(id);
    return ok(res, 'University updated', { item: row });
  } catch (e) {
    return handleDbError(res, e, 'Failed to update university');
  }
}

async function deleteUniversity(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getUniversity(id);
    if (!existing) return fail(res, 'Not found', 404);
    await academic.deleteUniversity(id);
    return ok(res, 'University deleted', {});
  } catch (e) {
    return handleDbError(res, e, 'Failed to delete university');
  }
}

async function listCampuses(req, res) {
  try {
    const rows = await academic.listCampuses();
    return ok(res, 'OK', { items: rows });
  } catch (e) {
    return handleDbError(res, e, 'Failed to list campuses');
  }
}

async function createCampus(req, res) {
  try {
    const { university_id, name, abbreviation, address } = req.body || {};
    if (!university_id || !name || !String(name).trim()) {
      return fail(res, 'university_id and name are required');
    }
    const id = await academic.createCampus({
      university_id,
      name: name.trim(),
      abbreviation,
      address,
    });
    const row = await academic.getCampus(id);
    return ok(res, 'Campus created', { item: row }, 201);
  } catch (e) {
    return handleDbError(res, e, 'Failed to create campus');
  }
}

async function updateCampus(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getCampus(id);
    if (!existing) return fail(res, 'Not found', 404);
    const { university_id, name, abbreviation, address } = req.body || {};
    if (!university_id || !name || !String(name).trim()) {
      return fail(res, 'university_id and name are required');
    }
    await academic.updateCampus(id, {
      university_id,
      name: name.trim(),
      abbreviation,
      address,
    });
    const row = await academic.getCampus(id);
    return ok(res, 'Campus updated', { item: row });
  } catch (e) {
    return handleDbError(res, e, 'Failed to update campus');
  }
}

async function deleteCampus(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getCampus(id);
    if (!existing) return fail(res, 'Not found', 404);
    await academic.deleteCampus(id);
    return ok(res, 'Campus deleted', {});
  } catch (e) {
    return handleDbError(res, e, 'Failed to delete campus');
  }
}

async function listSchools(req, res) {
  try {
    const rows = await academic.listSchools();
    return ok(res, 'OK', { items: rows });
  } catch (e) {
    return handleDbError(res, e, 'Failed to list schools');
  }
}

async function createSchool(req, res) {
  try {
    const { campus_id, name, abbreviation } = req.body || {};
    if (!campus_id || !name || !String(name).trim()) return fail(res, 'campus_id and name are required');
    const id = await academic.createSchool({
      campus_id,
      name: name.trim(),
      abbreviation,
    });
    const row = await academic.getSchool(id);
    return ok(res, 'School created', { item: row }, 201);
  } catch (e) {
    return handleDbError(res, e, 'Failed to create school');
  }
}

async function updateSchool(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getSchool(id);
    if (!existing) return fail(res, 'Not found', 404);
    const { campus_id, name, abbreviation } = req.body || {};
    if (!campus_id || !name || !String(name).trim()) return fail(res, 'campus_id and name are required');
    await academic.updateSchool(id, { campus_id, name: name.trim(), abbreviation });
    const row = await academic.getSchool(id);
    return ok(res, 'School updated', { item: row });
  } catch (e) {
    return handleDbError(res, e, 'Failed to update school');
  }
}

async function deleteSchool(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getSchool(id);
    if (!existing) return fail(res, 'Not found', 404);
    await academic.deleteSchool(id);
    return ok(res, 'School deleted', {});
  } catch (e) {
    return handleDbError(res, e, 'Failed to delete school');
  }
}

async function listPrograms(req, res) {
  try {
    const rows = await academic.listPrograms();
    return ok(res, 'OK', { items: rows });
  } catch (e) {
    return handleDbError(res, e, 'Failed to list programs');
  }
}

async function createProgram(req, res) {
  try {
    const { school_id, name, abbreviation, duration_years, exit_years } = req.body || {};
    if (!school_id || !name || !String(name).trim()) return fail(res, 'school_id and name are required');
    const id = await academic.createProgram({
      school_id,
      name: name.trim(),
      abbreviation,
      duration_years,
      exit_years,
    });
    const row = await academic.getProgram(id);
    return ok(res, 'Program created', { item: row }, 201);
  } catch (e) {
    return handleDbError(res, e, 'Failed to create program');
  }
}

async function updateProgram(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getProgram(id);
    if (!existing) return fail(res, 'Not found', 404);
    const { school_id, name, abbreviation, duration_years, exit_years } = req.body || {};
    if (!school_id || !name || !String(name).trim()) return fail(res, 'school_id and name are required');
    await academic.updateProgram(id, {
      school_id,
      name: name.trim(),
      abbreviation,
      duration_years,
      exit_years,
    });
    const row = await academic.getProgram(id);
    return ok(res, 'Program updated', { item: row });
  } catch (e) {
    return handleDbError(res, e, 'Failed to update program');
  }
}

async function deleteProgram(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getProgram(id);
    if (!existing) return fail(res, 'Not found', 404);
    await academic.deleteProgram(id);
    return ok(res, 'Program deleted', {});
  } catch (e) {
    return handleDbError(res, e, 'Failed to delete program');
  }
}

async function listBatches(req, res) {
  try {
    const rows = await academic.listBatches();
    return ok(res, 'OK', { items: rows });
  } catch (e) {
    return handleDbError(res, e, 'Failed to list batches');
  }
}

async function createBatch(req, res) {
  try {
    const { program_id, joining_year } = req.body || {};
    if (!program_id || joining_year == null) return fail(res, 'program_id and joining_year are required');
    const id = await academic.createBatch({ program_id, joining_year: Number(joining_year) });
    const row = await academic.getBatch(id);
    return ok(res, 'Batch created', { item: row }, 201);
  } catch (e) {
    return handleDbError(res, e, 'Failed to create batch');
  }
}

async function updateBatch(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getBatch(id);
    if (!existing) return fail(res, 'Not found', 404);
    const { program_id, joining_year } = req.body || {};
    if (!program_id || joining_year == null) return fail(res, 'program_id and joining_year are required');
    await academic.updateBatch(id, { program_id, joining_year: Number(joining_year) });
    const row = await academic.getBatch(id);
    return ok(res, 'Batch updated', { item: row });
  } catch (e) {
    return handleDbError(res, e, 'Failed to update batch');
  }
}

async function deleteBatch(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getBatch(id);
    if (!existing) return fail(res, 'Not found', 404);
    await academic.deleteBatch(id);
    return ok(res, 'Batch deleted', {});
  } catch (e) {
    return handleDbError(res, e, 'Failed to delete batch');
  }
}

async function listCourseGroups(req, res) {
  try {
    const rows = await academic.listCourseGroups();
    return ok(res, 'OK', { items: rows });
  } catch (e) {
    return handleDbError(res, e, 'Failed to list course groups');
  }
}

async function createCourseGroup(req, res) {
  try {
    const { school_id, program_id, name, track } = req.body || {};
    if (!school_id || !name || !String(name).trim() || !track) {
      return fail(res, 'school_id, name, and track are required');
    }
    if (!TRACKS.has(track)) return fail(res, 'Invalid track');
    const id = await academic.createCourseGroup({
      school_id,
      program_id: program_id || null,
      name: name.trim(),
      track,
    });
    const row = await academic.getCourseGroup(id);
    return ok(res, 'Course group created', { item: row }, 201);
  } catch (e) {
    return handleDbError(res, e, 'Failed to create course group');
  }
}

async function updateCourseGroup(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getCourseGroup(id);
    if (!existing) return fail(res, 'Not found', 404);
    const { school_id, program_id, name, track } = req.body || {};
    if (!school_id || !name || !String(name).trim() || !track) {
      return fail(res, 'school_id, name, and track are required');
    }
    if (!TRACKS.has(track)) return fail(res, 'Invalid track');
    await academic.updateCourseGroup(id, {
      school_id,
      program_id: program_id || null,
      name: name.trim(),
      track,
    });
    const row = await academic.getCourseGroup(id);
    return ok(res, 'Course group updated', { item: row });
  } catch (e) {
    return handleDbError(res, e, 'Failed to update course group');
  }
}

async function deleteCourseGroup(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getCourseGroup(id);
    if (!existing) return fail(res, 'Not found', 404);
    await academic.deleteCourseGroup(id);
    return ok(res, 'Course group deleted', {});
  } catch (e) {
    return handleDbError(res, e, 'Failed to delete course group');
  }
}

async function listCourses(req, res) {
  try {
    const rows = await academic.listCourses();
    return ok(res, 'OK', { items: rows });
  } catch (e) {
    return handleDbError(res, e, 'Failed to list courses');
  }
}

async function createCourse(req, res) {
  try {
    const {
      course_group_id,
      course_name,
      course_code,
      credits,
      lecture_hours,
      tutorial_hours,
      practical_hours,
    } = req.body || {};
    if (!course_group_id || !course_name || !course_code) {
      return fail(res, 'course_group_id, course_name, and course_code are required');
    }
    const id = await academic.createCourse({
      course_group_id,
      course_name: String(course_name).trim(),
      course_code: String(course_code).trim(),
      credits,
      lecture_hours,
      tutorial_hours,
      practical_hours,
    });
    const row = await academic.getCourse(id);
    return ok(res, 'Course created', { item: row }, 201);
  } catch (e) {
    return handleDbError(res, e, 'Failed to create course');
  }
}

async function updateCourse(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getCourse(id);
    if (!existing) return fail(res, 'Not found', 404);
    const {
      course_group_id,
      course_name,
      course_code,
      credits,
      lecture_hours,
      tutorial_hours,
      practical_hours,
    } = req.body || {};
    if (!course_group_id || !course_name || !course_code) {
      return fail(res, 'course_group_id, course_name, and course_code are required');
    }
    await academic.updateCourse(id, {
      course_group_id,
      course_name: String(course_name).trim(),
      course_code: String(course_code).trim(),
      credits,
      lecture_hours,
      tutorial_hours,
      practical_hours,
    });
    const row = await academic.getCourse(id);
    return ok(res, 'Course updated', { item: row });
  } catch (e) {
    return handleDbError(res, e, 'Failed to update course');
  }
}

async function deleteCourse(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getCourse(id);
    if (!existing) return fail(res, 'Not found', 404);
    await academic.deleteCourse(id);
    return ok(res, 'Course deleted', {});
  } catch (e) {
    return handleDbError(res, e, 'Failed to delete course');
  }
}

async function listCourseOfferings(req, res) {
  try {
    const rows = await academic.listCourseOfferings();
    return ok(res, 'OK', { items: rows });
  } catch (e) {
    return handleDbError(res, e, 'Failed to list course offerings');
  }
}

async function createCourseOffering(req, res) {
  try {
    const { course_id, batch_id } = req.body || {};
    if (!course_id || !batch_id) return fail(res, 'course_id and batch_id are required');
    const v = await assertValidCourseOffering(course_id, batch_id);
    if (!v.ok) return fail(res, v.message, 400);
    const id = await academic.createCourseOffering({ course_id, batch_id });
    const row = await academic.getCourseOffering(id);
    return ok(res, 'Course offering created', { item: row }, 201);
  } catch (e) {
    return handleDbError(res, e, 'Failed to create course offering');
  }
}

async function updateCourseOffering(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getCourseOffering(id);
    if (!existing) return fail(res, 'Not found', 404);
    const { course_id, batch_id } = req.body || {};
    if (!course_id || !batch_id) return fail(res, 'course_id and batch_id are required');
    const v = await assertValidCourseOffering(course_id, batch_id);
    if (!v.ok) return fail(res, v.message, 400);
    await academic.updateCourseOffering(id, { course_id, batch_id });
    const row = await academic.getCourseOffering(id);
    return ok(res, 'Course offering updated', { item: row });
  } catch (e) {
    return handleDbError(res, e, 'Failed to update course offering');
  }
}

async function deleteCourseOffering(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getCourseOffering(id);
    if (!existing) return fail(res, 'Not found', 404);
    await academic.deleteCourseOffering(id);
    return ok(res, 'Course offering deleted', {});
  } catch (e) {
    return handleDbError(res, e, 'Failed to delete course offering');
  }
}

async function listCourseSections(req, res) {
  try {
    const rows = await academic.listCourseSections();
    return ok(res, 'OK', { items: rows });
  } catch (e) {
    return handleDbError(res, e, 'Failed to list course sections');
  }
}

async function createCourseSection(req, res) {
  try {
    const { course_offering_id, section_name } = req.body || {};
    if (!course_offering_id || !section_name || !String(section_name).trim()) {
      return fail(res, 'course_offering_id and section_name are required');
    }
    const id = await academic.createCourseSection({
      course_offering_id,
      section_name: String(section_name).trim(),
    });
    const row = await academic.getCourseSection(id);
    return ok(res, 'Course section created', { item: row }, 201);
  } catch (e) {
    return handleDbError(res, e, 'Failed to create course section');
  }
}

async function updateCourseSection(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getCourseSection(id);
    if (!existing) return fail(res, 'Not found', 404);
    const { course_offering_id, section_name } = req.body || {};
    if (!course_offering_id || !section_name || !String(section_name).trim()) {
      return fail(res, 'course_offering_id and section_name are required');
    }
    await academic.updateCourseSection(id, {
      course_offering_id,
      section_name: String(section_name).trim(),
    });
    const row = await academic.getCourseSection(id);
    return ok(res, 'Course section updated', { item: row });
  } catch (e) {
    return handleDbError(res, e, 'Failed to update course section');
  }
}

async function deleteCourseSection(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await academic.getCourseSection(id);
    if (!existing) return fail(res, 'Not found', 404);
    await academic.deleteCourseSection(id);
    return ok(res, 'Course section deleted', {});
  } catch (e) {
    return handleDbError(res, e, 'Failed to delete course section');
  }
}

async function listStudents(req, res) {
  try {
    const rows = await studentModel.listStudents();
    return ok(res, 'OK', { items: rows });
  } catch (e) {
    return handleDbError(res, e, 'Failed to list students');
  }
}

async function updateStudentAffiliation(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await studentModel.getStudent(id);
    if (!existing) return fail(res, 'Not found', 404);
    const { school_id, program_id, batch_id, major_id, minor_id, specialization_id } = req.body || {};
    const v = await validateStudentAffiliation({
      school_id: school_id ?? null,
      program_id: program_id ?? null,
      batch_id: batch_id ?? null,
      major_id: major_id ?? null,
      minor_id: minor_id ?? null,
      specialization_id: specialization_id ?? null,
    });
    if (!v.ok) return fail(res, v.message, 400);
    await studentModel.updateStudentAffiliation(id, {
      school_id: school_id ?? null,
      program_id: program_id ?? null,
      batch_id: batch_id ?? null,
      major_id: major_id ?? null,
      minor_id: minor_id ?? null,
      specialization_id: specialization_id ?? null,
    });
    const row = await studentModel.getStudent(id);
    return ok(res, 'Student affiliation updated', { item: row });
  } catch (e) {
    return handleDbError(res, e, 'Failed to update student');
  }
}

module.exports = {
  listUniversities,
  createUniversity,
  updateUniversity,
  deleteUniversity,
  listCampuses,
  createCampus,
  updateCampus,
  deleteCampus,
  listSchools,
  createSchool,
  updateSchool,
  deleteSchool,
  listPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  listBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  listCourseGroups,
  createCourseGroup,
  updateCourseGroup,
  deleteCourseGroup,
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  listCourseOfferings,
  createCourseOffering,
  updateCourseOffering,
  deleteCourseOffering,
  listCourseSections,
  createCourseSection,
  updateCourseSection,
  deleteCourseSection,
  listStudents,
  updateStudentAffiliation,
};
