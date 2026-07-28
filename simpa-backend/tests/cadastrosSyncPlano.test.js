const { parsePlanOutput } = require('../src/services/cadastrosSync');

describe('parsePlanOutput', () => {
  it('parseia JSON de plano', () => {
    const stdout = JSON.stringify({
      status: 'ok',
      estabelecimentos: [{ chave: '111', tipo: 'novo', diff: { nome: { mysql: 'UBS A' } } }],
      procedimentos: [],
      resumo: { estabelecimentos: { novo: 1, alterado: 0, sumiu: 0 }, procedimentos: { novo: 0, alterado: 0, sumiu: 0 } },
      sincronizado_em: '2026-07-28T12:00:00+00:00',
    });
    const plan = parsePlanOutput(stdout);
    expect(plan.estabelecimentos).toHaveLength(1);
    expect(plan.resumo.estabelecimentos.novo).toBe(1);
  });

  it('propaga status erro do python', () => {
    const stdout = JSON.stringify({ status: 'erro', erro: 'PG down' });
    expect(() => parsePlanOutput(stdout)).toThrow('PG down');
  });
});
