import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createUsuario,
  fetchAuditLog,
  fetchConfiguracoes,
  fetchUsuarios,
  inactivateUsuario,
  updateConfiguracoes,
  updateUsuario,
} from './admin';
import { apiFetch } from './client';

vi.mock('./client', () => ({
  apiFetch: vi.fn(),
}));

describe('admin api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls usuario CRUD endpoints', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce({ id: 2 })
      .mockResolvedValueOnce({ id: 2, nome: 'Atualizado' })
      .mockResolvedValueOnce({ inativado: true, id: 2 });

    await fetchUsuarios();
    await createUsuario({
      username: 'novo',
      senha: 'senha',
      nome: 'Novo',
      perfil: 'Planejamento',
    });
    await updateUsuario(2, { nome: 'Atualizado' });
    await inactivateUsuario(2);

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/admin/usuarios');
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/usuarios',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      3,
      '/api/admin/usuarios/2',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      4,
      '/api/admin/usuarios/2',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('builds audit log query string', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      data: [],
      pagination: { page: 2, limit: 10, total: 0, pages: 1 },
    });

    await fetchAuditLog({ page: 2, limit: 10, acao: 'login_success' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/admin/audit-log?page=2&limit=10&acao=login_success',
    );
  });

  it('loads audit log without filters', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 1 },
    });

    await fetchAuditLog();

    expect(apiFetch).toHaveBeenCalledWith('/api/admin/audit-log');
  });

  it('updates configuracoes in batch', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([{ chave: 'competencia_ativa_padrao', valor: '2026-05' }]);

    await fetchConfiguracoes();
    await updateConfiguracoes([{ chave: 'competencia_ativa_padrao', valor: '2026-05' }]);

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/admin/configuracoes');
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/configuracoes',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
