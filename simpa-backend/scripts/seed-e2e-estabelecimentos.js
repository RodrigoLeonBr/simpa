#!/usr/bin/env node
/**
 * Seed estabelecimentos for Playwright E2E (one row per Painel perfil + Outro).
 * Idempotent: skips rows that already exist by codigo_externo.
 */
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const envPath = process.env.DOTENV_PATH || path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const ROWS = [
  { codigo_externo: 'E2E001', nome: 'E2E UBS APS', perfil: 'APS', tipouni: '1' },
  { codigo_externo: 'E2E002', nome: 'E2E Clínica MAC', perfil: 'MAC', tipouni: '2' },
  { codigo_externo: 'E2E003', nome: 'E2E Hospital E2E', perfil: 'Hospitalar', tipouni: '3' },
  { codigo_externo: 'E2E004', nome: 'E2E Unidade Mista', perfil: 'Misto', tipouni: '3' },
];

async function main() {
  const pool = new Pool({
    host: process.env.PG_HOST,
    port: parseInt(process.env.PG_PORT || '5432', 10),
    database: process.env.PG_DB,
    user: process.env.PG_USER,
    password: process.env.PG_PASS,
  });

  let inserted = 0;

  for (const row of ROWS) {
    const result = await pool.query(
      `INSERT INTO estabelecimentos (
         codigo_externo, nome, tipouni, perfil, status, perfil_editado, sincronizado_em
       )
       VALUES ($1, $2, $3, $4, 'ativo', false, now())
       ON CONFLICT (codigo_externo) DO NOTHING
       RETURNING id`,
      [row.codigo_externo, row.nome, row.tipouni, row.perfil],
    );

    if (result.rowCount > 0) {
      inserted += 1;
    }
  }

  console.log(
    inserted > 0
      ? `E2E estabelecimentos: ${inserted} inserido(s), ${ROWS.length - inserted} já existente(s).`
      : `E2E estabelecimentos: todos os ${ROWS.length} registros já existiam.`,
  );

  await pool.end();
}

main().catch((err) => {
  console.error('seed-e2e-estabelecimentos falhou:', err.message);
  process.exit(1);
});
