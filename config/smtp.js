const nodemailer = require('nodemailer');
const { emailUser, emailPass } = require('./env');

let transporter;

function initSmtp() {
  // Simple Gmail-based transport (works with App Passwords)
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
  return transporter;
}

async function verifySmtp() {
  if (!transporter) initSmtp();
  await transporter.verify();
  return true;
}

function getTransporter() {
  if (!transporter) initSmtp();
  return transporter;
}

module.exports = { initSmtp, verifySmtp, getTransporter };

