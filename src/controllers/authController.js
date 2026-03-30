const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

// Register User
const register = async (req, res) => {
  try {
    const { username, email, password, role_id } = req.body;

    if (!username || !email || !password || !role_id) {
      return res.status(400).json({ error: 'Username, email, password, and role are required' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // SQL query to insert user
    const query = `
      INSERT INTO public.user_login (username, email, password_hash, role_id, is_active, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email, role_id
    `;
    const values = [username, email, password_hash, role_id, true, false];

    const result = await db.query(query, values);
    const newUser = result.rows[0];

    res.status(201).json({ message: 'User registered successfully', user: newUser });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

// Login User
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const findUserQuery = 'SELECT * FROM public.user_login WHERE email = $1';
    const userResult = await db.query(findUserQuery, [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Log failed attempt
      const logAttemptQuery = `
        INSERT INTO public.login_attempt (user_id, username_attempted, success, failure_reason)
        VALUES ($1, $2, $3, $4)
      `;
      await db.query(logAttemptQuery, [user.id, user.username, false, 'Invalid password']);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Log successful login
    const logSuccessQuery = `
      INSERT INTO public.login_attempt (user_id, username_attempted, success)
      VALUES ($1, $2, $3)
    `;
    await db.query(logSuccessQuery, [user.id, user.username, true]);

    // Update last_login_at
    const updateLoginAtQuery = 'UPDATE public.user_login SET last_login_at = $1 WHERE id = $2';
    await db.query(updateLoginAtQuery, [new Date(), user.id]);

    // Generate Token
    const token = jwt.sign(
      { id: user.id, username: user.username, role_id: user.role_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role_id: user.role_id
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  register,
  login
};
