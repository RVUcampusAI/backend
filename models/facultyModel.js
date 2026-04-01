const { run } = require('../db/database');

async function createFaculty({ name, facultyCode, email }) {
  const res = await run(
    `INSERT INTO faculty (name, faculty_code, email) VALUES (?, ?, ?)`,
    [name, facultyCode, email]
  );
  return res.lastID;
}

module.exports = { createFaculty };

