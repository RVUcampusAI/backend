const express = require('express');
const {
  registerStudent,
  registerFaculty,
  verifyOtpAndCreateAccount,
  login,
  forgotPassword,
  resetPassword,
  unlockAccount,
  verifyUnlockOtp,
} = require('../controllers/authController');

const router = express.Router();

router.post('/register/student', registerStudent);
router.post('/register/faculty', registerFaculty);
router.post('/verify-otp', verifyOtpAndCreateAccount);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/unlock-account', unlockAccount);
router.post('/verify-unlock-otp', verifyUnlockOtp);

module.exports = router;
