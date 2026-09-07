jest.mock('../src/services/db', () => ({ query: jest.fn() }));

const { query } = require('../src/services/db');
const { computeCobertura, getCobertura } = require('../src/services/vacinaService');

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

describe('getCobertura', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries db and returns computeCobertura result', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { imuno_codigo: '93', imuno_nome: 'HPV', grupo_id: 1, grupo_nome: 'Adolescente', num_doses: 2, pop_alvo: 100, doses: 200 },
      ],
    });

    const result = await getCobertura({ ano: 2026, competenciaAte: '2026-12-01', grupoId: null, imunoCodigo: null });

    expect(query).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].cobertura_pct).toBeCloseTo(100);
  });

  it('passes grupoId and imunoCodigo as filter params', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await getCobertura({ ano: 2026, competenciaAte: '2026-06-01', grupoId: 2, imunoCodigo: '93' });

    const [, params] = query.mock.calls[0];
    expect(params[3]).toBe(2);    // $4 = grupoId
    expect(params[4]).toBe('93'); // $5 = imunoCodigo
  });

  it('uses default null values when grupoId/imunoCodigo are omitted', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await getCobertura({ ano: 2026, competenciaAte: '2026-12-01' });

    const [, params] = query.mock.calls[0];
    expect(params[3]).toBeNull(); // grupoId defaults to null
    expect(params[4]).toBeNull(); // imunoCodigo defaults to null
  });
});
