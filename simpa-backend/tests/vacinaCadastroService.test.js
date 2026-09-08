jest.mock('../src/services/db', () => ({ query: jest.fn() }));

const { query } = require('../src/services/db');
const {
  listGrupos,
  createGrupo,
  updateGrupo,
  listFaixaGrupo,
  setFaixaGrupo,
  listPopulacao,
  upsertPopulacao,
  listEsquema,
  upsertEsquema,
  deleteEsquema,
  listImunobiologicos,
} = require('../src/services/vacinaCadastroService');

beforeEach(() => jest.clearAllMocks());

describe('vacinaCadastroService', () => {
  it('updateGrupo builds COALESCE update with id as $1 and fields as $2-$5', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 3, nome: 'Novo', slug: 'novo', ordem: 1, ativo: true }] });
    const result = await updateGrupo(3, { nome: 'Novo' });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/COALESCE\(\$2,\s*nome\)/i);
    expect(params[0]).toBe(3);      // id = $1
    expect(params[1]).toBe('Novo'); // nome = $2
    expect(params[2]).toBeNull();   // slug = $3 (not provided → null)
    expect(result.id).toBe(3);
  });

  it('updateGrupo with all fields set — exercises ?? branches for each field', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 4, nome: 'Full', slug: 'full', ordem: 2, ativo: false }] });
    const result = await updateGrupo(4, { nome: 'Full', slug: 'full', ordem: 2, ativo: false });
    const [, params] = query.mock.calls[0];
    expect(params[1]).toBe('Full');  // nome ?? null → 'Full'
    expect(params[2]).toBe('full'); // slug ?? null → 'full'
    expect(params[3]).toBe(2);      // ordem ?? null → 2
    expect(params[4]).toBe(false);  // ativo ?? null → false
    expect(result.id).toBe(4);
  });

  it('upsertPopulacao uses ON CONFLICT (ano, grupo_id)', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, ano: 2026, grupo_id: 2, populacao: 500 }] });
    await upsertPopulacao({ ano: 2026, grupo_id: 2, populacao: 500 });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/ON CONFLICT \(ano, grupo_id\)/i);
    expect(params).toEqual([2026, 2, 500]);
  });

  it('deleteEsquema issues DELETE with the id param', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 7 }] });
    const result = await deleteEsquema(7);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM vacina_esquema/i);
    expect(params).toEqual([7]);
    expect(result.id).toBe(7);
  });

  it('listGrupos returns ordered rows', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, nome: 'Adolescente' }] });
    const result = await listGrupos();
    expect(result).toHaveLength(1);
    expect(query.mock.calls[0][0]).toMatch(/vacina_grupos/i);
  });

  it('createGrupo inserts with defaults and returns row', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 5, nome: 'Novo', slug: 'novo', ordem: 0 }] });
    const result = await createGrupo({ nome: 'Novo', slug: 'novo' });
    expect(result.id).toBe(5);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO vacina_grupos/i);
    expect(params[2]).toBe(0); // default ordem
  });

  it('listFaixaGrupo returns joined rows', async () => {
    query.mockResolvedValueOnce({ rows: [{ faixa_nies: '05 a 11 anos', grupo_id: 1, grupo_nome: 'Adolescente' }] });
    const result = await listFaixaGrupo();
    expect(result[0].faixa_nies).toBe('05 a 11 anos');
  });

  it('setFaixaGrupo updates and returns row', async () => {
    query.mockResolvedValueOnce({ rows: [{ faixa_nies: '05 a 11 anos', grupo_id: 2 }] });
    const result = await setFaixaGrupo('05 a 11 anos', 2);
    expect(result.grupo_id).toBe(2);
    expect(query.mock.calls[0][1]).toEqual(['05 a 11 anos', 2]);
  });

  it('listPopulacao with ano passes it as param', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, ano: 2026 }] });
    const result = await listPopulacao(2026);
    expect(result[0].ano).toBe(2026);
    expect(query.mock.calls[0][1]).toEqual([2026]);
  });

  it('listPopulacao without ano passes null', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await listPopulacao(null);
    expect(query.mock.calls[0][1]).toEqual([null]);
  });

  it('listEsquema returns joined rows', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, imuno_codigo: '93', grupo_nome: 'Adolescente' }] });
    const result = await listEsquema();
    expect(result[0].imuno_codigo).toBe('93');
  });

  it('upsertEsquema uses ON CONFLICT (imuno_codigo, grupo_id)', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, imuno_codigo: '93', grupo_id: 1, num_doses: 2 }] });
    const result = await upsertEsquema({ imuno_codigo: '93', grupo_id: 1, num_doses: 2 });
    expect(result.id).toBe(1);
    expect(query.mock.calls[0][0]).toMatch(/ON CONFLICT \(imuno_codigo, grupo_id\)/i);
  });

  it('listImunobiologicos returns ordered rows', async () => {
    query.mockResolvedValueOnce({ rows: [{ imuno_codigo: '93', imuno_nome: 'HPV' }] });
    const result = await listImunobiologicos();
    expect(result[0].imuno_nome).toBe('HPV');
  });
});
