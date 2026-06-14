const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.PG_HOST,
  port:     parseInt(process.env.PG_PORT),
  database: process.env.PG_DB,
  user:     process.env.PG_USER,
  password: process.env.PG_PASS,
});

pool.on('error', (err) => {
  console.error('pg pool error:', err.message);
});

async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

module.exports = { pool, query };
