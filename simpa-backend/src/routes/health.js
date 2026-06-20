const express = require('express');
const { query } = require('../services/db');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    await query('SELECT 1 AS ok');
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
      schema_tables: tables.rows.map((row) => row.tablename),
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

module.exports = router;
