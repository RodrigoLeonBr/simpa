const requireAdminOrPlanning = require('../src/middleware/requireAdminOrPlanning');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireAdminOrPlanning', () => {
  it('allows Administrador and Planejamento', () => {
    const next = jest.fn();

    requireAdminOrPlanning({ user: { perfil: 'Administrador' } }, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);

    next.mockClear();
    requireAdminOrPlanning({ user: { perfil: 'Planejamento' } }, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 for other profiles', () => {
    const res = mockRes();
    const next = jest.fn();

    requireAdminOrPlanning({ user: { perfil: 'Visualizador' } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Acesso restrito a Administrador ou Planejamento',
    });
  });
});
