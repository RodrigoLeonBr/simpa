jest.mock('../src/services/db', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}));

jest.mock('../src/services/cadastrosService', () => ({
  assertActiveEstabelecimento: jest.fn(),
}));

const { query, pool } = require('../src/services/db');
const { assertActiveEstabelecimento } = require('../src/services/cadastrosService');
const {
  competenciaDate,
  scoreNameSimilarity,
  tokenize,
  suggestEstabelecimentos,
  ensureEquipe,
  detectTodasConflict,
  purgeTodasImports,
  enrichPreviewItem,
  resolveForUpload,
  listMapeamentos,
  upsertMapeamento,
  deactivateMapeamento,
  isTodasEquipe,
} = require('../src/services/importMappingService');

const CAFI_ESUS =
  'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO';
const CAFI_CADASTRO = 'CAFI - CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO';

describe('importMappingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assertActiveEstabelecimento.mockResolvedValue(undefined);
  });

  describe('scoreNameSimilarity / suggestEstabelecimentos', () => {
    it('ranks CAFI establishment first for CAFI e-SUS label', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { id: 1, codigo_externo: '111', nome: 'UBS JARDIM SAO PAULO' },
          { id: 2, codigo_externo: '7169698', nome: CAFI_CADASTRO },
          { id: 3, codigo_externo: '333', nome: 'HOSPITAL MUNICIPAL' },
        ],
      });

      const sugestoes = await suggestEstabelecimentos(CAFI_ESUS);

      expect(sugestoes[0].codigo_externo).toBe('7169698');
      expect(sugestoes[0].score).toBeGreaterThan(sugestoes[1].score);
    });

    it('scores prefix overlap higher than unrelated names', () => {
      const cafiScore = scoreNameSimilarity(CAFI_ESUS, CAFI_CADASTRO);
      const ubsScore = scoreNameSimilarity(
        CAFI_ESUS,
        'UBS JARDIM SAO PAULO'
      );
      expect(cafiScore).toBeGreaterThan(ubsScore);
    });

    it('returns zero score for empty labels', () => {
      expect(scoreNameSimilarity('', CAFI_CADASTRO)).toBe(0);
      expect(tokenize('')).toEqual([]);
    });
  });

  describe('enrichPreviewItem', () => {
    const baseMeta = {
      nome: 'relatorio.csv',
      tipo_relatorio: 'atendimento_individual',
      competencia: '2026-05-01',
      unidade: CAFI_ESUS,
      equipe_nome: 'EQUIPE 9 EAP',
      equipe_codigo: '0002200376',
      arquivo_origem: 'relatorio.csv',
    };

    it('returns pending with suggestions when registry miss', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 2, codigo_externo: '7169698', nome: CAFI_CADASTRO }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 99 }] });

      const result = await enrichPreviewItem(baseMeta);

      expect(result.mapeamento_status).toBe('pending');
      expect(result.sugestoes_estabelecimento).toHaveLength(1);
      expect(result.sugestoes_estabelecimento[0].codigo_externo).toBe('7169698');
    });

    it('returns resolved on registry hit without suggestions', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{ id: 10, estabelecimento_id: 2, equipe_id: null }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 2, codigo_externo: '7169698', nome: CAFI_CADASTRO }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 10, equipe_id: 7 }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 7, codigo: '0002200376', nome: 'EQUIPE 9 EAP' }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await enrichPreviewItem(baseMeta);

      expect(result.mapeamento_status).toBe('resolved');
      expect(result.estabelecimento_id).toBe(2);
      expect(result.equipe_id).toBe(7);
      expect(result.sugestoes_estabelecimento).toBeUndefined();
    });

    it('returns resolved when unit mapped and team will auto-create on upload', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{ id: 10, estabelecimento_id: 2, equipe_id: null }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 2, codigo_externo: '7169698', nome: CAFI_CADASTRO }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await enrichPreviewItem(baseMeta);

      expect(result.mapeamento_status).toBe('resolved');
      expect(result.estabelecimento_id).toBe(2);
      expect(result.sugestoes_estabelecimento).toBeUndefined();
    });

    it('returns resolved for Todas equipe without team registry', async () => {
      const todasMeta = {
        ...baseMeta,
        equipe_nome: 'Todas',
        equipe_codigo: null,
      };

      query
        .mockResolvedValueOnce({
          rows: [{ id: 10, estabelecimento_id: 2, equipe_id: null }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 2, codigo_externo: '7169698', nome: CAFI_CADASTRO }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 20 }] })
        .mockResolvedValueOnce({
          rows: [{ id: 20, codigo: 'TODAS-2', nome: 'Todas' }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await enrichPreviewItem(todasMeta);

      expect(result.mapeamento_status).toBe('resolved');
      expect(result.equipe_id).toBe(20);
    });

    it('returns resolved when team mapped by equipe nome fallback', async () => {
      const metaSemIne = {
        ...baseMeta,
        equipe_codigo: null,
        equipe_nome: 'EQUIPE 9 EAP',
      };

      query
        .mockResolvedValueOnce({
          rows: [{ id: 10, estabelecimento_id: 2, equipe_id: null }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 2, codigo_externo: '7169698', nome: CAFI_CADASTRO }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 11, equipe_id: 7 }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 7, codigo: '0002200376', nome: 'EQUIPE 9 EAP' }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await enrichPreviewItem(metaSemIne);

      expect(result.mapeamento_status).toBe('resolved');
      expect(result.equipe_id).toBe(7);
    });

    it('returns pending when mapped establishment is inactive', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{ id: 10, estabelecimento_id: 2, equipe_id: null }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 2, codigo_externo: '7169698', nome: CAFI_CADASTRO }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await enrichPreviewItem(baseMeta);

      expect(result.mapeamento_status).toBe('pending');
      expect(result.sugestoes_estabelecimento).toHaveLength(1);
    });

    it('returns blocked when Todas conflict exists', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{ id: 10, estabelecimento_id: 2, equipe_id: null }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 2, codigo_externo: '7169698', nome: CAFI_CADASTRO }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 10, equipe_id: 7 }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 7, codigo: '0002200376', nome: 'EQUIPE 9 EAP' }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 50 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await enrichPreviewItem(baseMeta);

      expect(result.mapeamento_status).toBe('blocked');
      expect(result.conflito_todas).toEqual({
        exists: true,
        cargas_ids: [50],
        requires_confirm: true,
      });
    });
  });

  describe('ensureEquipe', () => {
    it('creates INE team linked to establishment', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 15,
              codigo: '0002200376',
              nome: 'EQUIPE 9 EAP',
            },
          ],
        });

      const equipe = await ensureEquipe({
        estabelecimentoId: 2,
        esusEquipeCodigo: '0002200376',
        esusEquipeNome: 'EQUIPE 9 EAP',
      });

      expect(equipe.codigo).toBe('0002200376');
      expect(assertActiveEstabelecimento).toHaveBeenCalledWith(2);
      expect(query.mock.calls[1][0]).toMatch(/INSERT INTO equipes/);
      expect(query.mock.calls[1][1]).toEqual([
        '0002200376',
        'EQUIPE 9 EAP',
        2,
      ]);
    });

    it('reuses existing INE team', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 15, codigo: '0002200376', nome: 'EQUIPE 9 EAP' }],
      });

      const equipe = await ensureEquipe({
        estabelecimentoId: 2,
        esusEquipeCodigo: '0002200376',
        esusEquipeNome: 'EQUIPE 9 EAP',
      });

      expect(equipe.id).toBe(15);
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('creates/reuses TODAS-{estabelecimento_id} synthetic team', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 20, codigo: 'TODAS-2', nome: 'Todas' }],
        });

      const equipe = await ensureEquipe({
        estabelecimentoId: 2,
        esusEquipeCodigo: null,
        esusEquipeNome: 'Todas',
      });

      expect(equipe.codigo).toBe('TODAS-2');
      expect(isTodasEquipe(null, 'Todas')).toBe(true);
    });

    it('reuses existing Todas synthetic team without insert', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 20, codigo: 'TODAS-2', nome: 'Todas' }],
      });

      const equipe = await ensureEquipe({
        estabelecimentoId: 2,
        esusEquipeCodigo: null,
        esusEquipeNome: 'Todas',
      });

      expect(equipe.id).toBe(20);
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('rejects specific team without INE codigo', async () => {
      await expect(
        ensureEquipe({
          estabelecimentoId: 2,
          esusEquipeCodigo: null,
          esusEquipeNome: 'EQUIPE 9 EAP',
        })
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('detectTodasConflict', () => {
    it('returns conflict when specific import follows Todas same month', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 40 }, { id: 41 }] });

      const conflict = await detectTodasConflict({
        estabelecimentoId: 2,
        competencia: '2026-05',
        esusEquipeNome: 'EQUIPE 9 EAP',
      });

      expect(conflict.exists).toBe(true);
      expect(conflict.cargas_ids).toEqual([40, 41]);
      expect(conflict.requires_confirm).toBe(true);
    });

    it('blocks new Todas when specific cargas exist', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 55 }] });

      const conflict = await detectTodasConflict({
        estabelecimentoId: 2,
        competencia: '2026-05-01',
        esusEquipeNome: 'Todas',
      });

      expect(conflict.exists).toBe(true);
      expect(conflict.cargas_ids).toEqual([55]);
      expect(conflict.requires_confirm).toBe(false);
    });

    it('returns no conflict when no opposing cargas', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const conflict = await detectTodasConflict({
        estabelecimentoId: 2,
        competencia: '2026-05',
        esusEquipeNome: 'EQUIPE 9 EAP',
      });

      expect(conflict.exists).toBe(false);
    });

    it('normalizes YYYY-MM competencia to first day of month', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await detectTodasConflict({
        estabelecimentoId: 2,
        competencia: '2026-05',
        esusEquipeNome: 'EQUIPE 9 EAP',
      });

      expect(competenciaDate('2026-05')).toBe('2026-05-01');
      expect(query.mock.calls[0][1][1]).toBe('2026-05-01');
    });
  });

  describe('purgeTodasImports', () => {
    it('removes esus_cargas and matching dados_consolidados row', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 20 }] })
        .mockResolvedValueOnce({ rows: [{ id: 100 }, { id: 101 }] })
        .mockResolvedValueOnce({ rows: [{ id: 5 }] });

      const result = await purgeTodasImports({
        estabelecimentoId: 2,
        competencia: '2026-05',
      });

      expect(result.cargas_ids).toEqual([100, 101]);
      expect(result.consolidado_removido).toBe(true);
      expect(query.mock.calls[1][0]).toMatch(/DELETE FROM esus_cargas/);
      expect(query.mock.calls[2][0]).toMatch(/DELETE FROM dados_consolidados/);
    });

    it('uses transaction client when provided', async () => {
      const clientQuery = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 20 }] })
        .mockResolvedValueOnce({ rows: [{ id: 100 }] })
        .mockResolvedValueOnce({ rows: [{ id: 5 }] });

      await purgeTodasImports(
        { estabelecimentoId: 2, competencia: '2026-05' },
        { query: clientQuery }
      );

      expect(clientQuery).toHaveBeenCalledTimes(3);
      expect(query).not.toHaveBeenCalled();
    });

    it('returns empty result when Todas equipe does not exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await purgeTodasImports({
        estabelecimentoId: 2,
        competencia: '2026-05',
      });

      expect(result).toEqual({ cargas_ids: [], consolidado_removido: false });
    });
  });

  describe('resolveForUpload', () => {
    const meta = {
      unidade: CAFI_ESUS,
      equipe_nome: 'EQUIPE 9 EAP',
      equipe_codigo: '0002200376',
      competencia: '2026-05-01',
    };

    it('rejects missing estabelecimento_id', async () => {
      await expect(resolveForUpload(meta, {}, { id: 1 })).rejects.toMatchObject({
        status: 400,
      });
    });

    it('returns 409 on Todas conflict without confirmation', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 40 }] });

      await expect(
        resolveForUpload(
          meta,
          { estabelecimento_id: 2, salvar_mapeamento: false },
          { id: 1 }
        )
      ).rejects.toMatchObject({ status: 409 });
    });

    it('blocks new Todas import when specific cargas exist', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 55 }] });

      await expect(
        resolveForUpload(
          {
            ...meta,
            equipe_nome: 'Todas',
            equipe_codigo: null,
          },
          { estabelecimento_id: 2, salvar_mapeamento: false },
          { id: 1 }
        )
      ).rejects.toMatchObject({
        status: 409,
        message: expect.stringContaining('Todas'),
      });
    });

    it('resolves upload with equipe create and optional mapping save', async () => {
      const clientQuery = jest.fn();
      const mockClient = {
        query: clientQuery,
        release: jest.fn(),
      };
      pool.connect.mockResolvedValue(mockClient);

      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 2, codigo_externo: '7169698', nome: CAFI_CADASTRO }],
        });

      clientQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 15, codigo: '0002200376', nome: 'EQUIPE 9 EAP' }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 99, esus_unidade_label: CAFI_ESUS }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const resolved = await resolveForUpload(
        meta,
        {
          estabelecimento_id: 2,
          equipe_id: 15,
          salvar_mapeamento: true,
        },
        { id: 1 }
      );

      expect(resolved).toEqual({
        estabelecimentoId: 2,
        equipeId: 15,
        estabelecimentoNome: CAFI_CADASTRO,
        equipeNome: 'EQUIPE 9 EAP',
      });
      expect(clientQuery).toHaveBeenCalledWith('BEGIN');
      expect(clientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('purges Todas imports when conflict confirmed', async () => {
      const clientQuery = jest.fn();
      const mockClient = {
        query: clientQuery,
        release: jest.fn(),
      };
      pool.connect.mockResolvedValue(mockClient);

      query
        .mockResolvedValueOnce({ rows: [{ id: 40 }] })
        .mockResolvedValueOnce({
          rows: [{ id: 2, codigo_externo: '7169698', nome: CAFI_CADASTRO }],
        });

      clientQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 20 }] })
        .mockResolvedValueOnce({ rows: [{ id: 100 }] })
        .mockResolvedValueOnce({ rows: [{ id: 5 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 15, codigo: '0002200376', nome: 'EQUIPE 9 EAP' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const resolved = await resolveForUpload(
        meta,
        {
          estabelecimento_id: 2,
          salvar_mapeamento: false,
          confirmar_remocao_todas: true,
        },
        { id: 1 }
      );

      expect(resolved.equipeId).toBe(15);
      expect(clientQuery.mock.calls.some((c) => /DELETE FROM esus_cargas/.test(c[0]))).toBe(
        true
      );
    });

    it('rolls back transaction when ensureEquipe fails', async () => {
      const clientQuery = jest.fn();
      const mockClient = {
        query: clientQuery,
        release: jest.fn(),
      };
      pool.connect.mockResolvedValue(mockClient);

      query.mockResolvedValueOnce({ rows: [] });

      clientQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error('insert failed'));

      await expect(
        resolveForUpload(
          meta,
          { estabelecimento_id: 2, salvar_mapeamento: false },
          { id: 1 }
        )
      ).rejects.toThrow('insert failed');

      expect(clientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('rejects specific team without codigo during upload transaction', async () => {
      const clientQuery = jest.fn();
      const mockClient = {
        query: clientQuery,
        release: jest.fn(),
      };
      pool.connect.mockResolvedValue(mockClient);

      query.mockResolvedValueOnce({ rows: [] });

      clientQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        resolveForUpload(
          { ...meta, equipe_codigo: '   ' },
          { estabelecimento_id: 2, salvar_mapeamento: false },
          { id: 1 }
        )
      ).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('equipe_codigo'),
      });

      expect(clientQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('creates Todas synthetic team when missing in transaction', async () => {
      const clientQuery = jest.fn();
      const mockClient = {
        query: clientQuery,
        release: jest.fn(),
      };
      pool.connect.mockResolvedValue(mockClient);

      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 2, codigo_externo: '7169698', nome: CAFI_CADASTRO }],
        });

      clientQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 20, codigo: 'TODAS-2', nome: 'Todas' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const resolved = await resolveForUpload(
        { ...meta, equipe_nome: 'Todas', equipe_codigo: null },
        { estabelecimento_id: 2, salvar_mapeamento: false },
        { id: 1 }
      );

      expect(resolved.equipeId).toBe(20);
      expect(resolved.equipeNome).toBe('Todas');
    });
  });

  describe('listMapeamentos', () => {
    it('returns paginated active mappings', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              esus_unidade_label: CAFI_ESUS,
              estabelecimento_id: 2,
            },
          ],
        });

      const result = await listMapeamentos({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('filters by search query', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await listMapeamentos({ q: 'CAFI', page: 1, limit: 10 });

      expect(query.mock.calls[0][1]).toEqual(['%CAFI%']);
    });
  });

  describe('upsertMapeamento', () => {
    it('inserts unit-only mapping', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, esus_unidade_label: CAFI_ESUS }],
        });

      const row = await upsertMapeamento(
        {
          esus_unidade_label: CAFI_ESUS,
          estabelecimento_id: 2,
        },
        { id: 5 }
      );

      expect(row.id).toBe(1);
      expect(query.mock.calls[1][0]).toMatch(/INSERT INTO esus_import_mapeamentos/);
    });

    it('updates existing unit-only mapping', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 5 }] })
        .mockResolvedValueOnce({
          rows: [{ id: 5, esus_unidade_label: CAFI_ESUS, estabelecimento_id: 2 }],
        });

      const row = await upsertMapeamento(
        {
          esus_unidade_label: CAFI_ESUS,
          estabelecimento_id: 2,
          equipe_id: 7,
        },
        { id: 5 }
      );

      expect(row.id).toBe(5);
      expect(query.mock.calls[1][0]).toMatch(/UPDATE esus_import_mapeamentos/);
    });

    it('inserts team mapping with INE codigo', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 8,
              esus_equipe_codigo: '0002200376',
              equipe_id: 15,
            },
          ],
        });

      const row = await upsertMapeamento(
        {
          esus_unidade_label: CAFI_ESUS,
          esus_equipe_codigo: '0002200376',
          esus_equipe_nome: 'EQUIPE 9 EAP',
          estabelecimento_id: 2,
          equipe_id: 15,
        },
        { id: 5 }
      );

      expect(row.id).toBe(8);
      expect(query.mock.calls[1][0]).toMatch(/INSERT INTO esus_import_mapeamentos/);
    });

    it('updates existing team mapping', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ id: 8 }] })
        .mockResolvedValueOnce({
          rows: [{ id: 8, equipe_id: 16 }],
        });

      const row = await upsertMapeamento(
        {
          esus_unidade_label: CAFI_ESUS,
          esus_equipe_codigo: '0002200376',
          esus_equipe_nome: 'EQUIPE 9 EAP',
          estabelecimento_id: 2,
          equipe_id: 16,
        },
        { id: 5 }
      );

      expect(row.id).toBe(8);
      expect(query.mock.calls[1][0]).toMatch(/UPDATE esus_import_mapeamentos/);
    });
  });

  describe('deactivateMapeamento', () => {
    it('soft-deletes mapping', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 3 }] });

      const result = await deactivateMapeamento(3, { id: 5 });

      expect(result).toEqual({ inativado: true, id: 3 });
    });

    it('returns 404 when mapping missing', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(deactivateMapeamento(999, { id: 5 })).rejects.toMatchObject({
        status: 404,
      });
    });
  });
});
