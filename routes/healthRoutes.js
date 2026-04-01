const express = require('express');
const { ok } = require('../utils/apiResponse');

const router = express.Router();

router.get('/health', (req, res) => {
  return ok(res, 'OK', { status: 'OK' });
});

module.exports = router;

