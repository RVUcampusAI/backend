const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const { fail } = require('../utils/apiResponse');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');
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

