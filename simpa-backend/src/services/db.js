const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const envPath = process.env.DOTENV_PATH || path.join(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DB,
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
});

pool.on('error', (err) => {
  console.error('pg pool error:', err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
