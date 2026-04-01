function logInit(message) {
  console.log(message);
}

function requestLogger(req, res, next) {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
}

module.exports = { logInit, requestLogger };

