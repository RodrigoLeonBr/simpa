'use strict';

jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const {
  listInternacoes,
  listProcedimentos,
  getSihSummary,
  listInternacoesPorCapituloCid,
} = require('../src/services/sihProducaoService');

beforeEach(() => {
  jest.clearAllMocks();
  query.mockResolvedValue({ rows: [] });
});

// ---------------------------------------------------------------------------
// listInternacoes
// ---------------------------------------------------------------------------

describe('listInternacoes', () => {
  it('filters by competencia → YYYY-MM-01', async () => {
    await listInternacoes({ competencia: '2025-01' });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/si\.competencia = \$1/);
    expect(params[0]).toBe('2025-01-01');
  });

  it('adds estabelecimento_id filter when present (camelCase)', async () => {
    await listInternacoes({ competencia: '2025-01', estabelecimentoId: 5 });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/si\.estabelecimento_id = \$/);
    expect(params).toContain(5);
  });

  it('adds estabelecimento_id filter when present (snake_case from req.query)', async () => {
    await listInternacoes({ competencia: '2025-01', estabelecimento_id: '7' });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/si\.estabelecimento_id = \$/);
    expect(params).toContain(7);
  });

  it('filters by cnes', async () => {
    await listInternacoes({ cnes: '2058790' });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/si\.cnes = \$/);
    expect(params).toContain('2058790');
  });

  it('returns all rows when no filters provided', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
    const rows = await listInternacoes({});
    expect(rows).toHaveLength(2);
    const [sql] = query.mock.calls[0];
    expect(sql).not.toMatch(/WHERE/);
  });

  it('joins rubricas_sia on 2-char financiamento (not LEFT(…,4))', async () => {
    await listInternacoes({ competencia: '2025-01' });
    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/LEFT JOIN rubricas_sia rs ON si\.financiamento = rs\.codigo_rubrica/);
    expect(sql).not.toMatch(/LEFT\(si\.financiamento/);
  });

  it('returns descricao_financiamento from join', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, financiamento: '01', descricao_financiamento: 'Atenção Básica' }],
    });
    const rows = await listInternacoes({});
    expect(rows[0].descricao_financiamento).toBe('Atenção Básica');
  });
});

// ---------------------------------------------------------------------------
// listProcedimentos
// ---------------------------------------------------------------------------

describe('listProcedimentos', () => {
  it('returns all rows when no filters provided', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const rows = await listProcedimentos({});
    expect(rows).toHaveLength(1);
    const [sql] = query.mock.calls[0];
    expect(sql).not.toMatch(/WHERE/);
  });

  it('filters by competencia', async () => {
    await listProcedimentos({ competencia: '2025-01' });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/sp\.competencia = \$1/);
    expect(params[0]).toBe('2025-01-01');
  });

  it('filters by estabelecimento_id (camelCase)', async () => {
    await listProcedimentos({ estabelecimentoId: 3 });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/sp\.estabelecimento_id = \$/);
    expect(params).toContain(3);
  });

  it('filters by cnes', async () => {
    await listProcedimentos({ cnes: '1234567' });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/sp\.cnes = \$/);
    expect(params).toContain('1234567');
  });

  it('joins cbos_sia on cbo_profissional', async () => {
    await listProcedimentos({ competencia: '2025-01' });
    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/LEFT JOIN cbos_sia cs ON sp\.cbo_profissional = cs\.codigo_cbo/);
    expect(sql).toMatch(/descricao_cbo/);
  });
});

// ---------------------------------------------------------------------------
// getSihSummary
// ---------------------------------------------------------------------------

describe('getSihSummary', () => {
  it('returns zero KPIs when no rows', async () => {
    query.mockResolvedValueOnce({ rows: [{}] });
    const result = await getSihSummary('2025-01', null);
    expect(result).toEqual({
      total_aih: 0,
      total_valor: 0,
      pct_diarias_uti: 0,
      taxa_mortalidade: 0,
    });
  });

  it('returns computed KPIs when data present', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        total_aih: '120',
        total_valor: '48000.00',
        pct_diarias_uti: '12.50',
        taxa_mortalidade: '3.33',
      }],
    });
    const result = await getSihSummary('2025-01', null);
    expect(result.total_aih).toBe(120);
    expect(result.total_valor).toBe(48000);
    expect(result.pct_diarias_uti).toBe(12.5);
    expect(result.taxa_mortalidade).toBe(3.33);
  });

  it('filters by competencia', async () => {
    query.mockResolvedValueOnce({ rows: [{}] });
    await getSihSummary('2025-01', null);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/FROM sih_internacoes/);
    expect(params[0]).toBe('2025-01-01');
  });

  it('adds estabelecimento_id filter when provided', async () => {
    query.mockResolvedValueOnce({ rows: [{}] });
    await getSihSummary('2025-01', 42);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/si\.estabelecimento_id = \$/);
    expect(params).toContain(42);
  });

  it('computes taxa_mortalidade from motivo_saida 31/32', async () => {
    query.mockResolvedValueOnce({ rows: [{}] });
    await getSihSummary('2025-01', null);
    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/motivo_saida IN \('31','32'\)/);
  });

  it('uses NULLIF in pct_diarias_uti to avoid divide-by-zero', async () => {
    query.mockResolvedValueOnce({ rows: [{}] });
    await getSihSummary('2025-01', null);
    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/NULLIF.*total_diarias/);
  });
});

// ---------------------------------------------------------------------------
// listInternacoesPorCapituloCid
// ---------------------------------------------------------------------------

describe('listInternacoesPorCapituloCid', () => {
  it('returns capitulo and qtd_aih fields', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { capitulo: 'J', qtd_aih: '45', total_valor: '18000.00' },
        { capitulo: 'I', qtd_aih: '30', total_valor: '12000.00' },
      ],
    });
    const rows = await listInternacoesPorCapituloCid('2025-01', null);
    expect(rows).toHaveLength(2);
    expect(rows[0].capitulo).toBe('J');
    expect(rows[0].qtd_aih).toBe('45');
  });

  it('groups by LEFT(diag_principal, 1)', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await listInternacoesPorCapituloCid('2025-01', null);
    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/LEFT\(si\.diag_principal, 1\)/);
    expect(sql).toMatch(/GROUP BY LEFT\(si\.diag_principal, 1\)/);
  });

  it('filters out null/empty diag_principal', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await listInternacoesPorCapituloCid('2025-01', null);
    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/diag_principal IS NOT NULL/);
    expect(sql).toMatch(/diag_principal != ''/);
  });

  it('filters by competencia', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await listInternacoesPorCapituloCid('2025-01', null);
    const [sql, params] = query.mock.calls[0];
    expect(params[0]).toBe('2025-01-01');
  });

  it('filters by estabelecimentoId when provided', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await listInternacoesPorCapituloCid('2025-01', 7);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/si\.estabelecimento_id = \$/);
    expect(params).toContain(7);
  });
});
