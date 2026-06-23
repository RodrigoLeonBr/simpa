const { query } = require('./db');
const {
  SQL_CANONICAL_FORMA_EXPR,
  SQL_CANONICAL_CBO_EXPR,
} = require('./cadastroReferenciaService');

let siaProducaoColumnsCache = null;

async function getSiaProducaoColumns() {
  if (siaProducaoColumnsCache) {
    return siaProducaoColumnsCache;
  }
  const { rows } = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'sia_producao'
       AND column_name IN ('quantidade_apresentada', 'valor_apresentado')`
  );
  siaProducaoColumnsCache = new Set(rows.map((row) => row.column_name));
  return siaProducaoColumnsCache;
}

async function listProducao(queryParams = {}) {
  const { competencia, unidade, codigo_sigtap, estabelecimento_id } = queryParams;
  const conditions = [];
  const params = [];
  const columns = await getSiaProducaoColumns();
  const quantidadeApresentadaSelect = columns.has('quantidade_apresentada')
    ? 'SUM(COALESCE(sp.quantidade_apresentada, 0)) AS quantidade_apresentada'
    : 'SUM(0)::bigint AS quantidade_apresentada';
  const valorApresentadoSelect = columns.has('valor_apresentado')
    ? 'SUM(COALESCE(sp.valor_apresentado, 0)) AS valor_apresentado'
    : 'SUM(0)::numeric AS valor_apresentado';

  if (competencia) {
    params.push(`${competencia}-01`);
    conditions.push(`sp.competencia = $${params.length}`);
  }
  if (unidade) {
    params.push(`%${unidade}%`);
    conditions.push(`sp.unidade ILIKE $${params.length}`);
  }
  if (codigo_sigtap) {
    params.push(codigo_sigtap);
    conditions.push(`sp.codigo_sigtap = $${params.length}`);
  }
  if (estabelecimento_id) {
    params.push(estabelecimento_id);
    conditions.push(`sp.estabelecimento_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT sp.codigo_sigtap, sp.descricao, sp.faixa_etaria, sp.sexo, sp.cbo,
            SUM(sp.quantidade) AS quantidade, SUM(sp.valor_aprovado) AS valor_aprovado,
            ${quantidadeApresentadaSelect},
            ${valorApresentadoSelect},
            fs.descricao AS descricao_forma,
            cs.descricao AS descricao_cbo
     FROM sia_producao sp
     LEFT JOIN formas_sia fs
       ON fs.codigo_forma = ${SQL_CANONICAL_FORMA_EXPR} AND fs.status = 'ativo'
     LEFT JOIN cbos_sia cs
       ON cs.codigo_cbo = ${SQL_CANONICAL_CBO_EXPR} AND cs.status = 'ativo'
     ${where}
     GROUP BY sp.codigo_sigtap, sp.descricao, sp.faixa_etaria, sp.sexo, sp.cbo,
              fs.descricao, cs.descricao
     ORDER BY quantidade DESC`,
    params
  );

  return rows;
}

module.exports = {
  listProducao,
  __resetSiaProducaoColumnsCache: () => {
    siaProducaoColumnsCache = null;
  },
};
