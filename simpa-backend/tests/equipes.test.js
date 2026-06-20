jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const {
  createEntity,
  listEntity,
  assertActiveEstabelecimento,
} = require('../src/services/cadastrosService');

describe('equipes estabelecimento FK', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
  });

  it('create equipe rejects invalid estabelecimento_id', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      createEntity('equipes', {
        codigo: 'EQ-99',
        nome: 'Equipe Teste',
        estabelecimento_id: 999,
      })
    ).rejects.toMatchObject({
      status: 400,
      message: /estabelecimento_id inválido/i,
    });
  });

  it('create equipe succeeds with active estabelecimento_id', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            codigo: 'EQ-99',
            nome: 'Equipe Teste',
            estabelecimento_id: 1,
          },
        ],
      });

    const row = await createEntity('equipes', {
      codigo: 'EQ-99',
      nome: 'Equipe Teste',
      estabelecimento_id: 1,
    });

    expect(row.codigo).toBe('EQ-99');
    expect(query.mock.calls[0][0]).toMatch(/estabelecimentos/);
  });

  it('list equipes maps unidade_id query to estabelecimento_id filter', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          codigo: 'EQ1',
          nome: 'Equipe 1',
          estabelecimento_id: 5,
          unidade_nome: 'UBS Centro',
        },
      ],
    });

    const rows = await listEntity('equipes', { unidade_id: '5' });

    expect(rows[0].unidade_nome).toBe('UBS Centro');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('e.estabelecimento_id = $1'),
      ['5']
    );
  });

  it('assertActiveEstabelecimento throws for inactive', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(assertActiveEstabelecimento(7)).rejects.toMatchObject({
      status: 400,
    });
  });
});
