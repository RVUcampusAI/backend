const { fail } = require('../utils/apiResponse');

function requireRole(roles = []) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user || !req.user.role) return fail(res, 'Unauthorized', 401);
    if (!allowed.includes(req.user.role)) return fail(res, 'Forbidden', 403);
    return next();
  };
}

module.exports = { requireRole };

