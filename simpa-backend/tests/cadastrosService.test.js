const {
  validateRequired,
  createEntity,
  updateEntity,
  inactivateEntity,
  listEntity,
} = require('../src/services/cadastrosService');

jest.mock('../src/services/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../src/services/db');

describe('cadastrosService validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects missing required fields for emendas', () => {
    const result = validateRequired({ esfera: 'federal' }, ['id_emenda', 'esfera']);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/id_emenda/i);
  });

  it('creates emenda when required fields are present', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, id_emenda: 'EM-2026-01', esfera: 'federal' }],
    });

    const row = await createEntity('emendas', {
      id_emenda: 'EM-2026-01',
      esfera: 'federal',
    });

    expect(row.id_emenda).toBe('EM-2026-01');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO emendas_parlamentares'),
      expect.arrayContaining(['EM-2026-01', 'federal'])
    );
  });

  it('inactivate preserves row with status flag', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 9 }] });

    const result = await inactivateEntity('equipes', 9);

    expect(result).toEqual({ inativado: true, id: 9 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status='inativo'"),
      [9]
    );
  });

  it('listEntity filters equipes by estabelecimento_id', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const rows = await listEntity('equipes', { estabelecimento_id: '5' });

    expect(rows).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('e.estabelecimento_id = $1'),
      ['5']
    );
  });

  it('updateEntity returns 404 when missing', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      updateEntity('emendas', 404, { autor: 'X' })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('updateEntity rejects empty payload', async () => {
    await expect(updateEntity('equipes', 1, {})).rejects.toMatchObject({
      status: 400,
    });
  });

  it('inactivateEntity returns 404 when missing', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(inactivateEntity('equipes', 123)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('requires estabelecimento_id on equipe create', async () => {
    await expect(
      createEntity('equipes', { codigo: 'EQ1', nome: 'Equipe' })
    ).rejects.toMatchObject({
      status: 400,
      message: /estabelecimento_id/i,
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('listEntity throws for unknown resource', async () => {
    await expect(listEntity('unidades')).rejects.toMatchObject({ status: 404 });
    await expect(listEntity('procedimentos')).rejects.toMatchObject({
      status: 404,
    });
  });
});
