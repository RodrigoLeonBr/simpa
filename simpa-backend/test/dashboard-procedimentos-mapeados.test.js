/**
 * Integration — dashboard planejamento reflects consolidator v3.2.0 (task_06)
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

const COMP = '2099-03-01';
const UNIDADE = 'SMOKE DASH UNIDADE';
const EQUIPE = 'SMOKE DASH EQUIPE';

function request(urlPath) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, baseUrl);
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET' },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let body = data;
          try { body = JSON.parse(data); } catch { /* raw */ }
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

before(async () => {
  await query(`DELETE FROM dados_consolidados WHERE unidade = $1`, [UNIDADE]);
  await query(
    `INSERT INTO dados_consolidados (competencia, unidade, equipe, versao_schema, dados_conteudo)
     VALUES ($1::date, $2, $3, '3.2.0', $4::jsonb)`,
    [
      COMP,
      UNIDADE,
      EQUIPE,
      JSON.stringify({
        kpis_gerais: {
          total_atendimentos_aps: 1,
          total_procedimentos_ambulatoriais: 0,
          total_participantes_coletivos: 0,
          atendimentos_odonto: 0,
        },
        modulos: {
          atencao_primaria_esus: {
            distribuicao_turnos: [],
            temas_coletivos: [],
            distribuicao_faixa_etaria: [],
            historico_mensal: [],
            procedimentos_mapeados: [
              {
                secao: 'SMOKE',
                descricao_esus: 'label',
                codigo_sigtap: '0101010015',
                descricao_sigtap: 'x',
                quantidade: 2,
              },
            ],
          },
          ambulatorial_sia: { status_conexao: 'PENDING', procedimentos_especializados: [] },
          hospitalar_sihd: { status_importacao: 'PENDING_AIH_FILE', internacoes_por_capitulo_cid: [] },
          financiamento_metas: { classificacao_geral: 'BOM', indicadores: [] },
          elementos_futuros: {},
        },
        emendas_parlamentares: [],
      }),
    ]
  );

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await query(`DELETE FROM dados_consolidados WHERE unidade = $1`, [UNIDADE]);
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

describe('GET /api/v1/dashboard/planejamento v3.2.0', () => {
  it('returns versao_schema 3.2.0 with procedimentos_mapeados', async () => {
    const q = new URLSearchParams({
      competencia: '2099-03',
      unidade: UNIDADE,
      equipe: EQUIPE,
    });
    const res = await request(`/api/v1/dashboard/planejamento?${q}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.versao_schema, '3.2.0');
    const mapped = res.body.modulos.atencao_primaria_esus.procedimentos_mapeados;
    assert.ok(Array.isArray(mapped));
    assert.equal(mapped.length, 1);
    assert.equal(mapped[0].codigo_sigtap, '0101010015');
  });
});
