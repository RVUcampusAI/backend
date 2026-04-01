const bcrypt = require('bcrypt');
const { run, get, all } = require('./database');

/** Avoid re-running DDL on every process start once the public schema exists. */
async function schemaAlreadyApplied() {
  const row = await get(
    `SELECT 1 AS ok
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'role'
     LIMIT 1`
  );
  return !!row;
}

async function createSchema() {
  await run(`
    CREATE TABLE IF NOT EXISTS role (
      id SERIAL PRIMARY KEY,
      role_name TEXT NOT NULL UNIQUE
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS user_login (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL REFERENCES role(id),
      login_attempts INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login TIMESTAMPTZ,
      locked_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS otp (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      otp TEXT NOT NULL,
      otp_type TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      is_used INTEGER NOT NULL DEFAULT 0
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS university (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      abbreviation TEXT,
      address TEXT,
      email TEXT,
      phone TEXT,
      website TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS campus (
      id SERIAL PRIMARY KEY,
      university_id INTEGER NOT NULL REFERENCES university(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      abbreviation TEXT,
      address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS school (
      id SERIAL PRIMARY KEY,
      campus_id INTEGER NOT NULL REFERENCES campus(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      abbreviation TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS program (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      abbreviation TEXT,
      duration_years INTEGER NOT NULL DEFAULT 4,
      exit_years TEXT NOT NULL DEFAULT '[4]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (school_id, name)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS batch (
      id SERIAL PRIMARY KEY,
      program_id INTEGER NOT NULL REFERENCES program(id) ON DELETE CASCADE,
      joining_year INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS course_group (
      id SERIAL PRIMARY KEY,
      school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
      program_id INTEGER REFERENCES program(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      track TEXT NOT NULL CHECK (track IN ('core','minor','major','specialization','elective')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS course (
      id SERIAL PRIMARY KEY,
      course_group_id INTEGER NOT NULL REFERENCES course_group(id) ON DELETE CASCADE,
      course_name TEXT NOT NULL,
      course_code TEXT NOT NULL UNIQUE,
      credits REAL NOT NULL DEFAULT 0,
      lecture_hours INTEGER NOT NULL DEFAULT 0,
      tutorial_hours INTEGER NOT NULL DEFAULT 0,
      practical_hours INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS course_offering (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES course(id) ON DELETE CASCADE,
      batch_id INTEGER NOT NULL REFERENCES batch(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS course_section (
      id SERIAL PRIMARY KEY,
      course_offering_id INTEGER NOT NULL REFERENCES course_offering(id) ON DELETE CASCADE,
      section_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      usn TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      school_id INTEGER REFERENCES school(id),
      program_id INTEGER REFERENCES program(id),
      batch_id INTEGER REFERENCES batch(id),
      major_id INTEGER REFERENCES course_group(id),
      minor_id INTEGER REFERENCES course_group(id),
      specialization_id INTEGER REFERENCES course_group(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS faculty (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      faculty_code TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      school_id INTEGER REFERENCES school(id),
      designation TEXT,
      type TEXT NOT NULL DEFAULT 'permanent' CHECK (type IN ('visiting','temporary','permanent')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS course_offering_faculty (
      id SERIAL PRIMARY KEY,
      course_section_id INTEGER NOT NULL REFERENCES course_section(id) ON DELETE CASCADE,
      faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('primary','co_faculty')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (course_section_id, faculty_id, role)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS student_enrollment (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      course_section_id INTEGER NOT NULL REFERENCES course_section(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (student_id, course_section_id)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS class_session (
      id SERIAL PRIMARY KEY,
      course_offering_faculty_id INTEGER NOT NULL REFERENCES course_offering_faculty(id) ON DELETE CASCADE,
      session_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      session_type CHAR(1) NOT NULL CHECK (session_type IN ('L','T','P')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_session_id INTEGER NOT NULL REFERENCES class_session(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('present','absent','leave')),
      UNIQUE (student_id, class_session_id)
    );
  `);

  await run(`
    CREATE OR REPLACE VIEW attendance_summary AS
    SELECT
      e.student_id,
      e.course_section_id,
      COUNT(DISTINCT s.id) AS total_classes,
      COUNT(DISTINCT a.class_session_id) FILTER (WHERE a.status = 'present') AS attended,
      CASE
        WHEN COUNT(DISTINCT s.id) = 0 THEN 0::numeric
        ELSE ROUND(
          (100.0 * COUNT(DISTINCT a.class_session_id) FILTER (WHERE a.status = 'present'))
          / NULLIF(COUNT(DISTINCT s.id), 0),
          2
        )
      END AS percentage
    FROM student_enrollment e
    JOIN course_section cs ON cs.id = e.course_section_id
    LEFT JOIN course_offering_faculty cof ON cof.course_section_id = cs.id
    LEFT JOIN class_session s ON s.course_offering_faculty_id = cof.id
    LEFT JOIN attendance a ON a.class_session_id = s.id AND a.student_id = e.student_id
    GROUP BY e.student_id, e.course_section_id;
  `);
}

async function seedRoles() {
  await run(
    `INSERT INTO role (role_name) VALUES (?), (?), (?)
     ON CONFLICT (role_name) DO NOTHING`,
    ['student', 'faculty', 'admin']
  );
}

async function getRoleId(roleName) {
  const row = await get(`SELECT id FROM role WHERE role_name = ?`, [roleName]);
  return row ? row.id : null;
}

async function seedRvUniversity() {
  const row = await get(`SELECT id FROM university WHERE abbreviation = ?`, ['RVU']);
  if (row) return row.id;
  const r = await run(
    `INSERT INTO university (name, abbreviation, address, email, phone, website)
     VALUES (?, ?, NULL, NULL, NULL, NULL)`,
    ['RV University', 'RVU']
  );
  return r.lastID;
}

async function seedDummyUsers() {
  const passwordHash = await bcrypt.hash('1234', 10);
  const studentRoleId = await getRoleId('student');
  const facultyRoleId = await getRoleId('faculty');
  const adminRoleId = await getRoleId('admin');

  await run(
    `INSERT INTO user_login (email, password_hash, role_id) VALUES (?, ?, ?)
     ON CONFLICT (email) DO NOTHING`,
    ['student@rvu.edu.in', passwordHash, studentRoleId]
  );
  await run(
    `INSERT INTO user_login (email, password_hash, role_id) VALUES (?, ?, ?)
     ON CONFLICT (email) DO NOTHING`,
    ['faculty@rvu.edu.in', passwordHash, facultyRoleId]
  );
  await run(
    `INSERT INTO user_login (email, password_hash, role_id) VALUES (?, ?, ?)
     ON CONFLICT (email) DO NOTHING`,
    ['admin@rvu.edu.in', passwordHash, adminRoleId]
  );

  await run(
    `INSERT INTO students (name, usn, email) VALUES (?, ?, ?)
     ON CONFLICT (usn) DO NOTHING`,
    ['Demo Student', 'RVU-STU-0001', 'student@rvu.edu.in']
  );
  await run(
    `INSERT INTO faculty (name, faculty_code, email) VALUES (?, ?, ?)
     ON CONFLICT (faculty_code) DO NOTHING`,
    ['Demo Faculty', 'RVU-FAC-0001', 'faculty@rvu.edu.in']
  );
}

/** Rich seed: only when DB has almost no academic rows (avoids duplicate demo campuses). */
async function seedExtendedDemoIfNeeded() {
  const campusCount = await get(`SELECT COUNT(*)::int AS c FROM campus`);
  if (campusCount && campusCount.c > 0) return;

  const uniId = await get(`SELECT id FROM university ORDER BY id LIMIT 1`);
  if (!uniId) return;

  const passwordHash = await bcrypt.hash('1234', 10);
  const studentRoleId = await getRoleId('student');
  const facultyRoleId = await getRoleId('faculty');

  const campusRes = await run(
    `INSERT INTO campus (university_id, name, abbreviation, address) VALUES (?, ?, ?, ?)`,
    [uniId.id, 'Main Campus', 'MAIN', 'Bengaluru']
  );
  const campusId = campusRes.lastID;

  const schoolRes = await run(
    `INSERT INTO school (campus_id, name, abbreviation) VALUES (?, ?, ?)`,
    [campusId, 'School of Engineering', 'SOE']
  );
  const schoolId = schoolRes.lastID;

  const progRes = await run(
    `INSERT INTO program (school_id, name, abbreviation, duration_years, exit_years) VALUES (?, ?, ?, ?, ?)`,
    [schoolId, 'B.Tech Computer Science', 'BTech-CSE', 4, '[4]']
  );
  const programId = progRes.lastID;

  const batchRes = await run(`INSERT INTO batch (program_id, joining_year) VALUES (?, ?)`, [programId, 2024]);
  const batchId = batchRes.lastID;

  const coreCgRes = await run(
    `INSERT INTO course_group (school_id, program_id, name, track) VALUES (?, ?, ?, ?)`,
    [schoolId, programId, 'CSE Core 2024', 'core']
  );
  const coreCgId = coreCgRes.lastID;

  const minorCgRes = await run(
    `INSERT INTO course_group (school_id, program_id, name, track) VALUES (?, ?, ?, ?)`,
    [schoolId, programId, 'Design Minor', 'minor']
  );
  const minorCgId = minorCgRes.lastID;

  const elecCgRes = await run(
    `INSERT INTO course_group (school_id, program_id, name, track) VALUES (?, ?, ?, ?)`,
    [schoolId, null, 'Open Electives', 'elective']
  );
  const electiveCgId = elecCgRes.lastID;

  const c1 = await run(
    `INSERT INTO course (course_group_id, course_name, course_code, credits, lecture_hours, tutorial_hours, practical_hours)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [coreCgId, 'Data Structures', 'CS201', 4, 3, 1, 0]
  );
  const course1Id = c1.lastID;

  const c2 = await run(
    `INSERT INTO course (course_group_id, course_name, course_code, credits, lecture_hours, tutorial_hours, practical_hours)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [minorCgId, 'UI Design Studio', 'DS101', 2, 2, 0, 2]
  );
  const course2Id = c2.lastID;

  const c3 = await run(
    `INSERT INTO course (course_group_id, course_name, course_code, credits, lecture_hours, tutorial_hours, practical_hours)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [electiveCgId, 'Liberal Arts Elective', 'LA001', 1, 2, 0, 0]
  );
  const course3Id = c3.lastID;

  const off1 = await run(`INSERT INTO course_offering (course_id, batch_id) VALUES (?, ?)`, [course1Id, batchId]);
  const off1Id = off1.lastID;
  const off2 = await run(`INSERT INTO course_offering (course_id, batch_id) VALUES (?, ?)`, [course2Id, batchId]);
  const off2Id = off2.lastID;
  const off3 = await run(`INSERT INTO course_offering (course_id, batch_id) VALUES (?, ?)`, [course3Id, batchId]);
  const off3Id = off3.lastID;

  const sec1 = await run(`INSERT INTO course_section (course_offering_id, section_name) VALUES (?, ?)`, [off1Id, 'A']);
  const section1Id = sec1.lastID;
  const sec2 = await run(`INSERT INTO course_section (course_offering_id, section_name) VALUES (?, ?)`, [off2Id, 'A']);
  const section2Id = sec2.lastID;
  await run(`INSERT INTO course_section (course_offering_id, section_name) VALUES (?, ?)`, [off3Id, 'A']);

  await run(`UPDATE faculty SET school_id = ? WHERE email = ?`, [schoolId, 'faculty@rvu.edu.in']);

  const facRow = await get(`SELECT id FROM faculty WHERE email = ?`, ['faculty@rvu.edu.in']);
  const facultyId = facRow?.id;

  if (facultyId) {
    await run(
      `INSERT INTO course_offering_faculty (course_section_id, faculty_id, role) VALUES (?, ?, ?)
       ON CONFLICT (course_section_id, faculty_id, role) DO NOTHING`,
      [section1Id, facultyId, 'primary']
    );
    await run(
      `INSERT INTO course_offering_faculty (course_section_id, faculty_id, role) VALUES (?, ?, ?)
       ON CONFLICT (course_section_id, faculty_id, role) DO NOTHING`,
      [section2Id, facultyId, 'co_faculty']
    );
  }

  await run(
    `UPDATE students SET school_id = ?, program_id = ?, batch_id = ?, major_id = ?, minor_id = ?
     WHERE usn = ?`,
    [schoolId, programId, batchId, coreCgId, minorCgId, 'RVU-STU-0001']
  );

  const stu = await get(`SELECT id FROM students WHERE usn = ?`, ['RVU-STU-0001']);
  if (stu) {
    await run(
      `INSERT INTO student_enrollment (student_id, course_section_id) VALUES (?, ?)
       ON CONFLICT (student_id, course_section_id) DO NOTHING`,
      [stu.id, section1Id]
    );
    await run(
      `INSERT INTO student_enrollment (student_id, course_section_id) VALUES (?, ?)
       ON CONFLICT (student_id, course_section_id) DO NOTHING`,
      [stu.id, section2Id]
    );
  }

  await run(
    `INSERT INTO user_login (email, password_hash, role_id) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING`,
    ['student2@rvu.edu.in', passwordHash, studentRoleId]
  );
  await run(
    `INSERT INTO students (name, usn, email, school_id, program_id, batch_id, major_id)
     VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (usn) DO NOTHING`,
    ['Second Student', 'RVU-STU-0002', 'student2@rvu.edu.in', schoolId, programId, batchId, coreCgId]
  );

  const stu2 = await get(`SELECT id FROM students WHERE usn = ?`, ['RVU-STU-0002']);
  if (stu2) {
    await run(
      `INSERT INTO student_enrollment (student_id, course_section_id) VALUES (?, ?)
       ON CONFLICT (student_id, course_section_id) DO NOTHING`,
      [stu2.id, section1Id]
    );
  }

  const cof = await get(
    `SELECT id FROM course_offering_faculty WHERE course_section_id = ? AND role = 'primary' LIMIT 1`,
    [section1Id]
  );
  if (cof && stu) {
    const sess = await run(
      `INSERT INTO class_session (course_offering_faculty_id, session_date, start_time, end_time, session_type)
       VALUES (?, CURRENT_DATE - 1, '09:00', '10:00', 'L')`,
      [cof.id]
    );
    const sessionId = sess.lastID;
    if (sessionId) {
      await run(
        `INSERT INTO attendance (student_id, class_session_id, status) VALUES (?, ?, ?)
         ON CONFLICT (student_id, class_session_id) DO NOTHING`,
        [stu.id, sessionId, 'present']
      );
    }
  }
}

async function initDb() {
  if (await schemaAlreadyApplied()) {
    /* Tables already created; seeds below are idempotent. */
  } else {
    await createSchema();
  }
  await seedRoles();
  await seedRvUniversity();
  await seedDummyUsers();
  await seedExtendedDemoIfNeeded();
}

module.exports = { initDb };
