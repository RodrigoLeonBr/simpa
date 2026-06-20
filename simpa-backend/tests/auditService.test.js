jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const { logAudit } = require('../src/services/auditService');

describe('auditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rowCount: 1 });
  });

  it('inserts audit_log row with null defaults', async () => {
    await logAudit({ acao: 'login_failed' });

    expect(query).toHaveBeenCalledWith(expect.any(String), [
      null,
      'login_failed',
      null,
      null,
      null,
    ]);
  });

  it('inserts audit_log row with provided fields', async () => {
    await logAudit({
      usuarioId: 7,
      acao: 'login_success',
      recurso: 'auth/login',
      detalhes: { username: 'admin' },
      ip: '127.0.0.1',
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_log'),
      [7, 'login_success', 'auth/login', { username: 'admin' }, '127.0.0.1']
    );
  });
});
