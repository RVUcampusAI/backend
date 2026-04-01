const { get } = require('../db/database');

async function getRoleByName(roleName) {
  return await get(`SELECT id, role_name FROM role WHERE role_name = ?`, [roleName]);
}

async function getRoleById(id) {
  return await get(`SELECT id, role_name FROM role WHERE id = ?`, [id]);
}

module.exports = { getRoleByName, getRoleById };

