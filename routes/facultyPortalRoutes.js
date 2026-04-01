const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const facultyPortal = require('../controllers/facultyPortalController');

const router = express.Router();
router.use(requireAuth, requireRole(['faculty']));

router.get('/lookups', facultyPortal.getLookups);
router.get('/sections', facultyPortal.getMySections);
router.post('/class-sessions', facultyPortal.createSession);
router.get('/class-sessions', facultyPortal.listSessions);
router.get('/sections/:sectionId/students', facultyPortal.listSectionStudents);
router.get('/class-sessions/:sessionId/attendance', facultyPortal.getSessionAttendance);
router.post('/attendance', facultyPortal.saveAttendance);

module.exports = router;
