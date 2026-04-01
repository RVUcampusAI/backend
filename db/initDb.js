const bcrypt = require('bcrypt');
const { run, get, all } = require('./database');

async function columnExists(table, colName) {
  const rows = await all(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === colName);
}

async function addColumnIfMissing(table, colDef) {
  const name = colDef.split(/\s+/)[0];
  if (!(await columnExists(table, name))) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
  }
}

async function migrateLegacyColumns() {
  await addColumnIfMissing('user_login', 'locked_until TEXT');
  await addColumnIfMissing('students', 'school_id INTEGER REFERENCES school(id)');
  await addColumnIfMissing('students', 'program_id INTEGER REFERENCES program(id)');
  await addColumnIfMissing('students', 'batch_id INTEGER REFERENCES batch(id)');
  await addColumnIfMissing('students', 'major_id INTEGER REFERENCES course_group(id)');
  await addColumnIfMissing('students', 'minor_id INTEGER REFERENCES course_group(id)');
  await addColumnIfMissing('students', 'specialization_id INTEGER REFERENCES course_group(id)');
  await addColumnIfMissing('faculty', 'school_id INTEGER REFERENCES school(id)');
  await addColumnIfMissing('faculty', 'designation TEXT');
  await addColumnIfMissing('faculty', `type TEXT DEFAULT 'permanent'`);
  await run(`UPDATE faculty SET type = 'permanent' WHERE type IS NULL OR type = ''`);
}

async function createSchema() {
  await run(`PRAGMA foreign_keys = ON;`);

  await run(`
    CREATE TABLE IF NOT EXISTS role (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_name TEXT NOT NULL UNIQUE
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS user_login (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      login_attempts INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login TEXT,
      locked_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (role_id) REFERENCES role(id)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS otp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      otp TEXT NOT NULL,
      otp_type TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      is_used INTEGER NOT NULL DEFAULT 0
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS university (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      abbreviation TEXT,
      address TEXT,
      email TEXT,
      phone TEXT,
      website TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS campus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      university_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      abbreviation TEXT,
      address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (university_id) REFERENCES university(id) ON DELETE CASCADE
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS school (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campus_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      abbreviation TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (campus_id) REFERENCES campus(id) ON DELETE CASCADE
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS program (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      abbreviation TEXT,
      duration_years INTEGER NOT NULL DEFAULT 4,
      exit_years TEXT NOT NULL DEFAULT '[4]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES school(id) ON DELETE CASCADE,
      UNIQUE (school_id, name)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS batch (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER NOT NULL,
      joining_year INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (program_id) REFERENCES program(id) ON DELETE CASCADE
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS course_group (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      program_id INTEGER,
      name TEXT NOT NULL,
      track TEXT NOT NULL CHECK (track IN ('core','minor','major','specialization','elective')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (school_id) REFERENCES school(id) ON DELETE CASCADE,
      FOREIGN KEY (program_id) REFERENCES program(id) ON DELETE SET NULL
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS course (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_group_id INTEGER NOT NULL,
      course_name TEXT NOT NULL,
      course_code TEXT NOT NULL UNIQUE,
      credits REAL NOT NULL DEFAULT 0,
      lecture_hours INTEGER NOT NULL DEFAULT 0,
      tutorial_hours INTEGER NOT NULL DEFAULT 0,
      practical_hours INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (course_group_id) REFERENCES course_group(id) ON DELETE CASCADE
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS course_offering (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      batch_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
      FOREIGN KEY (batch_id) REFERENCES batch(id) ON DELETE CASCADE
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS course_section (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_offering_id INTEGER NOT NULL,
      section_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (course_offering_id) REFERENCES course_offering(id) ON DELETE CASCADE
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      usn TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      school_id INTEGER REFERENCES school(id),
      program_id INTEGER REFERENCES program(id),
      batch_id INTEGER REFERENCES batch(id),
      major_id INTEGER REFERENCES course_group(id),
      minor_id INTEGER REFERENCES course_group(id),
      specialization_id INTEGER REFERENCES course_group(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS faculty (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      faculty_code TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      school_id INTEGER REFERENCES school(id),
      designation TEXT,
      type TEXT NOT NULL DEFAULT 'permanent' CHECK (type IN ('visiting','temporary','permanent')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await migrateLegacyColumns();
}

async function seedRoles() {
  await run(`INSERT OR IGNORE INTO role (role_name) VALUES (?), (?), (?)`, [
    'student',
    'faculty',
    'admin',
  ]);
}

async function getRoleId(roleName) {
  const row = await get(`SELECT id FROM role WHERE role_name = ?`, [roleName]);
  return row ? row.id : null;
}

async function seedRvUniversity() {
  await run(
    `INSERT OR IGNORE INTO university (id, name, abbreviation, address, email, phone, website)
     VALUES (1, 'RV University', 'RVU', NULL, NULL, NULL, NULL)`
  );
}

async function seedDummyUsers() {
  const passwordHash = await bcrypt.hash('1234', 10);

  const studentRoleId = await getRoleId('student');
  const facultyRoleId = await getRoleId('faculty');
  const adminRoleId = await getRoleId('admin');

  await run(
    `INSERT OR IGNORE INTO user_login (email, password_hash, role_id) VALUES (?, ?, ?)`,
    ['student@rvu.edu.in', passwordHash, studentRoleId]
  );
  await run(
    `INSERT OR IGNORE INTO user_login (email, password_hash, role_id) VALUES (?, ?, ?)`,
    ['faculty@rvu.edu.in', passwordHash, facultyRoleId]
  );
  await run(
    `INSERT OR IGNORE INTO user_login (email, password_hash, role_id) VALUES (?, ?, ?)`,
    ['admin@rvu.edu.in', passwordHash, adminRoleId]
  );

  await run(
    `INSERT OR IGNORE INTO students (name, usn, email) VALUES (?, ?, ?)`,
    ['Demo Student', 'RVU-STU-0001', 'student@rvu.edu.in']
  );
  await run(
    `INSERT OR IGNORE INTO faculty (name, faculty_code, email) VALUES (?, ?, ?)`,
    ['Demo Faculty', 'RVU-FAC-0001', 'faculty@rvu.edu.in']
  );
}

async function initDb() {
  await createSchema();
  await seedRoles();
  await seedRvUniversity();
  await seedDummyUsers();
}

module.exports = { initDb };
