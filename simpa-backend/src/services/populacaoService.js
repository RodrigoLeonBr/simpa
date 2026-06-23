const { query } = require('./db');

const COMPETENCIA_RE = /^\d{4}-\d{2}$/;

function parseCompetencia(value) {
  if (!value || typeof value !== 'string') {
    return { ok: false, error: 'parâmetro competencia obrigatório (YYYY-MM)' };
  }
  if (!COMPETENCIA_RE.test(value)) {
    return { ok: false, error: 'competencia inválida — use YYYY-MM' };
  }
  return { ok: true, date: `${value}-01` };
}

/**
 * Merges faixa_etaria arrays from multiple rows, summing counts per faixa name.
 * @param {Array<Array<{faixa: string, masculino: number, feminino: number, indeterminado?: number}>>} arrays
 */
function _mergeFaixaEtaria(arrays) {
  const map = new Map();
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const band of arr) {
      if (!band || !band.faixa) continue;
      const existing = map.get(band.faixa) || { faixa: band.faixa, masculino: 0, feminino: 0, indeterminado: 0 };
      existing.masculino += band.masculino || 0;
      existing.feminino += band.feminino || 0;
      existing.indeterminado += band.indeterminado || 0;
      map.set(band.faixa, existing);
    }
  }
  return Array.from(map.values());
}

/**
 * Merges condicoes_saude objects from multiple rows, summing sim/nao/nao_informado per condition.
 * @param {Array<Object>} objects
 */
function _mergeCondicoesSaude(objects) {
  const result = {};
  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') continue;
    for (const [key, counts] of Object.entries(obj)) {
      if (!counts || typeof counts !== 'object') continue;
      if (!result[key]) {
        result[key] = { sim: 0, nao: 0, nao_informado: 0 };
      }
      result[key].sim += counts.sim || 0;
      result[key].nao += counts.nao || 0;
      result[key].nao_informado += counts.nao_informado || 0;
    }
  }
  return result;
}

/**
 * Merges raca_cor objects from multiple rows, summing counts per category.
 * @param {Array<Object>} objects
 */
function _mergeRacaCor(objects) {
  const result = {};
  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') continue;
    for (const [key, val] of Object.entries(obj)) {
      result[key] = (result[key] || 0) + (val || 0);
    }
  }
  return result;
}

/**
 * Aggregates multiple populacao_cadastrada rows (from different units) into a single response object.
 * @param {Array<Object>} rows - rows from populacao_cadastrada JOIN estabelecimentos
 */
function _aggregate(rows) {
  let totalAtivos = 0;
  let totalSaidas = 0;
  const porUnidade = [];
  const faixaArrays = [];
  const condicoesObjects = [];
  const racaCorObjects = [];
  let competencia = null;

  for (const row of rows) {
    totalAtivos += row.cidadaos_ativos || 0;
    totalSaidas += row.saidas || 0;

    porUnidade.push({
      estabelecimento_id: row.estabelecimento_id,
      estabelecimento_nome: row.estabelecimento_nome,
      cidadaos_ativos: row.cidadaos_ativos || 0,
      saidas: row.saidas || 0,
      importado_em: row.importado_em,
    });

    if (row.faixa_etaria) {
      faixaArrays.push(row.faixa_etaria);
    }
    if (row.condicoes_saude) {
      condicoesObjects.push(row.condicoes_saude);
    }
    if (row.raca_cor) {
      racaCorObjects.push(row.raca_cor);
    }

    if (!competencia) {
      // competencia from DB is a Date or string like '2026-01-01'
      const raw = row.competencia;
      if (raw) {
        const str = raw instanceof Date ? raw.toISOString() : String(raw);
        competencia = str.slice(0, 7); // 'YYYY-MM'
      }
    }
  }

  return {
    competencia,
    total_cidadaos_ativos: totalAtivos,
    total_saidas: totalSaidas,
    por_unidade: porUnidade,
    faixa_etaria: _mergeFaixaEtaria(faixaArrays),
    condicoes_saude: _mergeCondicoesSaude(condicoesObjects),
    raca_cor: _mergeRacaCor(racaCorObjects),
  };
}

/**
 * Fetches population data for a given competencia and optional unit.
 * Returns null when no rows found.
 *
 * @param {{ competencia: string, estabelecimentoId?: number|null }} options
 * @returns {Promise<Object|null>}
 */
async function getPopulacao({ competencia, estabelecimentoId }) {
  const where = estabelecimentoId
    ? 'WHERE p.competencia = $1 AND p.estabelecimento_id = $2'
    : 'WHERE p.competencia = $1';
  const params = estabelecimentoId ? [competencia, estabelecimentoId] : [competencia];

  const { rows } = await query(
    `SELECT p.estabelecimento_id, p.competencia, p.cidadaos_ativos, p.saidas,
            p.faixa_etaria, p.condicoes_saude, p.raca_cor, p.importado_em,
            e.nome AS estabelecimento_nome
     FROM populacao_cadastrada p
     JOIN estabelecimentos e ON e.id = p.estabelecimento_id
     ${where}
     ORDER BY e.nome`,
    params,
  );

  if (!rows.length) return null;
  return _aggregate(rows);
}

/**
 * Returns list of competencias that have population data, sorted descending.
 * @returns {Promise<Array<{competencia: string, unidades_count: number, total_cidadaos_ativos: number}>>}
 */
async function listPopulacaoCompetencias() {
  const { rows } = await query(
    `SELECT
       TO_CHAR(competencia, 'YYYY-MM') AS competencia,
       COUNT(*) AS unidades_count,
       SUM(cidadaos_ativos) AS total_cidadaos_ativos
     FROM populacao_cadastrada
     GROUP BY competencia
     ORDER BY competencia DESC`,
    []
  );

  return rows.map((row) => ({
    competencia: row.competencia,
    unidades_count: Number(row.unidades_count),
    total_cidadaos_ativos: Number(row.total_cidadaos_ativos),
  }));
}

module.exports = {
  parseCompetencia,
  getPopulacao,
  listPopulacaoCompetencias,
  _aggregate,
};
