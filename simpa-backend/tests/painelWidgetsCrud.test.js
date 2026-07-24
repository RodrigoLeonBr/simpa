jest.mock('../src/services/db', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}));

const { query, pool } = require('../src/services/db');
const {
  listWidgets,
  getWidgetById,
  createWidget,
  updateWidget,
  reorderWidgets,
  inactivateWidget,
  normalizeCreatePayload,
  normalizeUpdatePayload,
} = require('../src/services/painelWidgetsService');

describe('painelWidgetsService CRUD', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('listWidgets retorna linhas ordenadas por ordem para APS/A', async () => {
    const rows = Array.from({ length: 8 }).map((_, idx) => ({
      id: idx + 1,
      slug: `widget_${idx + 1}`,
      perfil: 'APS',
      layout: 'A',
      ordem: idx + 1,
    }));
    query.mockResolvedValueOnce({ rows });

    const result = await listWidgets({ perfil: 'APS', layout: 'A' });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY w.ordem ASC, w.id ASC'),
      ['APS', 'A']
    );
    expect(result).toHaveLength(8);
    expect(result[0].ordem).toBe(1);
    expect(result[7].ordem).toBe(8);
  });

  it('createWidget rejeita slug duplicado com erro de conflito', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] });

    await expect(
      createWidget({
        slug: 'atendimentos',
        perfil: 'APS',
        layout: 'A',
        ordem: 1,
        tipo: 'card',
        titulo: 'Atendimentos',
        formato: 'numero',
        metrica_id: 10,
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('createWidget cria registro quando payload válido', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 55 }] })
      .mockResolvedValueOnce({
        rows: [{ id: 55, slug: 'novo', metrica_label: 'Métrica X', spark_metrica_label: null }],
      });

    const created = await createWidget({
      slug: 'novo',
      perfil: 'APS',
      layout: 'A',
      ordem: 2,
      tipo: 'card',
      titulo: 'Novo widget',
      formato: 'numero',
      metrica_id: 10,
      fonte_config: { fallback_chave: 'x' },
    });

    expect(created.id).toBe(55);
    expect(query.mock.calls[2][0]).toContain('INSERT INTO painel_widgets');
    expect(query.mock.calls[3][0]).toContain('WHERE w.id = $1');
  });

  it('updateWidget com metrica_id inválida falha antes do UPDATE', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ id: 1, perfil: 'APS', layout: 'A', slug: 'atendimentos' }],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    await expect(
      updateWidget(1, {
        metrica_id: 9999,
      })
    ).rejects.toMatchObject({ status: 400, code: 'METRIC_INVALID' });

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain('WHERE w.id = $1');
    expect(query.mock.calls[1][0]).toContain('FROM painel_metricas_catalogo');
  });

  it('updateWidget atualiza campos e retorna widget completo', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ id: 1, perfil: 'APS', layout: 'A', slug: 'atendimentos' }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({
        rows: [{ id: 1, slug: 'atendimentos', titulo: 'Título novo', metrica_label: 'Métrica 10' }],
      });

    const updated = await updateWidget(1, {
      titulo: 'Título novo',
      metrica_id: 10,
      fonte_config: { limite: 5 },
    });

    expect(updated.titulo).toBe('Título novo');
    expect(query.mock.calls[2][0]).toContain('UPDATE painel_widgets');
    expect(query.mock.calls[3][0]).toContain('WHERE w.id = $1');
  });

  it('reorderWidgets persiste nova ordem em transação', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 3 }] })
      .mockResolvedValueOnce({});
    query.mockResolvedValueOnce({
      rows: [
        { id: 1, ordem: 1, perfil: 'APS', layout: 'A' },
        { id: 2, ordem: 2, perfil: 'APS', layout: 'A' },
        { id: 3, ordem: 3, perfil: 'APS', layout: 'A' },
      ],
    });

    const reordered = await reorderWidgets('APS', 'A', [1, 2, 3]);

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE perfil = $1'),
      ['APS', 'A', [1, 2, 3]]
    );
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('SET ordem = $1'), [1, 1]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('SET ordem = $1'), [2, 2]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('SET ordem = $1'), [3, 3]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
    expect(reordered).toHaveLength(3);
  });

  it('reorderWidgets aceita widgets inativos no orderedIds', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })
      .mockResolvedValueOnce({});
    query.mockResolvedValueOnce({
      rows: [
        { id: 1, ordem: 1, perfil: 'APS', layout: 'A', status: 'ativo' },
        { id: 2, ordem: 2, perfil: 'APS', layout: 'A', status: 'inativo' },
      ],
    });

    const reordered = await reorderWidgets('APS', 'A', [2, 1]);

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE perfil = $1'),
      ['APS', 'A', [2, 1]]
    );
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining("status = 'ativo'"),
      expect.anything()
    );
    expect(reordered).toHaveLength(2);
  });

  it('inactivateWidget define status inativo sem hard delete', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 7, status: 'inativo' }],
    });

    const result = await inactivateWidget(7);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SET status = \'inativo\''),
      [7]
    );
    expect(result).toEqual({ id: 7, status: 'inativo' });
  });

  it('getWidgetById retorna 404 quando ID não existe', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(getWidgetById(999)).rejects.toMatchObject({ status: 404 });
  });

  it('normalizers rejeitam payload inválido', () => {
    expect(() =>
      normalizeCreatePayload({
        slug: 'a',
        perfil: 'APS',
        layout: 'A',
        tipo: 'card',
        titulo: 'x',
        fonte_config: [],
      })
    ).toThrow('fonte_config deve ser objeto JSON');

    expect(() =>
      normalizeUpdatePayload({
        spark_config: [],
      })
    ).toThrow('spark_config deve ser objeto JSON');
  });

  it('listWidgets valida perfil/layout obrigatórios', async () => {
    await expect(listWidgets({ layout: 'A' })).rejects.toMatchObject({ status: 400 });
  });

  it('updateWidget rejeita corpo vazio', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, perfil: 'APS', layout: 'A', slug: 'atendimentos' }],
    });

    await expect(updateWidget(1, {})).rejects.toMatchObject({ status: 400 });
  });

  it('reorderWidgets rejeita orderedIds duplicado', async () => {
    await expect(reorderWidgets('APS', 'A', [1, 1])).rejects.toMatchObject({ status: 400 });
  });

  it('inactivateWidget retorna 404 para id inexistente', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(inactivateWidget(1234)).rejects.toMatchObject({ status: 404 });
  });
});
