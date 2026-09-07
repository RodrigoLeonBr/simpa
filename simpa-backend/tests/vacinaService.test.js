const { computeCobertura } = require('../src/services/vacinaService');

describe('computeCobertura', () => {
  const base = [
    { imuno_codigo: '93', imuno_nome: 'HPV', grupo_id: 1, grupo_nome: 'Adolescente', doses: 200, pop_alvo: 100, num_doses: 2 },
    { imuno_codigo: '9', imuno_nome: 'Hep B', grupo_id: 1, grupo_nome: 'Adolescente', doses: 50, pop_alvo: 0, num_doses: 3 },
    { imuno_codigo: '33', imuno_nome: 'Influenza', grupo_id: 2, grupo_nome: 'Idoso', doses: 900, pop_alvo: 1000, num_doses: 1 },
  ];
  it('cobertura = doses / (pop × esquema)', () => {
    const out = computeCobertura(base);
    const hpv = out.find((r) => r.imuno_codigo === '93');
    expect(hpv.denominador).toBe(200);
    expect(hpv.cobertura_pct).toBeCloseTo(100);
    const flu = out.find((r) => r.imuno_codigo === '33');
    expect(flu.cobertura_pct).toBeCloseTo(90);
  });
  it('pop_alvo = 0 → cobertura null, sem crash', () => {
    const out = computeCobertura(base);
    expect(out.find((r) => r.imuno_codigo === '9').cobertura_pct).toBeNull();
  });
  it('coage strings numéricas do pg (doses/pop como texto)', () => {
    const out = computeCobertura([{ imuno_codigo:'1', imuno_nome:'X', grupo_id:1, grupo_nome:'G', doses:'150', pop_alvo:'100', num_doses:'1' }]);
    expect(out[0].cobertura_pct).toBeCloseTo(150);
    expect(out[0].denominador).toBe(100);
  });
});
