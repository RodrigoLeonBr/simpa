jest.mock('../src/services/db', () => ({ query: jest.fn() }));

const { query } = require('../src/services/db');
const {
  updateGrupo,
  upsertPopulacao,
  deleteEsquema,
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
});
