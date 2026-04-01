const { get, run } = require('../db/database');

async function findUserByEmail(email) {
  return await get(
    `SELECT ul.*, r.role_name
     FROM user_login ul
     JOIN role r ON r.id = ul.role_id
     WHERE ul.email = ?`,
    [email]
  );
}

async function createUserLogin({ email, passwordHash, roleId }) {
  const res = await run(
    `INSERT INTO user_login (email, password_hash, role_id) VALUES (?, ?, ?)`,
    [email, passwordHash, roleId]
  );
  return res.lastID;
}

async function incrementLoginAttempts(email) {
  await run(`UPDATE user_login SET login_attempts = login_attempts + 1 WHERE email = ?`, [email]);
}

async function resetLoginAttempts(email) {
  await run(
    `UPDATE user_login SET login_attempts = 0, locked_until = NULL WHERE email = ?`,
    [email]
  );
}

async function updateLastLogin(email) {
  await run(`UPDATE user_login SET last_login = datetime('now') WHERE email = ?`, [email]);
}

async function setLockedUntil(email, isoTimestamp) {
  await run(`UPDATE user_login SET locked_until = ? WHERE email = ?`, [isoTimestamp, email]);
}

async function updatePasswordHash(email, passwordHash) {
  await run(`UPDATE user_login SET password_hash = ? WHERE email = ?`, [passwordHash, email]);
}

async function clearExpiredLock(email) {
  await run(
    `UPDATE user_login SET locked_until = NULL
     WHERE email = ? AND locked_until IS NOT NULL AND datetime(locked_until) <= datetime('now')`,
    [email]
  );
}

module.exports = {
  findUserByEmail,
  createUserLogin,
  incrementLoginAttempts,
  resetLoginAttempts,
  updateLastLogin,
  setLockedUntil,
  updatePasswordHash,
  clearExpiredLock,
};
