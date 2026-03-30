const express = require('express');
const router = express.Router();
const campusController = require('../controllers/campusController');

router.get('/', campusController.getCampuses);
router.post('/', campusController.createCampus);

module.exports = router;
