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
      course_section_id INTEGER REFERENCES course_section(id) ON DELETE CASCADE,
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

/** Exam + feedback tables (idempotent). */
async function createExamAndFeedbackTables() {
  await run(`
    CREATE TABLE IF NOT EXISTS exam (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES course(id) ON DELETE CASCADE,
      course_section_id INTEGER NOT NULL REFERENCES course_section(id) ON DELETE CASCADE,
      exam_type TEXT NOT NULL CHECK (exam_type IN ('cie1','cie2','cie3','see')),
      exam_mode TEXT NOT NULL CHECK (exam_mode IN ('online','offline')),
      formula_type TEXT NOT NULL DEFAULT 'SUM' CHECK (formula_type IN ('SUM','WEIGHTED')),
      total_marks NUMERIC NOT NULL DEFAULT 0,
      exam_date DATE NOT NULL,
      created_by INTEGER NOT NULL REFERENCES faculty(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS exam_student (
      id SERIAL PRIMARY KEY,
      exam_id INTEGER NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      enrollment_id INTEGER NOT NULL REFERENCES student_enrollment(id) ON DELETE CASCADE,
      usn TEXT NOT NULL,
      obtained_marks NUMERIC,
      attendance_percentage NUMERIC,
      status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present','absent')),
      attempt_number INTEGER NOT NULL DEFAULT 1,
      UNIQUE (exam_id, student_id)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS exam_component (
      id SERIAL PRIMARY KEY,
      exam_id INTEGER NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
      component_name TEXT NOT NULL,
      max_marks NUMERIC NOT NULL DEFAULT 0,
      weightage NUMERIC NOT NULL DEFAULT 0
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS exam_component_marks (
      id SERIAL PRIMARY KEY,
      exam_component_id INTEGER NOT NULL REFERENCES exam_component(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      marks_obtained NUMERIC NOT NULL DEFAULT 0,
      UNIQUE (exam_component_id, student_id)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS exam_summary (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      usn TEXT NOT NULL,
      course_id INTEGER NOT NULL REFERENCES course(id) ON DELETE CASCADE,
      cie1_marks NUMERIC,
      cie2_marks NUMERIC,
      cie3_marks NUMERIC,
      see_marks NUMERIC,
      grade TEXT,
      grade_points NUMERIC,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (student_id, course_id, attempt_number)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS feedback_question_bank (
      id SERIAL PRIMARY KEY,
      question_text TEXT NOT NULL,
      question_type TEXT NOT NULL CHECK (question_type IN ('mcq','rating','text')),
      options JSONB,
      label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS feedback_template (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      created_by_user_id INTEGER NOT NULL REFERENCES user_login(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS feedback_template_questions (
      id SERIAL PRIMARY KEY,
      template_id INTEGER NOT NULL REFERENCES feedback_template(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES feedback_question_bank(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL,
      UNIQUE (template_id, question_id),
      UNIQUE (template_id, order_index)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS feedback_form_instance (
      id SERIAL PRIMARY KEY,
      template_id INTEGER NOT NULL REFERENCES feedback_template(id) ON DELETE CASCADE,
      faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
      course_section_id INTEGER NOT NULL REFERENCES course_section(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS feedback_response (
      id SERIAL PRIMARY KEY,
      form_id INTEGER NOT NULL REFERENCES feedback_form_instance(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (form_id, student_id)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS feedback_answers (
      id SERIAL PRIMARY KEY,
      response_id INTEGER NOT NULL REFERENCES feedback_response(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES feedback_question_bank(id) ON DELETE CASCADE,
      answer TEXT NOT NULL DEFAULT '',
      UNIQUE (response_id, question_id)
    );
  `);
}

/** Missing academic tables (idempotent). */
async function createAcademicExtrasTables() {
  await run(`
    CREATE TABLE IF NOT EXISTS faculty_workload (
      id SERIAL PRIMARY KEY,
      faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
      course_section_id INTEGER NOT NULL REFERENCES course_section(id) ON DELETE CASCADE,
      lecture_hours INTEGER NOT NULL DEFAULT 0,
      tutorial_hours INTEGER NOT NULL DEFAULT 0,
      practical_hours INTEGER NOT NULL DEFAULT 0,
      total_hours INTEGER GENERATED ALWAYS AS (lecture_hours + tutorial_hours + practical_hours) STORED,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS faculty_admin_roles (
      id SERIAL PRIMARY KEY,
      faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
      role_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (faculty_id, role_name)
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS course_structure (
      id SERIAL PRIMARY KEY,
      program_id INTEGER NOT NULL REFERENCES program(id) ON DELETE CASCADE,
      batch_id INTEGER NOT NULL REFERENCES batch(id) ON DELETE CASCADE,
      semester TEXT NOT NULL,
      total_credits NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS course_structure_items (
      id SERIAL PRIMARY KEY,
      structure_id INTEGER NOT NULL REFERENCES course_structure(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('course','basket')),
      course_id INTEGER REFERENCES course(id) ON DELETE SET NULL,
      course_group_id INTEGER REFERENCES course_group(id) ON DELETE SET NULL,
      credits NUMERIC NOT NULL DEFAULT 0
    );
  `);
}

async function applyIdempotentIndexesAndColumns() {
  await run(`ALTER TABLE class_session ADD COLUMN IF NOT EXISTS course_section_id INTEGER REFERENCES course_section(id) ON DELETE CASCADE`);
  await run(`ALTER TABLE exam ADD COLUMN IF NOT EXISTS formula_type TEXT NOT NULL DEFAULT 'SUM'`);
  await run(`
    UPDATE class_session s
    SET course_section_id = cof.course_section_id
    FROM course_offering_faculty cof
    WHERE cof.id = s.course_offering_faculty_id
      AND (s.course_section_id IS NULL OR s.course_section_id <> cof.course_section_id)
  `);

  /**
   * Before unique index on (section, date, start, end): remove duplicate slots created before
   * section-level enforcement (e.g. primary + co-faculty both logged the same slot).
   * Keep the row with the smallest id; merge attendance into the kept session, then delete dup rows.
   */
  await run(`
    INSERT INTO attendance (student_id, class_session_id, status)
    SELECT a.student_id, r.keep_id, a.status
    FROM attendance a
    INNER JOIN (
      SELECT id,
             MIN(id) OVER (
               PARTITION BY course_section_id, session_date, start_time, end_time
             ) AS keep_id
      FROM class_session
      WHERE course_section_id IS NOT NULL
    ) r ON r.id = a.class_session_id AND r.id <> r.keep_id
    ON CONFLICT (student_id, class_session_id) DO UPDATE SET status =
      CASE
        WHEN attendance.status = 'present' OR EXCLUDED.status = 'present' THEN 'present'
        WHEN attendance.status = 'leave' OR EXCLUDED.status = 'leave' THEN 'leave'
        ELSE COALESCE(EXCLUDED.status, attendance.status)
      END
  `);
  await run(`
    DELETE FROM attendance a
    USING (
      SELECT id,
             MIN(id) OVER (
               PARTITION BY course_section_id, session_date, start_time, end_time
             ) AS keep_id
      FROM class_session
      WHERE course_section_id IS NOT NULL
    ) r
    WHERE a.class_session_id = r.id AND r.id <> r.keep_id
  `);
  await run(`
    DELETE FROM class_session cs
    USING (
      SELECT id,
             MIN(id) OVER (
               PARTITION BY course_section_id, session_date, start_time, end_time
             ) AS keep_id
      FROM class_session
      WHERE course_section_id IS NOT NULL
    ) r
    WHERE cs.id = r.id AND r.id <> r.keep_id
  `);

  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS class_session_section_slot_uniq
      ON class_session (course_section_id, session_date, start_time, end_time)
      WHERE course_section_id IS NOT NULL
  `);
  await run(`
    CREATE UNIQUE INDEX IF NOT EXISTS course_offering_course_batch_uniq ON course_offering (course_id, batch_id)
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
      `INSERT INTO class_session (course_offering_faculty_id, course_section_id, session_date, start_time, end_time, session_type)
       VALUES (?, ?, CURRENT_DATE - 1, '09:00', '10:00', 'L')`,
      [cof.id, section1Id]
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

/** Minimal exam + feedback when DB has no exams yet (first-time demo). */
async function seedExamFeedbackIfMissing() {
  const existing = await get(`SELECT id FROM exam LIMIT 1`);
  if (existing) return;

  const ctx = await get(
    `SELECT cs.id AS section_id, co.course_id, cof.faculty_id
     FROM course_section cs
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN course c ON c.id = co.course_id AND c.course_code = 'CS201'
     JOIN course_offering_faculty cof ON cof.course_section_id = cs.id AND cof.role = 'primary'
     LIMIT 1`
  );
  if (!ctx) return;

  const ex = await run(
    `INSERT INTO exam (course_id, course_section_id, exam_type, exam_mode, total_marks, exam_date, created_by)
     VALUES (?, ?, 'cie1', 'offline', 50, CURRENT_DATE, ?)`,
    [ctx.course_id, ctx.section_id, ctx.faculty_id]
  );
  const examId = ex.lastID;
  if (!examId) return;

  await run(
    `INSERT INTO exam_component (exam_id, component_name, max_marks, weightage) VALUES (?, 'Written', 30, 60)`,
    [examId]
  );
  await run(
    `INSERT INTO exam_component (exam_id, component_name, max_marks, weightage) VALUES (?, 'Quiz', 20, 40)`,
    [examId]
  );

  const enrollments = await all(
    `SELECT se.id AS enrollment_id, se.student_id, s.usn
     FROM student_enrollment se
     JOIN students s ON s.id = se.student_id
     WHERE se.course_section_id = ?`,
    [ctx.section_id]
  );
  for (const e of enrollments) {
    await run(
      `INSERT INTO exam_student (exam_id, student_id, enrollment_id, usn, status, attempt_number)
       VALUES (?, ?, ?, ?, 'absent', 1)
       ON CONFLICT (exam_id, student_id) DO NOTHING`,
      [examId, e.student_id, e.enrollment_id, e.usn]
    );
  }

  const adminUser = await get(`SELECT id FROM user_login WHERE email = ?`, ['admin@rvu.edu.in']);
  if (!adminUser) return;

  const q1 = await run(
    `INSERT INTO feedback_question_bank (question_text, question_type, options, label)
     VALUES (?, 'rating', CAST(? AS JSONB), ?)`,
    ['Rate teaching clarity (1-5)', '{"min":1,"max":5}', 'teaching_clarity']
  );
  const q2 = await run(
    `INSERT INTO feedback_question_bank (question_text, question_type, options, label)
     VALUES (?, 'text', NULL, ?)`,
    ['What went well?', 'open_well']
  );
  const tpl = await run(
    `INSERT INTO feedback_template (title, description, created_by_user_id)
     VALUES ('Course feedback — CS201', 'Demo template', ?)`,
    [adminUser.id]
  );
  const tplId = tpl.lastID;
  if (tplId && q1.lastID && q2.lastID) {
    await run(
      `INSERT INTO feedback_template_questions (template_id, question_id, order_index) VALUES (?, ?, 1)`,
      [tplId, q1.lastID]
    );
    await run(
      `INSERT INTO feedback_template_questions (template_id, question_id, order_index) VALUES (?, ?, 2)`,
      [tplId, q2.lastID]
    );
    await run(
      `INSERT INTO feedback_form_instance (template_id, faculty_id, course_section_id, start_date, end_date, status)
       VALUES (?, ?, ?, CURRENT_DATE - 7, CURRENT_DATE + 30, 'active')`,
      [tplId, ctx.faculty_id, ctx.section_id]
    );
  }
}

function isoDateDaysOffset(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Rich idempotent dummy data: extra sessions + attendance, more exams/marks/summary,
 * feedback questions/template/forms + one submitted response. Safe to run every server start.
 */
async function seedExpandDemoData() {
  const ctx = await get(
    `SELECT cs.id AS section_id, co.course_id, cof.id AS cof_id, cof.faculty_id,
            c.course_code
     FROM course_section cs
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN course c ON c.id = co.course_id AND c.course_code = 'CS201'
     JOIN course_offering_faculty cof ON cof.course_section_id = cs.id AND cof.role = 'primary'
     LIMIT 1`
  );
  if (!ctx) return;

  const adminUser = await get(`SELECT id FROM user_login WHERE email = ?`, ['admin@rvu.edu.in']);
  const enrollments = await all(
    `SELECT se.id AS enrollment_id, se.student_id, s.usn, s.email
     FROM student_enrollment se
     JOIN students s ON s.id = se.student_id
     WHERE se.course_section_id = ?
     ORDER BY s.id`,
    [ctx.section_id]
  );
  if (!enrollments.length) return;

  const sessionSlots = [
    { day: -5, start: '09:00', end: '10:00', type: 'L' },
    { day: -4, start: '10:00', end: '11:00', type: 'L' },
    { day: -3, start: '14:00', end: '15:00', type: 'T' },
    { day: -2, start: '11:00', end: '13:00', type: 'P' },
    { day: -1, start: '09:30', end: '10:30', type: 'L' },
  ];

  for (const slot of sessionSlots) {
    const sessionDate = isoDateDaysOffset(slot.day);
    let row = await get(
      `SELECT id FROM class_session
       WHERE course_section_id = ? AND session_date = ?::date
         AND start_time = ?::time AND end_time = ?::time`,
      [ctx.section_id, sessionDate, slot.start, slot.end]
    );
    if (!row) {
      const ins = await run(
        `INSERT INTO class_session (course_offering_faculty_id, course_section_id, session_date, start_time, end_time, session_type)
         VALUES (?, ?, ?::date, ?::time, ?::time, ?)`,
        [ctx.cof_id, ctx.section_id, sessionDate, slot.start, slot.end, slot.type]
      );
      if (!ins.lastID) continue;
      row = { id: ins.lastID };
    }
    for (let idx = 0; idx < enrollments.length; idx++) {
      const en = enrollments[idx];
      let status = 'present';
      if (idx % 3 === 0) status = 'absent';
      else if (idx % 5 === 0) status = 'leave';
      await run(
        `INSERT INTO attendance (student_id, class_session_id, status) VALUES (?, ?, ?)
         ON CONFLICT (student_id, class_session_id) DO UPDATE SET status = EXCLUDED.status`,
        [en.student_id, row.id, status]
      );
    }
  }

  const examDefs = [
    { type: 'cie1', mode: 'offline', marks: 50, days: -10, components: [
      { name: 'Written', max: 30, w: 60 },
      { name: 'Quiz', max: 20, w: 40 },
    ] },
    { type: 'cie2', mode: 'online', marks: 40, days: -5, components: [{ name: 'Midterm', max: 40, w: 100 }] },
    { type: 'cie3', mode: 'offline', marks: 30, days: -2, components: [
      { name: 'Lab', max: 15, w: 50 },
      { name: 'Viva', max: 15, w: 50 },
    ] },
    { type: 'see', mode: 'offline', marks: 100, days: 7, components: [{ name: 'Semester end', max: 100, w: 100 }] },
  ];

  for (const def of examDefs) {
    const has = await get(
      `SELECT id FROM exam WHERE course_section_id = ? AND exam_type = ? LIMIT 1`,
      [ctx.section_id, def.type]
    );
    if (has) continue;
    const examDate = isoDateDaysOffset(def.days);
    const ex = await run(
      `INSERT INTO exam (course_id, course_section_id, exam_type, exam_mode, total_marks, exam_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?::date, ?)`,
      [ctx.course_id, ctx.section_id, def.type, def.mode, def.marks, examDate, ctx.faculty_id]
    );
    const examId = ex.lastID;
    if (!examId) continue;
    const compIds = [];
    for (const c of def.components) {
      const cr = await run(
        `INSERT INTO exam_component (exam_id, component_name, max_marks, weightage) VALUES (?, ?, ?, ?)`,
        [examId, c.name, c.max, c.w]
      );
      compIds.push({ id: cr.lastID, max: c.max });
    }
    let stuIdx = 0;
    for (const e of enrollments) {
      await run(
        `INSERT INTO exam_student (exam_id, student_id, enrollment_id, usn, status, attempt_number, attendance_percentage, obtained_marks)
         VALUES (?, ?, ?, ?, 'present', 1, 85.5, ?)
         ON CONFLICT (exam_id, student_id) DO UPDATE SET
           status = 'present',
           attendance_percentage = COALESCE(exam_student.attendance_percentage, EXCLUDED.attendance_percentage),
           obtained_marks = COALESCE(exam_student.obtained_marks, EXCLUDED.obtained_marks)`,
        [
          examId,
          e.student_id,
          e.enrollment_id,
          e.usn,
          Math.min(def.marks, 12 + stuIdx * 7 + (def.type === 'see' ? 40 : 0)),
        ]
      );
      let compSum = 0;
      for (let i = 0; i < compIds.length; i++) {
        const comp = compIds[i];
        if (!comp.id) continue;
        const piece = Math.min(comp.max, Math.round(comp.max * (0.55 + stuIdx * 0.12 + i * 0.05)));
        compSum += piece;
        await run(
          `INSERT INTO exam_component_marks (exam_component_id, student_id, marks_obtained) VALUES (?, ?, ?)
           ON CONFLICT (exam_component_id, student_id) DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained`,
          [comp.id, e.student_id, piece]
        );
      }
      await run(`UPDATE exam_student SET obtained_marks = ? WHERE exam_id = ? AND student_id = ?`, [
        Math.min(def.marks, compSum || 10 + stuIdx * 5),
        examId,
        e.student_id,
      ]);
      stuIdx += 1;
    }
  }

  for (const e of enrollments) {
    await run(
      `INSERT INTO exam_summary (student_id, usn, course_id, cie1_marks, cie2_marks, cie3_marks, see_marks, grade, grade_points, attempt_number, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
       ON CONFLICT (student_id, course_id, attempt_number) DO UPDATE SET
         usn = EXCLUDED.usn,
         cie1_marks = EXCLUDED.cie1_marks,
         cie2_marks = EXCLUDED.cie2_marks,
         cie3_marks = EXCLUDED.cie3_marks,
         see_marks = EXCLUDED.see_marks,
         grade = EXCLUDED.grade,
         grade_points = EXCLUDED.grade_points,
         updated_at = NOW()`,
      [
        e.student_id,
        e.usn,
        ctx.course_id,
        38 + (e.student_id % 5),
        32 + (e.student_id % 4),
        24 + (e.student_id % 3),
        68 + (e.student_id % 8),
        'B+',
        7.5,
      ]
    );
  }

  if (!adminUser) return;

  const ensureQuestion = async (text, qtype, optionsJson, label) => {
    const row = await get(`SELECT id FROM feedback_question_bank WHERE label = ? LIMIT 1`, [label]);
    if (row) return row.id;
    const opt = optionsJson == null ? null : JSON.stringify(optionsJson);
    const r = await run(
      `INSERT INTO feedback_question_bank (question_text, question_type, options, label)
       VALUES (?, ?, CAST(? AS JSONB), ?)`,
      [text, qtype, opt, label]
    );
    return r.lastID;
  };

  const qDemoA = await ensureQuestion(
    'Overall course satisfaction (1-5)',
    'rating',
    { min: 1, max: 5 },
    'demo_rating_overall'
  );
  const qDemoB = await ensureQuestion(
    'Pace of the course',
    'rating',
    { min: 1, max: 5 },
    'demo_rating_pace'
  );
  const qDemoC = await ensureQuestion(
    'Best part of the course?',
    'text',
    null,
    'demo_text_best'
  );
  const qDemoD = await ensureQuestion(
    'Would you recommend this course?',
    'mcq',
    { choices: ['Yes', 'Maybe', 'No'] },
    'demo_mcq_recommend'
  );

  let tplFull = await get(
    `SELECT id FROM feedback_template WHERE title = 'CampusAI — Full demo feedback' LIMIT 1`
  );
  if (!tplFull) {
    const tr = await run(
      `INSERT INTO feedback_template (title, description, created_by_user_id)
       VALUES ('CampusAI — Full demo feedback', 'Dummy template for UI testing', ?)`,
      [adminUser.id]
    );
    tplFull = { id: tr.lastID };
  }
  if (tplFull?.id && qDemoA && qDemoB && qDemoC && qDemoD) {
    const cnt = await get(
      `SELECT COUNT(*)::int AS c FROM feedback_template_questions WHERE template_id = ?`,
      [tplFull.id]
    );
    if (cnt && cnt.c === 0) {
      await run(
        `INSERT INTO feedback_template_questions (template_id, question_id, order_index) VALUES (?, ?, 1)`,
        [tplFull.id, qDemoA]
      );
      await run(
        `INSERT INTO feedback_template_questions (template_id, question_id, order_index) VALUES (?, ?, 2)`,
        [tplFull.id, qDemoB]
      );
      await run(
        `INSERT INTO feedback_template_questions (template_id, question_id, order_index) VALUES (?, ?, 3)`,
        [tplFull.id, qDemoC]
      );
      await run(
        `INSERT INTO feedback_template_questions (template_id, question_id, order_index) VALUES (?, ?, 4)`,
        [tplFull.id, qDemoD]
      );
    }
  }

  const formExists = await get(
    `SELECT fi.id FROM feedback_form_instance fi
     WHERE fi.course_section_id = ? AND fi.template_id = ?
     LIMIT 1`,
    [ctx.section_id, tplFull.id]
  );
  if (!formExists && tplFull?.id) {
    await run(
      `INSERT INTO feedback_form_instance (template_id, faculty_id, course_section_id, start_date, end_date, status)
       VALUES (?, ?, ?, CURRENT_DATE - 14, CURRENT_DATE + 60, 'active')`,
      [tplFull.id, ctx.faculty_id, ctx.section_id]
    );
  }

  const formRow = await get(
    `SELECT fi.id FROM feedback_form_instance fi
     JOIN feedback_template t ON t.id = fi.template_id
     WHERE fi.course_section_id = ? AND t.title = 'CampusAI — Full demo feedback'
     LIMIT 1`,
    [ctx.section_id]
  );
  const stu1 = enrollments[0];
  if (formRow?.id && stu1 && qDemoA && qDemoB && qDemoC && qDemoD) {
    const resp = await get(`SELECT id FROM feedback_response WHERE form_id = ? AND student_id = ?`, [
      formRow.id,
      stu1.student_id,
    ]);
    let responseId = resp?.id;
    if (!responseId) {
      const rr = await run(
        `INSERT INTO feedback_response (form_id, student_id) VALUES (?, ?)`,
        [formRow.id, stu1.student_id]
      );
      responseId = rr.lastID;
    }
    if (responseId) {
      const answers = [
        [qDemoA, '4'],
        [qDemoB, '5'],
        [qDemoC, 'Good labs and clear explanations.'],
        [qDemoD, 'Yes'],
      ];
      for (const [qid, ans] of answers) {
        await run(
          `INSERT INTO feedback_answers (response_id, question_id, answer) VALUES (?, ?, ?)
           ON CONFLICT (response_id, question_id) DO UPDATE SET answer = EXCLUDED.answer`,
          [responseId, qid, ans]
        );
      }
    }
  }

  const ctxDs = await get(
    `SELECT cs.id AS section_id, cof.faculty_id
     FROM course_section cs
     JOIN course_offering co ON co.id = cs.course_offering_id
     JOIN course c ON c.id = co.course_id AND c.course_code = 'DS101'
     JOIN course_offering_faculty cof ON cof.course_section_id = cs.id
     LIMIT 1`
  );
  if (ctxDs && tplFull?.id) {
    const f2 = await get(
      `SELECT id FROM feedback_form_instance WHERE course_section_id = ? AND template_id = ? LIMIT 1`,
      [ctxDs.section_id, tplFull.id]
    );
    if (!f2) {
      await run(
        `INSERT INTO feedback_form_instance (template_id, faculty_id, course_section_id, start_date, end_date, status)
         VALUES (?, ?, ?, CURRENT_DATE - 7, CURRENT_DATE + 45, 'active')`,
        [tplFull.id, ctxDs.faculty_id, ctxDs.section_id]
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
  await applyIdempotentIndexesAndColumns();
  await createExamAndFeedbackTables();
  await createAcademicExtrasTables();
  await seedRoles();
  await seedRvUniversity();
  await seedDummyUsers();
  await seedExtendedDemoIfNeeded();
  await seedExamFeedbackIfMissing();
  await seedExpandDemoData();
}

module.exports = { initDb };
