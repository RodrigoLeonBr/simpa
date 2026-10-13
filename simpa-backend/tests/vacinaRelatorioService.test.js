jest.mock('../src/services/db', () => ({ query: jest.fn() }));

const db = require('../src/services/db');
const { getResumoDoses, getFiltros } = require('../src/services/vacinaRelatorioService');

describe('vacinaRelatorioService.getResumoDoses', () => {
  beforeEach(() => jest.clearAllMocks());

  it('assembles breakdowns and computes accumulated/month totals from serie', async () => {
    // Promise.all order: serie, vacina, faixa, unidade, sistema
    db.query
      .mockResolvedValueOnce({ rows: [
        { competencia: '2026-01', doses: '100' },
        { competencia: '2026-02', doses: '200' },
        { competencia: '2026-03', doses: '300' },
        { competencia: '2026-04', doses: '999' },
      ] })
      .mockResolvedValueOnce({ rows: [{ imuno_codigo: '85', imuno_nome: 'BCG', doses: '350' }] })
      .mockResolvedValueOnce({ rows: [{ faixa_nies: '< 01 ano', doses: '250' }] })
      .mockResolvedValueOnce({ rows: [{ cnes_sala: '4032128', sala_nome: 'UBS A', doses: '600' }] })
      .mockResolvedValueOnce({ rows: [{ sistema_origem: 'NOVO PNI', doses: '600' }] });

    const out = await getResumoDoses({ ano: 2026, mes: 3, cnesSala: null });

    expect(out.total_doses_ano).toBe(600); // jan+fev+mar, abril excluded by mes=3
    expect(out.total_doses_mes).toBe(300); // março only
    expect(out.serie_mensal).toHaveLength(4);
    expect(out.por_vacina[0]).toEqual({ imuno_codigo: '85', imuno_nome: 'BCG', doses: 350 });
    expect(out.por_faixa[0].doses).toBe(250);
    expect(out.por_unidade[0].sala_nome).toBe('UBS A');
    expect(out.por_sistema[0].sistema_origem).toBe('NOVO PNI');
  });

  it('mes set but month absent from serie → total_doses_mes 0 (nullish fallback)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ competencia: '2026-01', doses: '100' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const out = await getResumoDoses({ ano: 2026, mes: 5, cnesSala: null });
    expect(out.total_doses_ano).toBe(100); // jan only, within jan..mai
    expect(out.total_doses_mes).toBe(0); // mai ausente da série → ?? 0
  });

  it('cnesSala passes through as $3 and defaults apply when omitted', async () => {
    db.query.mockResolvedValue({ rows: [] });

    await getResumoDoses({ ano: 2026, cnesSala: '4032128' }); // mes omitido → default null

    // todas as 5 queries recebem cnes_sala como 3º parâmetro
    for (const call of db.query.mock.calls) {
      expect(call[1][2]).toBe('4032128');
    }
  });

  it('without mes, total_doses_mes equals full-year accumulated', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [
        { competencia: '2026-01', doses: '100' },
        { competencia: '2026-02', doses: '200' },
      ] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const out = await getResumoDoses({ ano: 2026, mes: null, cnesSala: null });
    expect(out.total_doses_ano).toBe(300);
    expect(out.total_doses_mes).toBe(300);
    expect(out.mes).toBeNull();
  });
});

describe('vacinaRelatorioService.getFiltros', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns distinct anos and salas', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ ano: 2026 }] })
      .mockResolvedValueOnce({ rows: [{ cnes_sala: '4032128', sala_nome: 'UBS A' }] });

    const out = await getFiltros();
    expect(out.anos).toEqual([2026]);
    expect(out.salas).toEqual([{ cnes_sala: '4032128', sala_nome: 'UBS A' }]);
  });
});
