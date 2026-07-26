/**
 * Tests for resolveMappedProcedures (task_04)
 * Run: node --test test/procedimentoMap.test.js
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { pool, query } = require('../src/services/db');
const {
  normalizeCompetencia,
  resolveMappedProcedures,
} = require('../src/services/procedimentoMap');

const COMP = '2099-01-01';
const UNIDADE = 'SMOKE RESOLVE UNIDADE';
const EQUIPE_A = 'SMOKE RESOLVE EQUIPE A';
const EQUIPE_B = 'SMOKE RESOLVE EQUIPE B';
const SECAO = 'SMOKE / Resolve Secao';
const LABEL_MAPPED = 'SMOKE mapped label';
const LABEL_UNMAPPED = 'SMOKE unmapped label';
const LABEL_INACTIVE = 'SMOKE inactive map label';
const LABEL_INACTIVE_PROC = 'SMOKE label inactive proc';
const CODE = '9999999701';
const CODE_INACTIVE_PROC = '9999999702';

let cargaAId;
let cargaBId;
let procId;
let procInactiveId;

before(async () => {
  await query(`DELETE FROM esus_cargas WHERE unidade = $1`, [UNIDADE]);
  await query(`DELETE FROM esus_procedimento_map WHERE secao = $1`, [SECAO]);
  await query(
    `DELETE FROM procedimentos WHERE codigo_sigtap IN ($1, $2)`,
    [CODE, CODE_INACTIVE_PROC]
  );

  const proc = await query(
    `INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
     VALUES ($1, 'SMOKE RESOLVE PROC', 'ambulatorial', 'SIGTAP', 'ativo', 'manual')
     RETURNING id`,
    [CODE]
  );
  procId = proc.rows[0].id;

  const procIn = await query(
    `INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
     VALUES ($1, 'SMOKE RESOLVE PROC INACTIVE', 'ambulatorial', 'SIGTAP', 'inativo', 'manual')
     RETURNING id`,
    [CODE_INACTIVE_PROC]
  );
  procInactiveId = procIn.rows[0].id;

  await query(
    `INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
     VALUES ($1, $2, $3, 'manual', 'ativo')`,
    [SECAO, LABEL_MAPPED, procId]
  );

  await query(
    `INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
     VALUES ($1, $2, $3, 'manual', 'inativo')`,
    [SECAO, LABEL_INACTIVE, procId]
  );

  await query(
    `INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
     VALUES ($1, $2, $3, 'manual', 'ativo')`,
    [SECAO, LABEL_INACTIVE_PROC, procInactiveId]
  );

  const cargaA = await query(
    `INSERT INTO esus_cargas (
       tipo_relatorio, competencia, periodo_inicio, periodo_fim,
       municipio, unidade, equipe_nome, arquivo_origem
     ) VALUES (
       'procedimentos_individualizados', $1::date, $1::date, $1::date,
       'AMERICANA', $2, $3, 'smoke-resolve-a.csv'
     ) RETURNING id`,
    [COMP, UNIDADE, EQUIPE_A]
  );
  cargaAId = cargaA.rows[0].id;

  const cargaB = await query(
    `INSERT INTO esus_cargas (
       tipo_relatorio, competencia, periodo_inicio, periodo_fim,
       municipio, unidade, equipe_nome, arquivo_origem
     ) VALUES (
       'procedimentos_individualizados', $1::date, $1::date, $1::date,
       'AMERICANA', $2, $3, 'smoke-resolve-b.csv'
     ) RETURNING id`,
    [COMP, UNIDADE, EQUIPE_B]
  );
  cargaBId = cargaB.rows[0].id;

  await query(
    `INSERT INTO esus_indicadores_raw (carga_id, secao, descricao, ordem, valores) VALUES
       ($1, $2, $3, 0, '{"quantidade": 10}'::jsonb),
       ($1, $2, $4, 1, '{"quantidade": 99}'::jsonb),
       ($1, $2, $5, 2, '{"quantidade": 50}'::jsonb),
       ($1, $2, $6, 3, '{"quantidade": 77}'::jsonb)`,
    [cargaAId, SECAO, LABEL_MAPPED, LABEL_UNMAPPED, LABEL_INACTIVE, LABEL_INACTIVE_PROC]
  );

  await query(
    `INSERT INTO esus_indicadores_raw (carga_id, secao, descricao, ordem, valores) VALUES
       ($1, $2, $3, 0, '{"quantidade": 5}'::jsonb)`,
    [cargaBId, SECAO, LABEL_MAPPED]
  );
});

after(async () => {
  await query(`DELETE FROM esus_cargas WHERE unidade = $1`, [UNIDADE]);
  await query(`DELETE FROM esus_procedimento_map WHERE secao = $1`, [SECAO]);
  await query(
    `DELETE FROM procedimentos WHERE codigo_sigtap IN ($1, $2)`,
    [CODE, CODE_INACTIVE_PROC]
  );
  await pool.end();
});

describe('normalizeCompetencia', () => {
  it('expands YYYY-MM to YYYY-MM-01', () => {
    assert.equal(normalizeCompetencia('2026-05'), '2026-05-01');
  });

  it('keeps YYYY-MM-DD', () => {
    assert.equal(normalizeCompetencia('2026-05-01'), '2026-05-01');
  });

  it('throws on missing competencia', () => {
    assert.throws(() => normalizeCompetencia(''), { status: 400 });
    assert.throws(() => normalizeCompetencia(null), { status: 400 });
  });
});

describe('resolveMappedProcedures', () => {
  it('returns codigo_sigtap and quantidade for mapped raw row', async () => {
    const rows = await resolveMappedProcedures(COMP, UNIDADE, EQUIPE_A);
    const hit = rows.find((r) => r.descricao_esus === LABEL_MAPPED);
    assert.ok(hit);
    assert.equal(hit.codigo_sigtap, CODE);
    assert.equal(Number(hit.quantidade), 10);
    assert.equal(hit.secao, SECAO);
  });

  it('raw row without map does not appear', async () => {
    const rows = await resolveMappedProcedures(COMP, UNIDADE, EQUIPE_A);
    assert.ok(!rows.some((r) => r.descricao_esus === LABEL_UNMAPPED));
  });

  it('inactive map does not appear even if raw exists', async () => {
    const rows = await resolveMappedProcedures(COMP, UNIDADE, EQUIPE_A);
    assert.ok(!rows.some((r) => r.descricao_esus === LABEL_INACTIVE));
  });

  it('active map to inactive procedimento does not appear', async () => {
    const rows = await resolveMappedProcedures(COMP, UNIDADE, EQUIPE_A);
    assert.ok(!rows.some((r) => r.descricao_esus === LABEL_INACTIVE_PROC));
  });

  it('filter by competencia+unidade+equipe returns only that carga', async () => {
    const rowsA = await resolveMappedProcedures(COMP, UNIDADE, EQUIPE_A);
    const rowsB = await resolveMappedProcedures(COMP, UNIDADE, EQUIPE_B);
    assert.equal(Number(rowsA.find((r) => r.descricao_esus === LABEL_MAPPED).quantidade), 10);
    assert.equal(Number(rowsB.find((r) => r.descricao_esus === LABEL_MAPPED).quantidade), 5);
  });

  it('two equipes do not leak quantities across filters', async () => {
    const rowsA = await resolveMappedProcedures('2099-01', UNIDADE, EQUIPE_A);
    const rowsB = await resolveMappedProcedures('2099-01', UNIDADE, EQUIPE_B);
    assert.equal(rowsA.length, 1);
    assert.equal(rowsB.length, 1);
    assert.equal(Number(rowsA[0].quantidade), 10);
    assert.equal(Number(rowsB[0].quantidade), 5);
  });

  it('throws 400 when unidade or equipe missing', async () => {
    await assert.rejects(() => resolveMappedProcedures(COMP, '', EQUIPE_A), { status: 400 });
    await assert.rejects(() => resolveMappedProcedures(COMP, UNIDADE, ''), { status: 400 });
  });
});
