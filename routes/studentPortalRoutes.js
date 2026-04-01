const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const studentPortal = require('../controllers/studentPortalController');

const router = express.Router();
router.use(requireAuth, requireRole(['student']));

router.get('/enrollments', studentPortal.getEnrollments);
router.get('/attendance', studentPortal.getAttendanceSummary);

module.exports = router;
