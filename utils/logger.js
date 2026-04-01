function logInit(message) {
  console.log(message);
}

function logDb(op, sql, values) {
  const preview = String(sql).replace(/\s+/g, ' ').trim().slice(0, 200);
  const args = values && values.length ? ` [${values.length} params]` : '';
  console.log(`[DB ${op}] ${preview}${args}`);
}

function requestLogger(req, res, next) {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
}

module.exports = { logInit, logDb, requestLogger };

