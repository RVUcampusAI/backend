const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const facultyPortal = require('../controllers/facultyPortalController');
const exam = require('../controllers/examController');
const feedback = require('../controllers/feedbackController');

const router = express.Router();
router.use(requireAuth, requireRole(['faculty']));

router.get('/lookups', facultyPortal.getLookups);
router.get('/sections', facultyPortal.getMySections);
router.post('/class-sessions', facultyPortal.createSession);
router.get('/class-sessions', facultyPortal.listSessions);
router.get('/sections/:sectionId/students', facultyPortal.listSectionStudents);
router.get('/class-sessions/:sessionId/attendance', facultyPortal.getSessionAttendance);
router.post('/attendance', facultyPortal.saveAttendance);

router.post('/exams', exam.createExam);
router.get('/exams', exam.listExamsForSection);
router.get('/exams/:id', exam.getExamDetail);
router.patch('/exams/:id/students', exam.patchExamStudents);
router.patch('/exams/:examId/students/:studentId', exam.patchExamStudentByRow);
router.post('/exams/:id/components', exam.addExamComponents);
router.put('/exam-components/:componentId/marks', exam.putComponentMarks);
router.post('/exams/:id/recalculate-summary', exam.postRecalculateSummary);

router.get('/feedback/forms', feedback.facultyListForms);
router.get('/feedback/forms/:id/stats', feedback.facultyFormStats);

module.exports = router;
