/**
 * Tests — GET /api/procedimentos/export (task_05)
 * Run: node --test test/procedimentos-export.test.js
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const http = require('http');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const app = require('../src/app');
const { pool, query } = require('../src/services/db');
const {
  CSV_COLUMNS,
  csvEscape,
  rowsToCsv,
} = require('../src/routes/procedimentos');

let server;
let baseUrl;

const COMP = '2099-02-01';
const UNIDADE = 'SMOKE EXPORT UNIDADE';
const EQUIPE = 'SMOKE EXPORT EQUIPE';
const SECAO = 'SMOKE / Export Secao';
const LABEL = 'SMOKE export mapped';
const LABEL_COMMA = 'SMOKE, label "quoted"';
const CODE = '9999999601';
const CODE_COMMA = '9999999602';

function request(method, urlPath) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, baseUrl);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function parseJson(res) {
  try {
    return JSON.parse(res.body);
  } catch {
    return res.body;
  }
}

before(async () => {
  await query(`DELETE FROM esus_cargas WHERE unidade = $1`, [UNIDADE]);
  await query(`DELETE FROM esus_procedimento_map WHERE secao = $1`, [SECAO]);
  await query(
    `DELETE FROM procedimentos WHERE codigo_sigtap IN ($1, $2)`,
    [CODE, CODE_COMMA]
  );

  const proc = await query(
    `INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
     VALUES ($1, 'SMOKE EXPORT PROC', 'ambulatorial', 'SIGTAP', 'ativo', 'manual')
     RETURNING id`,
    [CODE]
  );
  const procComma = await query(
    `INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
     VALUES ($1, 'DESC, WITH "QUOTES"', 'ambulatorial', 'SIGTAP', 'ativo', 'manual')
     RETURNING id`,
    [CODE_COMMA]
  );

  await query(
    `INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
     VALUES ($1, $2, $3, 'manual', 'ativo'), ($1, $4, $5, 'manual', 'ativo')`,
    [SECAO, LABEL, proc.rows[0].id, LABEL_COMMA, procComma.rows[0].id]
  );

  const carga = await query(
    `INSERT INTO esus_cargas (
       tipo_relatorio, competencia, periodo_inicio, periodo_fim,
       municipio, unidade, equipe_nome, arquivo_origem
     ) VALUES (
       'procedimentos_individualizados', $1::date, $1::date, $1::date,
       'AMERICANA', $2, $3, 'smoke-export.csv'
     ) RETURNING id`,
    [COMP, UNIDADE, EQUIPE]
  );

  await query(
    `INSERT INTO esus_indicadores_raw (carga_id, secao, descricao, ordem, valores) VALUES
       ($1, $2, $3, 0, '{"quantidade": 12}'::jsonb),
       ($1, $2, $4, 1, '{"quantidade": 3}'::jsonb)`,
    [carga.rows[0].id, SECAO, LABEL, LABEL_COMMA]
  );

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await query(`DELETE FROM esus_cargas WHERE unidade = $1`, [UNIDADE]);
  await query(`DELETE FROM esus_procedimento_map WHERE secao = $1`, [SECAO]);
  await query(
    `DELETE FROM procedimentos WHERE codigo_sigtap IN ($1, $2)`,
    [CODE, CODE_COMMA]
  );
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

describe('csvEscape / rowsToCsv', () => {
  it('format=csv produces header line with exact column names in order', () => {
    const csv = rowsToCsv([], {
      competencia: COMP,
      unidade: UNIDADE,
      equipe: EQUIPE,
    });
    const header = csv.split(/\r?\n/)[0];
    assert.equal(header, CSV_COLUMNS.join(','));
  });

  it('CSV escapes commas/quotes in descricao fields', () => {
    assert.equal(csvEscape('a,b'), '"a,b"');
    assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
    const csv = rowsToCsv(
      [
        {
          secao: SECAO,
          descricao_esus: LABEL_COMMA,
          codigo_sigtap: CODE_COMMA,
          descricao_sigtap: 'DESC, WITH "QUOTES"',
          quantidade: 3,
        },
      ],
      { competencia: COMP, unidade: UNIDADE, equipe: EQUIPE }
    );
    assert.match(csv, /"SMOKE, label ""quoted"""/);
    assert.match(csv, /"DESC, WITH ""QUOTES"""/);
  });
});

describe('GET /api/procedimentos/export', () => {
  it('Missing competencia returns 400', async () => {
    const res = await request(
      'GET',
      `/api/procedimentos/export?unidade=${encodeURIComponent(UNIDADE)}&equipe=${encodeURIComponent(EQUIPE)}`
    );
    assert.equal(res.status, 400);
    const body = parseJson(res);
    assert.match(String(body.error || ''), /competencia/i);
  });

  it('format=json returns array of MappingLookup-shaped objects for fixture carga', async () => {
    const q = new URLSearchParams({
      competencia: '2099-02',
      unidade: UNIDADE,
      equipe: EQUIPE,
    });
    const res = await request('GET', `/api/procedimentos/export?${q}`);
    assert.equal(res.status, 200);
    const rows = parseJson(res);
    assert.ok(Array.isArray(rows));
    assert.ok(rows.length >= 2);
    const hit = rows.find((r) => r.descricao_esus === LABEL);
    assert.ok(hit);
    assert.equal(hit.codigo_sigtap, CODE);
    assert.equal(Number(hit.quantidade), 12);
    assert.equal(hit.secao, SECAO);
    assert.ok('descricao_sigtap' in hit);
  });

  it('format=csv downloads with Content-Disposition filename containing competencia', async () => {
    const q = new URLSearchParams({
      competencia: '2099-02',
      unidade: UNIDADE,
      equipe: EQUIPE,
      format: 'csv',
    });
    const res = await request('GET', `/api/procedimentos/export?${q}`);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'] || '', /text\/csv/);
    assert.match(
      res.headers['content-disposition'] || '',
      /procedimentos-mapeados-2099-02\.csv/
    );
    const header = res.body.split(/\r?\n/)[0];
    assert.equal(header, CSV_COLUMNS.join(','));
    assert.match(res.body, new RegExp(CODE));
  });

  it('Empty mapping set returns [] / header-only CSV with 200', async () => {
    const qJson = new URLSearchParams({
      competencia: '2099-02',
      unidade: UNIDADE,
      equipe: 'EQUIPE SEM CARGA',
      format: 'json',
    });
    const resJson = await request('GET', `/api/procedimentos/export?${qJson}`);
    assert.equal(resJson.status, 200);
    assert.deepEqual(parseJson(resJson), []);

    const qCsv = new URLSearchParams({
      competencia: '2099-02',
      unidade: UNIDADE,
      equipe: 'EQUIPE SEM CARGA',
      format: 'csv',
    });
    const resCsv = await request('GET', `/api/procedimentos/export?${qCsv}`);
    assert.equal(resCsv.status, 200);
    const lines = resCsv.body.replace(/\r\n$/, '').split(/\r?\n/).filter(Boolean);
    assert.equal(lines.length, 1);
    assert.equal(lines[0], CSV_COLUMNS.join(','));
  });
});
