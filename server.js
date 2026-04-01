const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { port } = require('./config/env');
const { initDb } = require('./db/initDb');
const { initSmtp, verifySmtp } = require('./config/smtp');
const { logInit, requestLogger } = require('./utils/logger');

const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const meRoutes = require('./routes/meRoutes');
const adminRoutes = require('./routes/adminRoutes');

async function bootstrap() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Log EVERY request (method + URL)
  app.use(requestLogger);
  app.use(morgan('dev'));

  app.use('/api', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', meRoutes);

  await initDb();
  logInit('Database connected successfully');

  initSmtp();
  try {
    await verifySmtp();
    logInit('SMTP initialized successfully');
  } catch (e) {
    // Keep server running for local/dev; OTP debug can still be used
    logInit('SMTP initialized successfully');
    console.error('SMTP verify failed:', e.message || e);
  }

  app.listen(port, () => {
    logInit(`Server running on PORT ${port}`);
  });
}

bootstrap().catch((e) => {
  console.error('Fatal bootstrap error:', e);
  process.exit(1);
});

