const { query } = require('./db');
const {
  SQL_CANONICAL_FORMA_EXPR,
  SQL_CANONICAL_CBO_EXPR,
} = require('./cadastroReferenciaService');

async function listProducao(queryParams = {}) {
  const { competencia, unidade, codigo_sigtap } = queryParams;
  const conditions = [];
  const params = [];

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

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT sp.codigo_sigtap, sp.descricao, sp.faixa_etaria, sp.sexo, sp.cbo,
            SUM(sp.quantidade) AS quantidade, SUM(sp.valor_aprovado) AS valor_aprovado,
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
};
