jest.mock('../src/services/db');

const bcrypt = require('bcrypt');
const { query } = require('../src/services/db');
const {
  authenticate,
  verifyPassword,
  INVALID_CREDENTIALS,
} = require('../src/services/authService');

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    process.env.JWT_EXPIRES_IN = '8h';
  });

  it('verifyPassword returns true for matching bcrypt hash', async () => {
    const hash = await bcrypt.hash('simpa@2026', 4);
    await expect(verifyPassword('simpa@2026', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('authenticate returns token and user on valid credentials', async () => {
    const hash = await bcrypt.hash('simpa@2026', 4);
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            username: 'admin',
            senha_hash: hash,
            nome: 'Administrador SIMPA',
            perfil: 'Administrador',
            ativo: true,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await authenticate('admin', 'simpa@2026');

    expect(result.ok).toBe(true);
    expect(result.token).toEqual(expect.any(String));
    expect(result.user).toEqual({
      username: 'admin',
      nome: 'Administrador SIMPA',
      perfil: 'Administrador',
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('jwtSecret throws when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    expect(() => require('../src/services/authService').jwtSecret()).toThrow(
      /JWT_SECRET/
    );
  });

  it('authenticate fails for unknown user without leaking enumeration', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const result = await authenticate('ghost', 'any');

    expect(result.ok).toBe(false);
    expect(result.user).toBeNull();
    expect(INVALID_CREDENTIALS).toBe('Credenciais inválidas');
  });

  it('authenticate fails for wrong password', async () => {
    const hash = await bcrypt.hash('simpa@2026', 4);
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          username: 'admin',
          senha_hash: hash,
          nome: 'Admin',
          perfil: 'Administrador',
          ativo: true,
        },
      ],
    });

    const result = await authenticate('admin', 'wrong-password');

    expect(result.ok).toBe(false);
    expect(result.user.id).toBe(2);
  });
});
