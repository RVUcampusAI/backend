const express = require('express');
const { ok, fail } = require('../utils/apiResponse');
const { getPool } = require('../db/database');

const router = express.Router();

router.get('/health', (req, res) => {
  return ok(res, 'OK', { status: 'OK' });
});

router.get('/health/db', async (req, res) => {
  try {
    const pool = getPool();
    const r = await pool.query('SELECT 1 AS ok');
    return ok(res, 'OK', { database: r.rows[0]?.ok === 1 });
  } catch (e) {
    return fail(res, 'Database check failed', 503);
  }
});

module.exports = router;

