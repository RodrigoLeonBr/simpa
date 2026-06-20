#!/usr/bin/env node
/**
 * Verifica conexão PostgreSQL e tabelas mínimas para login/dashboard.
 */
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const envPath = process.env.DOTENV_PATH || path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

function pgConfig() {
  return {
    host: process.env.PG_HOST || '127.0.0.1',
    port: parseInt(process.env.PG_PORT || process.env.PG_PUBLISH_PORT || '5433', 10),
    database: process.env.PG_DB || 'simpa',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASS,
  };
}

async function main() {
  const cfg = pgConfig();
  console.log(`Testando PostgreSQL em ${cfg.host}:${cfg.port}/${cfg.database} ...`);

  const pool = new Pool(cfg);

  try {
    const ping = await pool.query('SELECT 1 AS ok');
    console.log(`✓ Conexão OK (SELECT 1 → ${ping.rows[0].ok})`);

    const tables = ['usuarios', 'dados_consolidados', 'esus_cargas'];
    for (const table of tables) {
      const { rows } = await pool.query(
        `SELECT to_regclass($1) IS NOT NULL AS exists`,
        [`public.${table}`]
      );
      const exists = rows[0]?.exists;
      console.log(`${exists ? '✓' : '✗'} Tabela ${table}: ${exists ? 'presente' : 'AUSENTE'}`);
    }

    const users = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios');
    console.log(`• usuarios: ${users.rows[0].n} registro(s)`);

    const dashboard = await pool.query('SELECT COUNT(*)::int AS n FROM dados_consolidados');
    console.log(`• dados_consolidados: ${dashboard.rows[0].n} registro(s)`);

    if (users.rows[0].n === 0) {
      console.log('\nNenhum usuário encontrado. Rode: npm run seed:admin');
    }
    if (dashboard.rows[0].n === 0) {
      console.log('Painel vazio. Importe CSVs ou rode consolidate_dashboard.py --all --pg-write');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\n✗ Falha na conexão/configuração:');
  console.error(`  ${err.message}`);
  console.error('\nVerifique:');
  console.error('  1. docker compose up -d postgres');
  console.error('  2. .env com PG_HOST=127.0.0.1 e PG_PORT=5433');
  process.exit(1);
});
