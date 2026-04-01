const { run, get } = require('../db/database');

async function createOtp({ email, otp, otpType, expiresAt }) {
  await run(
    `INSERT INTO otp (email, otp, otp_type, expires_at, is_used) VALUES (?, ?, ?, ?, 0)`,
    [email, otp, otpType, expiresAt]
  );
}

async function findValidOtp({ email, otp, otpType }) {
  return await get(
    `SELECT *
     FROM otp
     WHERE email = ?
       AND otp = ?
       AND otp_type = ?
       AND is_used = 0
       AND expires_at > NOW()
     ORDER BY id DESC
     LIMIT 1`,
    [email, otp, otpType]
  );
}

async function markOtpUsed(id) {
  await run(`UPDATE otp SET is_used = 1 WHERE id = ?`, [id]);
}

module.exports = { createOtp, findValidOtp, markOtpUsed };

