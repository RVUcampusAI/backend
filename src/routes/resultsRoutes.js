const express = require('express');
const router = express.Router();
const resultsController = require('../controllers/resultsController');

router.get('/', resultsController.getResults);
router.post('/', resultsController.createResult);

module.exports = router;
