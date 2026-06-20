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

  it('rejects missing required CNES context fields for unidades', () => {
    const result = validateRequired({ nome: 'UBS Centro' }, ['codigo', 'nome']);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/codigo/i);
  });

  it('rejects missing codigo_sigtap for procedimentos', async () => {
    await expect(
      createEntity('procedimentos', { descricao: 'Consulta médica' })
    ).rejects.toMatchObject({
      status: 400,
      message: /codigo_sigtap/i,
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects missing descricao for procedimentos', async () => {
    await expect(
      createEntity('procedimentos', { codigo_sigtap: '0301010072' })
    ).rejects.toMatchObject({
      status: 400,
      message: /descricao/i,
    });
  });

  it('creates procedimento when SIGTAP fields are present', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, codigo_sigtap: '0301010072', descricao: 'Consulta' }],
    });

    const row = await createEntity('procedimentos', {
      codigo_sigtap: '0301010072',
      descricao: 'Consulta',
    });

    expect(row.codigo_sigtap).toBe('0301010072');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO procedimentos'),
      expect.arrayContaining(['0301010072', 'Consulta'])
    );
  });

  it('inactivate preserves row with status flag', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 9 }] });

    const result = await inactivateEntity('unidades', 9);

    expect(result).toEqual({ inativado: true, id: 9 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status='inativo'"),
      [9]
    );
  });

  it('listEntity filters equipes by unidade_id', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const rows = await listEntity('equipes', { unidade_id: '5' });

    expect(rows).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('e.unidade_id = $1'),
      ['5']
    );
  });

  it('updateEntity returns 404 when missing', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      updateEntity('unidades', 404, { nome: 'X' })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('updateEntity rejects empty payload', async () => {
    await expect(updateEntity('unidades', 1, {})).rejects.toMatchObject({
      status: 400,
    });
  });

  it('inactivateEntity returns 404 when missing', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(inactivateEntity('equipes', 123)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('listEntity throws for unknown resource', async () => {
    await expect(listEntity('invalid')).rejects.toMatchObject({ status: 404 });
  });
});
