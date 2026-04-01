const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { ok } = require('../utils/apiResponse');

const router = express.Router();

router.get('/me', requireAuth, (req, res) => {
  return ok(res, 'OK', { user: req.user });
});

module.exports = router;

