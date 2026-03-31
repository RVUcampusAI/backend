const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test the connection on startup
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  client.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      return console.error('Error executing query', err.stack);
    }
    console.log('✅ Database connected successfully at:', result.rows[0].now);
  });
});

module.exports = {
  query: (text, params) => {
    console.log(`Executing query: ${text}`);
    return pool.query(text, params);
  },
  pool,
};
