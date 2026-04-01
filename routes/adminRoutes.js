const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const admin = require('../controllers/adminController');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/universities', admin.listUniversities);
router.post('/universities', admin.createUniversity);
router.put('/universities/:id', admin.updateUniversity);
router.delete('/universities/:id', admin.deleteUniversity);

router.get('/campuses', admin.listCampuses);
router.post('/campuses', admin.createCampus);
router.put('/campuses/:id', admin.updateCampus);
router.delete('/campuses/:id', admin.deleteCampus);

router.get('/schools', admin.listSchools);
router.post('/schools', admin.createSchool);
router.put('/schools/:id', admin.updateSchool);
router.delete('/schools/:id', admin.deleteSchool);

router.get('/programs', admin.listPrograms);
router.post('/programs', admin.createProgram);
router.put('/programs/:id', admin.updateProgram);
router.delete('/programs/:id', admin.deleteProgram);

router.get('/batches', admin.listBatches);
router.post('/batches', admin.createBatch);
router.put('/batches/:id', admin.updateBatch);
router.delete('/batches/:id', admin.deleteBatch);

router.get('/course-groups', admin.listCourseGroups);
router.post('/course-groups', admin.createCourseGroup);
router.put('/course-groups/:id', admin.updateCourseGroup);
router.delete('/course-groups/:id', admin.deleteCourseGroup);

router.get('/courses', admin.listCourses);
router.post('/courses', admin.createCourse);
router.put('/courses/:id', admin.updateCourse);
router.delete('/courses/:id', admin.deleteCourse);

router.get('/course-offerings', admin.listCourseOfferings);
router.post('/course-offerings', admin.createCourseOffering);
router.put('/course-offerings/:id', admin.updateCourseOffering);
router.delete('/course-offerings/:id', admin.deleteCourseOffering);

router.get('/course-sections', admin.listCourseSections);
router.post('/course-sections', admin.createCourseSection);
router.put('/course-sections/:id', admin.updateCourseSection);
router.delete('/course-sections/:id', admin.deleteCourseSection);

router.get('/students', admin.listStudents);
router.patch('/students/:id', admin.updateStudentAffiliation);

router.get('/faculty', admin.listFaculty);
router.get('/faculty-mappings', admin.listFacultyMappings);
router.post('/faculty-mappings', admin.createFacultyMapping);
router.delete('/faculty-mappings/:id', admin.deleteFacultyMapping);

router.get('/student-enrollments', admin.listStudentEnrollments);
router.post('/student-enrollments', admin.createStudentEnrollment);
router.delete('/student-enrollments/:id', admin.deleteStudentEnrollment);

router.get('/attendance-summary', admin.listAttendanceSummaryAdmin);

module.exports = router;
