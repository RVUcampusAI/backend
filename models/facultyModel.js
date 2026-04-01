const { run, all } = require('../db/database');

async function createFaculty({ name, facultyCode, email }) {
  const res = await run(
    `INSERT INTO faculty (name, faculty_code, email) VALUES (?, ?, ?)`,
    [name, facultyCode, email]
  );
  return res.lastID;
}

async function listFaculty() {
  return await all(
    `SELECT id, name, email, faculty_code, school_id, designation, type FROM faculty ORDER BY name`
  );
}

module.exports = { createFaculty, listFaculty };

