const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { jwtSecret } = require('../config/env');
const { getTransporter } = require('../config/smtp');
const { getRoleByName } = require('../models/roleModel');
const { createOtp, findValidOtp, markOtpUsed } = require('../models/otpModel');
const {
  findUserByEmail,
  createUserLogin,
  incrementLoginAttempts,
  resetLoginAttempts,
  updateLastLogin,
  setLockedUntil,
  updatePasswordHash,
  clearExpiredLock,
} = require('../models/userModel');
const { createStudent } = require('../models/studentModel');
const { createFaculty } = require('../models/facultyModel');
const { generateOtp, otpExpiresAt } = require('../utils/otp');
const { ok, fail } = require('../utils/apiResponse');

const MAX_ATTEMPTS_BEFORE_LOCK = 3;
const LOCK_MINUTES = 30;

function signAuthToken(user) {
  const id = user.id ?? user.userId;
  return jwt.sign(
    { userId: id, email: user.email, role: user.role_name },
    jwtSecret,
    { expiresIn: '2h' }
  );
}

function signRegistrationToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: '15m' });
}

function lockExpiresIso() {
  return new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
}

async function sendOtpEmail({ to, otp, otpType }) {
  const transporter = getTransporter();
  const subjects = {
    forgot_password: 'CampusAI Password Reset OTP',
    registration: 'CampusAI Registration OTP',
    account_unlock: 'CampusAI Account Unlock OTP',
  };
  const subject = subjects[otpType] || 'CampusAI OTP';
  const text = `Your CampusAI OTP is ${otp}. It expires in 10 minutes.`;
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  });
}

async function registerStudent(req, res) {
  try {
    const { name, usn, email, password } = req.body || {};
    if (!name || !usn || !email || !password) {
      return fail(res, 'name, usn, email, password are required', 400);
    }

    const existing = await findUserByEmail(email);
    if (existing) return fail(res, 'Email already registered', 409);

    const role = await getRoleByName('student');
    const passwordHash = await bcrypt.hash(password, 10);

    const otp = generateOtp();
    const expiresAt = otpExpiresAt(10);
    await createOtp({ email, otp, otpType: 'registration', expiresAt });

    const registrationToken = signRegistrationToken({
      role: 'student',
      roleId: role.id,
      name,
      usn,
      email,
      passwordHash,
    });

    let emailed = true;
    try {
      await sendOtpEmail({ to: email, otp, otpType: 'registration' });
    } catch (e) {
      emailed = false;
      console.error('OTP email failed:', e.message || e);
    }

    return ok(res, emailed ? 'OTP sent' : 'OTP created (email failed — check SMTP)', {
      registrationToken,
      emailed,
    });
  } catch (e) {
    console.error(e);
    return fail(res, 'Registration failed', 500);
  }
}

async function registerFaculty(req, res) {
  try {
    const { name, faculty_code, email, password } = req.body || {};
    if (!name || !faculty_code || !email || !password) {
      return fail(res, 'name, faculty_code, email, password are required', 400);
    }

    const existing = await findUserByEmail(email);
    if (existing) return fail(res, 'Email already registered', 409);

    const role = await getRoleByName('faculty');
    const passwordHash = await bcrypt.hash(password, 10);

    const otp = generateOtp();
    const expiresAt = otpExpiresAt(10);
    await createOtp({ email, otp, otpType: 'registration', expiresAt });

    const registrationToken = signRegistrationToken({
      role: 'faculty',
      roleId: role.id,
      name,
      facultyCode: faculty_code,
      email,
      passwordHash,
    });

    let emailed = true;
    try {
      await sendOtpEmail({ to: email, otp, otpType: 'registration' });
    } catch (e) {
      emailed = false;
      console.error('OTP email failed:', e.message || e);
    }

    return ok(res, emailed ? 'OTP sent' : 'OTP created (email failed — check SMTP)', {
      registrationToken,
      emailed,
    });
  } catch (e) {
    console.error(e);
    return fail(res, 'Registration failed', 500);
  }
}

async function verifyOtpAndCreateAccount(req, res) {
  try {
    const { email, otp, otp_type, registrationToken } = req.body || {};
    if (!email || !otp || !otp_type || !registrationToken) {
      return fail(res, 'email, otp, otp_type, registrationToken are required', 400);
    }
    if (otp_type !== 'registration') {
      return fail(res, 'Use dedicated endpoints for password reset or account unlock', 400);
    }

    const otpRow = await findValidOtp({ email, otp, otpType: otp_type });
    if (!otpRow) return fail(res, 'Invalid or expired OTP', 400);

    let regPayload;
    try {
      regPayload = jwt.verify(registrationToken, jwtSecret);
    } catch (e) {
      return fail(res, 'Invalid or expired registrationToken', 400);
    }

    if (regPayload.email !== email) {
      return fail(res, 'Token/email mismatch', 400);
    }

    const existing = await findUserByEmail(email);
    if (existing) return fail(res, 'Email already registered', 409);

    const userId = await createUserLogin({
      email,
      passwordHash: regPayload.passwordHash,
      roleId: regPayload.roleId,
    });

    if (regPayload.role === 'student') {
      await createStudent({ name: regPayload.name, usn: regPayload.usn, email });
    } else if (regPayload.role === 'faculty') {
      await createFaculty({ name: regPayload.name, facultyCode: regPayload.facultyCode, email });
    }

    await markOtpUsed(otpRow.id);

    const user = await findUserByEmail(email);
    const token = signAuthToken({ id: userId, email, role_name: user.role_name });
    return ok(res, 'Account created', { token, role: user.role_name });
  } catch (e) {
    console.error(e);
    return fail(res, 'OTP verification failed', 500);
  }
}

function isLocked(user) {
  if (!user.locked_until) return false;
  return new Date(user.locked_until) > new Date();
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return fail(res, 'email and password required', 400);

    await clearExpiredLock(email);
    const user = await findUserByEmail(email);
    if (!user) return fail(res, 'Invalid email or password', 401);
    if (!user.is_active) return fail(res, 'Account inactive', 403);

    if (isLocked(user)) {
      return fail(res, 'Account locked. Use OTP or Forgot Password', 403);
    }

    const okPwd = await bcrypt.compare(password, user.password_hash);
    if (!okPwd) {
      await incrementLoginAttempts(email);
      const refreshed = await findUserByEmail(email);
      if (refreshed && refreshed.login_attempts >= MAX_ATTEMPTS_BEFORE_LOCK) {
        await setLockedUntil(email, lockExpiresIso());
        return fail(res, 'Account locked. Use OTP or Forgot Password', 403);
      }
      return fail(res, 'Invalid password', 401);
    }

    await resetLoginAttempts(email);
    await updateLastLogin(email);

    const token = signAuthToken(user);
    return ok(res, 'Login successful', { token, role: user.role_name });
  } catch (e) {
    console.error(e);
    return fail(res, 'Login failed', 500);
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body || {};
    if (!email || !String(email).trim()) return fail(res, 'email is required', 400);

    const user = await findUserByEmail(String(email).trim());
    const generic = ok(res, 'If an account exists for this email, a reset code has been sent.', {});

    if (!user) return generic;

    const otp = generateOtp();
    const expiresAt = otpExpiresAt(10);
    await createOtp({ email: user.email, otp, otpType: 'forgot_password', expiresAt });

    try {
      await sendOtpEmail({ to: user.email, otp, otpType: 'forgot_password' });
    } catch (e) {
      console.error('Forgot password email failed:', e.message || e);
    }

    return generic;
  } catch (e) {
    console.error(e);
    return fail(res, 'Request failed', 500);
  }
}

async function resetPassword(req, res) {
  try {
    const { email, otp, new_password } = req.body || {};
    if (!email || !otp || !new_password) {
      return fail(res, 'email, otp, and new_password are required', 400);
    }
    if (String(new_password).length < 4) {
      return fail(res, 'Password must be at least 4 characters', 400);
    }

    const user = await findUserByEmail(String(email).trim());
    if (!user) return fail(res, 'Invalid or expired OTP', 400);

    const otpRow = await findValidOtp({
      email: user.email,
      otp: String(otp),
      otpType: 'forgot_password',
    });
    if (!otpRow) return fail(res, 'Invalid or expired OTP', 400);

    const passwordHash = await bcrypt.hash(String(new_password), 10);
    await updatePasswordHash(user.email, passwordHash);
    await markOtpUsed(otpRow.id);
    await resetLoginAttempts(user.email);

    return ok(res, 'Password updated successfully', {});
  } catch (e) {
    console.error(e);
    return fail(res, 'Password reset failed', 500);
  }
}

async function unlockAccount(req, res) {
  try {
    const { email } = req.body || {};
    if (!email || !String(email).trim()) return fail(res, 'email is required', 400);

    const user = await findUserByEmail(String(email).trim());
    const generic = ok(res, 'If the account is eligible, an unlock code has been sent.', {});

    if (!user) return generic;
    if (!isLocked(user) && user.login_attempts < MAX_ATTEMPTS_BEFORE_LOCK) {
      return generic;
    }

    const otp = generateOtp();
    const expiresAt = otpExpiresAt(10);
    await createOtp({ email: user.email, otp, otpType: 'account_unlock', expiresAt });

    try {
      await sendOtpEmail({ to: user.email, otp, otpType: 'account_unlock' });
    } catch (e) {
      console.error('Unlock email failed:', e.message || e);
    }

    return generic;
  } catch (e) {
    console.error(e);
    return fail(res, 'Request failed', 500);
  }
}

async function verifyUnlockOtp(req, res) {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) return fail(res, 'email and otp are required', 400);

    const user = await findUserByEmail(String(email).trim());
    if (!user) return fail(res, 'Invalid or expired OTP', 400);

    const otpRow = await findValidOtp({
      email: user.email,
      otp: String(otp),
      otpType: 'account_unlock',
    });
    if (!otpRow) return fail(res, 'Invalid or expired OTP', 400);

    await markOtpUsed(otpRow.id);
    await resetLoginAttempts(user.email);

    return ok(res, 'Account unlocked. You can sign in again.', {});
  } catch (e) {
    console.error(e);
    return fail(res, 'Unlock verification failed', 500);
  }
}

module.exports = {
  registerStudent,
  registerFaculty,
  verifyOtpAndCreateAccount,
  login,
  forgotPassword,
  resetPassword,
  unlockAccount,
  verifyUnlockOtp,
};
