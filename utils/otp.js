function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function otpExpiresAt(minutes = 10) {
  const d = new Date(Date.now() + minutes * 60 * 1000);
  // SQLite datetime compatible ISO-ish string
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = { generateOtp, otpExpiresAt };

