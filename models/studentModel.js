const { run, get, all } = require('../db/database');

async function createStudent({ name, usn, email }) {
  const res = await run(`INSERT INTO students (name, usn, email) VALUES (?, ?, ?)`, [
    name,
    usn,
    email,
  ]);
  return res.lastID;
}

async function listStudents() {
  return await all(`SELECT * FROM students ORDER BY created_at DESC`);
}

async function getStudent(id) {
  return await get(`SELECT * FROM students WHERE id = ?`, [id]);
}

async function updateStudentAffiliation(
  id,
  { school_id, program_id, batch_id, major_id, minor_id, specialization_id }
) {
  await run(
    `UPDATE students SET
      school_id = ?, program_id = ?, batch_id = ?,
      major_id = ?, minor_id = ?, specialization_id = ?
     WHERE id = ?`,
    [
      school_id ?? null,
      program_id ?? null,
      batch_id ?? null,
      major_id ?? null,
      minor_id ?? null,
      specialization_id ?? null,
      id,
    ]
  );
}

module.exports = {
  createStudent,
  listStudents,
  getStudent,
  updateStudentAffiliation,
};
