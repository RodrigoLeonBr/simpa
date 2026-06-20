const express = require('express');
const cors = require('cors');
const { query } = require('./services/db');

const path = require('path');
const fs = require('fs');
const envPath = process.env.DOTENV_PATH || path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    const pg = await query('SELECT 1 AS ok');
    const tables = await query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('esus_cargas', 'usuarios', 'unidades_saude')
      ORDER BY tablename
    `);
    res.json({
      ok: true,
      service: 'simpa-api',
      postgres: 'connected',
      schema_tables: tables.rows.map((r) => r.tablename),
    });
  } catch (err) {
    res.status(503).json({
      ok: false,
      service: 'simpa-api',
      postgres: 'disconnected',
      error: err.message,
    });
  }
});

const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`SIMPA API listening on ${PORT}`);
});

module.exports = app;
