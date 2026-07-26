/**
 * Integration tests — Cadastros procedimentos + esus-procedimento-map (task_03)
 * Run from simpa-backend: node --test test/cadastros-procedimentos.test.js
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const http = require('http');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const app = require('../src/app');
const { pool, query } = require('../src/services/db');

let server;
let baseUrl;
const CODE = '9999999801';
const CODE2 = '9999999802';
let mapId;
let procId;

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, baseUrl);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try { json = data ? JSON.parse(data) : null; } catch { json = data; }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

before(async () => {
  await query(`DELETE FROM esus_procedimento_map WHERE descricao_esus LIKE 'SMOKE API%'`);
  await query(`DELETE FROM procedimentos WHERE codigo_sigtap IN ($1, $2)`, [CODE, CODE2]);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await query(`DELETE FROM esus_procedimento_map WHERE descricao_esus LIKE 'SMOKE API%'`);
  await query(`DELETE FROM procedimentos WHERE codigo_sigtap IN ($1, $2)`, [CODE, CODE2]);
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

describe('POST /api/cadastros/procedimentos', () => {
  it('returns 400 without codigo_sigtap', async () => {
    const res = await request('POST', '/api/cadastros/procedimentos', { descricao: 'x' });
    assert.equal(res.status, 400);
  });

  it('creates procedimento and rejects duplicate with 409', async () => {
    const res = await request('POST', '/api/cadastros/procedimentos', {
      codigo_sigtap: CODE,
      descricao: 'SMOKE API PROC',
      tipo: 'ambulatorial',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.codigo_sigtap, CODE);
    procId = res.body.id;

    const dup = await request('POST', '/api/cadastros/procedimentos', {
      codigo_sigtap: CODE,
      descricao: 'SMOKE API DUP',
    });
    assert.equal(dup.status, 409);
  });
});

describe('esus-procedimento-map CRUD', () => {
  it('POST with codigo_sigtap returns joined row', async () => {
    const res = await request('POST', '/api/cadastros/esus-procedimento-map', {
      secao: 'Procedimentos - Teste rápido',
      descricao_esus: 'SMOKE API Para HIV',
      codigo_sigtap: CODE,
      origem: 'manual',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.codigo_sigtap, CODE);
    assert.equal(res.body.descricao_sigtap, 'SMOKE API PROC');
    assert.equal(res.body.secao, 'Procedimentos - Teste rápido');
    mapId = res.body.id;
  });

  it('GET filters by secao and q=HIV', async () => {
    const res = await request(
      'GET',
      '/api/cadastros/esus-procedimento-map?secao=' +
        encodeURIComponent('Procedimentos - Teste rápido') +
        '&q=HIV'
    );
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.some((r) => r.id === mapId && /HIV/i.test(r.descricao_esus)));
  });

  it('PUT changing procedimento_id persists', async () => {
    const created = await request('POST', '/api/cadastros/procedimentos', {
      codigo_sigtap: CODE2,
      descricao: 'SMOKE API PROC 2',
      tipo: 'ambulatorial',
    });
    assert.equal(created.status, 201);

    const put = await request('PUT', `/api/cadastros/esus-procedimento-map/${mapId}`, {
      procedimento_id: created.body.id,
    });
    assert.equal(put.status, 200);
    assert.equal(put.body.codigo_sigtap, CODE2);

    const get = await request('GET', `/api/cadastros/esus-procedimento-map?q=SMOKE%20API%20Para`);
    const row = get.body.find((r) => r.id === mapId);
    assert.equal(row.codigo_sigtap, CODE2);
  });

  it('DELETE soft-inactivates and default GET omits it', async () => {
    const del = await request('DELETE', `/api/cadastros/esus-procedimento-map/${mapId}`);
    assert.equal(del.status, 200);
    assert.equal(del.body.inativado, true);

    const list = await request('GET', '/api/cadastros/esus-procedimento-map?q=SMOKE%20API%20Para');
    assert.ok(!list.body.some((r) => r.id === mapId));

    const inactive = await request(
      'GET',
      '/api/cadastros/esus-procedimento-map?status=inativo&q=SMOKE%20API%20Para'
    );
    assert.ok(inactive.body.some((r) => r.id === mapId));
  });
});
