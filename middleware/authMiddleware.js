const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const { fail } = require('../utils/apiResponse');

function extractBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return '';
  const m = /^Bearer\s+(\S+)/i.exec(headerValue.trim());
  return m ? m[1].trim() : '';
}

function requireAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return fail(res, 'Missing Authorization token', 401);

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    return next();
  } catch (e) {
    return fail(res, 'Invalid or expired token', 401);
  }
}

module.exports = { requireAuth };

