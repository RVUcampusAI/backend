const express = require('express');
const router = express.Router();
const universityController = require('../controllers/universityController');

// Route to get all universities
router.get('/', universityController.getUniversities);

// Route to create a new university
router.post('/', universityController.createUniversity);

// Route to update a university
router.put('/:id', universityController.updateUniversity);

// Route to delete a university
router.delete('/:id', universityController.deleteUniversity);

module.exports = router;
