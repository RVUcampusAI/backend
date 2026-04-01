const { fail } = require('../utils/apiResponse');

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return fail(res, 'Admin access required', 403);
  }
  return next();
}

module.exports = { requireAdmin };
