#!/usr/bin/env node
/**
 * Seed usuário admin padrão (Task 04).
 * Credenciais: admin / simpa@2026 — altere a senha em produção.
 */
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const envPath = process.env.DOTENV_PATH || path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'simpa@2026';
const DEFAULT_NOME = 'Administrador SIMPA';
const DEFAULT_PERFIL = 'Administrador';

async function main() {
  const pool = new Pool({
    host: process.env.PG_HOST,
    port: parseInt(process.env.PG_PORT || '5432', 10),
    database: process.env.PG_DB,
    user: process.env.PG_USER,
    password: process.env.PG_PASS,
  });

  const senhaHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const result = await pool.query(
    `INSERT INTO usuarios (username, senha_hash, nome, perfil)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username) DO NOTHING
     RETURNING id, username`,
    [DEFAULT_USERNAME, senhaHash, DEFAULT_NOME, DEFAULT_PERFIL]
  );

  if (result.rowCount === 0) {
    console.log(`Usuário "${DEFAULT_USERNAME}" já existe — seed ignorado.`);
  } else {
    console.log(`Usuário admin criado: ${result.rows[0].username} (id=${result.rows[0].id})`);
    console.log('Senha padrão: simpa@2026 — altere em produção.');
  }

  await pool.end();
}

main().catch((err) => {
  console.error('seed-admin falhou:', err.message);
  process.exit(1);
});
