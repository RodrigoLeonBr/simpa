jest.mock('../src/services/db', () => {
  const query = jest.fn();
  const mockClient = {
    query,
    release: jest.fn(),
  };
  return {
    query,
    pool: {
      connect: jest.fn(async () => mockClient),
    },
  };
});

const { query } = require('../src/services/db');
const {
  listLeitosVigencias,
  createLeitosVigencia,
  updateLeitosVigencia,
  deleteLeitosVigencia,
  mirrorOpenVigenciaLeitos,
} = require('../src/services/leitosVigenciaService');

function mockTransactionalQuery(handler) {
  query.mockImplementation((sql, params) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return Promise.resolve({ rows: [] });
    }
    return handler(sql, params);
  });
}

describe('leitosVigenciaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
  });

  describe('listLeitosVigencias', () => {
    it('returns rows ordered by vigencia_inicio ASC via query', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { id: 1, estabelecimento_id: 1, vigencia_inicio: '202101', vigencia_fim: '202306' },
        ],
      });

      const rows = await listLeitosVigencias(1);

      expect(rows).toHaveLength(1);
      expect(query.mock.calls[0][0]).toMatch(/ORDER BY vigencia_inicio ASC/i);
      expect(query.mock.calls[0][1]).toEqual([1]);
    });
  });

  describe('createLeitosVigencia', () => {
    it('rejects overlapping vigencia with status 400', async () => {
      query.mockImplementation((sql) => {
        if (sql.includes('SELECT perfil FROM estabelecimentos')) {
          return Promise.resolve({ rows: [{ perfil: 'Hospitalar' }] });
        }
        if (
          sql.includes('FROM enriquecimento_hospitalar_leitos_vigencia') &&
          !sql.includes('INSERT')
        ) {
          return Promise.resolve({
            rows: [{ id: 1, vigencia_inicio: '202101', vigencia_fim: '202306' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        createLeitosVigencia(1, {
          vigencia_inicio: '202306',
          vigencia_fim: '202409',
          leitos: { clinico: 5 },
        })
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects inconsistent leitos_detalhe with status 400 mentioning uti_adulto', async () => {
      const body = {
        vigencia_inicio: '202306',
        vigencia_fim: '999999',
        leitos: { uti_adulto: 17 },
        leitos_detalhe: { 75: 10 },
      };

      await expect(createLeitosVigencia(1, body)).rejects.toMatchObject({ status: 400 });
      await expect(createLeitosVigencia(1, body)).rejects.toThrow(/uti_adulto/i);
    });

    it('succeeds and mirrors open vigencia leitos for perfil Hospitalar', async () => {
      mockTransactionalQuery((sql) => {
        if (sql.includes('SELECT perfil FROM estabelecimentos')) {
          return Promise.resolve({ rows: [{ perfil: 'Hospitalar' }] });
        }
        if (sql.includes('INSERT INTO enriquecimento_hospitalar_leitos_vigencia')) {
          return Promise.resolve({
            rows: [
              {
                id: 10,
                estabelecimento_id: 1,
                vigencia_inicio: '202306',
                vigencia_fim: '999999',
                leitos: { clinico: 5 },
                leitos_detalhe: {},
              },
            ],
          });
        }
        if (sql.includes('SELECT leitos FROM enriquecimento_hospitalar_leitos_vigencia')) {
          return Promise.resolve({ rows: [{ leitos: { clinico: 5 } }] });
        }
        if (sql.includes('INSERT INTO enriquecimento_hospitalar (')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM enriquecimento_hospitalar_leitos_vigencia')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const created = await createLeitosVigencia(1, {
        vigencia_inicio: '202306',
        vigencia_fim: '999999',
        leitos: { clinico: 5 },
      });

      expect(created.id).toBe(10);
      expect(
        query.mock.calls.some((call) =>
          call[0].includes('INSERT INTO enriquecimento_hospitalar_leitos_vigencia')
        )
      ).toBe(true);
      expect(
        query.mock.calls.some((call) => call[0].includes('INSERT INTO enriquecimento_hospitalar ('))
      ).toBe(true);
    });

    it('rejects when estabelecimento does not exist (404)', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(
        createLeitosVigencia(999, {
          vigencia_inicio: '202306',
          vigencia_fim: '999999',
          leitos: { clinico: 5 },
        })
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('deleteLeitosVigencia', () => {
    it('mirrors empty leitos ({}) when no open vigencia remains after delete', async () => {
      mockTransactionalQuery((sql) => {
        if (sql.includes('SELECT perfil FROM estabelecimentos')) {
          return Promise.resolve({ rows: [{ perfil: 'Hospitalar' }] });
        }
        if (sql.includes('SELECT id FROM enriquecimento_hospitalar_leitos_vigencia')) {
          return Promise.resolve({ rows: [{ id: 5 }] });
        }
        if (sql.includes('DELETE FROM enriquecimento_hospitalar_leitos_vigencia')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT leitos FROM enriquecimento_hospitalar_leitos_vigencia')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO enriquecimento_hospitalar (')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await deleteLeitosVigencia(1, 5);

      expect(result).toEqual({ ok: true });
      const mirrorCall = query.mock.calls.find((call) =>
        call[0].includes('INSERT INTO enriquecimento_hospitalar (')
      );
      expect(mirrorCall).toBeTruthy();
      expect(mirrorCall[1][1]).toBe('{}');
    });

    it('rejects when vigencia does not belong to estabelecimento (404)', async () => {
      mockTransactionalQuery((sql) => {
        if (sql.includes('SELECT perfil FROM estabelecimentos')) {
          return Promise.resolve({ rows: [{ perfil: 'Hospitalar' }] });
        }
        if (sql.includes('SELECT id FROM enriquecimento_hospitalar_leitos_vigencia')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(deleteLeitosVigencia(1, 999)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('mirrorOpenVigenciaLeitos', () => {
    it('is a no-op for perfil APS', async () => {
      const execute = jest.fn();
      await mirrorOpenVigenciaLeitos(1, 'APS', execute);
      expect(execute).not.toHaveBeenCalled();
    });

    it('mirrors into enriquecimento_misto for perfil Misto', async () => {
      const execute = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ leitos: { clinico: 3 } }] })
        .mockResolvedValueOnce({ rows: [] });

      await mirrorOpenVigenciaLeitos(1, 'Misto', execute);

      expect(execute.mock.calls[1][0]).toMatch(/INSERT INTO enriquecimento_misto \(/);
      expect(execute.mock.calls[1][1][1]).toBe(JSON.stringify({ clinico: 3 }));
    });
  });
});
