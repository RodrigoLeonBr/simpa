const requireAdmin = require('../src/middleware/requireAdmin');

describe('requireAdmin middleware', () => {
  it('allows Administrador perfil', () => {
    const req = { user: { perfil: 'Administrador' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks other perfis', () => {
    const req = { user: { perfil: 'Planejamento' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
