const express = require('express');
const router = express.Router();
const curriculumController = require('../controllers/curriculumController');

router.get('/', curriculumController.getCurriculum);
router.post('/', curriculumController.createCurriculum);

module.exports = router;
