const router = require('express').Router();
const verifyJWT = require('../middleware/verifyJWT');
const {
  parseCompetencia,
  getPopulacao,
  listPopulacaoCompetencias,
} = require('../services/populacaoService');

router.use(verifyJWT);

router.get('/competencias', async (req, res, next) => {
  try {
    const result = await listPopulacaoCompetencias();
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { competencia, estabelecimento_id } = req.query;

    const parsed = parseCompetencia(competencia);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const estabelecimentoId =
      estabelecimento_id != null && estabelecimento_id !== ''
        ? Number.parseInt(String(estabelecimento_id), 10)
        : null;

    if (estabelecimento_id != null && estabelecimento_id !== '' && !Number.isFinite(estabelecimentoId)) {
      return res.status(400).json({ error: 'estabelecimento_id inválido' });
    }

    const data = await getPopulacao({
      competencia: parsed.date,
      estabelecimentoId,
    });

    if (!data) {
      return res
        .status(404)
        .json({ error: 'Sem dados para a competência/unidade selecionada' });
    }

    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
