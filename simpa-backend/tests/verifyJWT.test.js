const jwt = require('jsonwebtoken');

jest.mock('../src/services/authService', () => {
  const actual = jest.requireActual('../src/services/authService');
  return {
    ...actual,
    jwtSecret: jest.fn(() => 'test-secret-with-at-least-32-characters'),
  };
});

const verifyJWT = require('../src/middleware/verifyJWT');

function createMocks() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const req = { headers: {} };
  const res = { status };
  const next = jest.fn();
  return { req, res, next, status, json };
}

describe('verifyJWT', () => {
  it('rejects requests without Authorization header', () => {
    const { req, res, next, status, json } = createMocks();

    verifyJWT(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Token ausente ou inválido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects malformed tokens', () => {
    const { req, res, next, status, json } = createMocks();
    req.headers.authorization = 'Bearer not-a-valid-jwt';

    verifyJWT(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Token ausente ou inválido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects expired tokens', () => {
    const { req, res, next, status, json } = createMocks();
    const expired = jwt.sign(
      { sub: 1, username: 'admin', nome: 'Admin', perfil: 'Administrador' },
      'test-secret-with-at-least-32-characters',
      { expiresIn: '-1s' }
    );
    req.headers.authorization = `Bearer ${expired}`;

    verifyJWT(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('injects req.user for valid tokens', () => {
    const { req, res, next } = createMocks();
    const token = jwt.sign(
      { sub: 42, username: 'admin', nome: 'Admin', perfil: 'Administrador' },
      'test-secret-with-at-least-32-characters',
      { expiresIn: '1h' }
    );
    req.headers.authorization = `Bearer ${token}`;

    verifyJWT(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({
      id: 42,
      username: 'admin',
      nome: 'Admin',
      perfil: 'Administrador',
    });
  });
});
