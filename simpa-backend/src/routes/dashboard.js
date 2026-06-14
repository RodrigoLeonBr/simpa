const express = require('express');
const { query } = require('../services/db');

const router = express.Router();

router.get('/planejamento', async (req, res, next) => {
  try {
    const { competencia, unidade, equipe } = req.query;

    if (!competencia) {
      return res.status(400).json({ error: 'parâmetro competencia obrigatório (YYYY-MM)' });
    }

    const competenciaDate = competencia + '-01';
    const conditions = ['competencia = $1'];
    const params = [competenciaDate];

    if (unidade) {
      params.push(unidade);
      conditions.push(`unidade = $${params.length}`);
    }
    if (equipe) {
      params.push(equipe);
      conditions.push(`equipe = $${params.length}`);
    }

    const where = conditions.join(' AND ');
    const { rows } = await query(
      `SELECT dados_conteudo, versao_schema, unidade, equipe, atualizado_em
       FROM dados_consolidados WHERE ${where}
       ORDER BY atualizado_em DESC LIMIT 1`,
      params
    );

    if (!rows.length) {
      return res.status(404).json({
        error: 'Dados não encontrados para os filtros informados',
        filtros: { competencia, unidade, equipe },
      });
    }

    const row = rows[0];
    res.json({
      plataforma: 'SIMPA - Sistema Integrado de Monitoramento e Planejamento de Americana',
      versao_schema: row.versao_schema,
      competencia,
      municipio: 'AMERICANA',
      filtros_ativos: { unidade: row.unidade, equipe: row.equipe },
      ...row.dados_conteudo,
    });
  } catch (err) { next(err); }
});

module.exports = router;
