const { Pool } = require('pg');
const { logDb } = require('../utils/logger');

let pool;

/** Convert SQLite-style ? placeholders to PostgreSQL $1, $2, … */
function toPgSql(sql, params) {
  let n = 0;
  const text = sql.replace(/\?/g, () => `$${++n}`);
  return { text, values: params };
}

function appendReturningIdIfInsert(sql) {
  const trimmed = sql.trim();
  if (!/^INSERT/i.test(trimmed) || /\bRETURNING\b/i.test(trimmed)) return sql;
  return trimmed.replace(/;?\s*$/, '') + ' RETURNING id';
}

async function connectDatabase(databaseUrl) {
  if (!databaseUrl || !String(databaseUrl).trim()) {
    throw new Error('DATABASE_URL is required for PostgreSQL');
  }
  const useSsl =
    String(databaseUrl).includes('supabase.co') || String(databaseUrl).includes('pooler.supabase.com');
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: 20,
    idleTimeoutMillis: 30000,
  });
  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err.message || err);
  });

  console.log('Connecting to Supabase...');
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
    console.log('Supabase connection successful');
  } catch (e) {
    console.error('Supabase connection failed:', e.message || e);
    throw e;
  }
  return pool;
}

function getPool() {
  if (!pool) throw new Error('Database not initialized; call connectDatabase first');
  return pool;
}

async function run(sql, params = []) {
  const { text, values } = toPgSql(sql, params);
  const queryText = appendReturningIdIfInsert(text);
  logDb('run', queryText, values);
  const result = await getPool().query(queryText, values);
  const isInsert = /^INSERT/i.test(text.trim());
  if (isInsert && result.rows && result.rows[0] && result.rows[0].id != null) {
    return { lastID: result.rows[0].id, changes: result.rowCount };
  }
  return { lastID: undefined, changes: result.rowCount };
}

async function get(sql, params = []) {
  const { text, values } = toPgSql(sql, params);
  logDb('get', text, values);
  const result = await getPool().query(text, values);
  return result.rows[0] ?? null;
}

async function all(sql, params = []) {
  const { text, values } = toPgSql(sql, params);
  logDb('all', text, values);
  const result = await getPool().query(text, values);
  return result.rows;
}

async function query(sql, params = []) {
  const { text, values } = toPgSql(sql, params);
  logDb('query', text, values);
  return getPool().query(text, values);
}

module.exports = {
  connectDatabase,
  getPool,
  run,
  get,
  all,
  query,
};
