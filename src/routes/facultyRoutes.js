const express = require('express');
const router = express.Router();
const facultyController = require('../controllers/facultyController');

// Faculty Dashboard Stats
router.get('/:faculty_id/stats', facultyController.getDashboardStats);

// Faculty Today's Schedule
router.get('/:faculty_id/schedule', facultyController.getTodaySchedule);

// Faculty Courses
router.get('/:faculty_id/courses', facultyController.getCourses);

// Faculty Students
router.get('/:faculty_id/students', facultyController.getStudents);

// Faculty Timetable
router.get('/:faculty_id/timetable', facultyController.getTimetable);

module.exports = router;
