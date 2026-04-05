const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const studentPortal = require('../controllers/studentPortalController');
const feedback = require('../controllers/feedbackController');

const router = express.Router();
router.use(requireAuth, requireRole(['student']));

router.get('/enrollments', studentPortal.getEnrollments);
router.get('/attendance', studentPortal.getAttendanceSummary);

router.get('/feedback/forms', feedback.studentListFeedbackForms);
router.get('/feedback/forms/:id', feedback.studentGetFeedbackForm);
router.post('/feedback/forms/:id/submit', feedback.studentSubmitFeedback);

module.exports = router;
