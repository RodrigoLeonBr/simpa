import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../contexts/AuthContext';
import { writeStoredSession } from '../../types/auth';
import {
  createUsuario,
  fetchAuditLog,
  fetchConfiguracoes,
  fetchBackups,
  fetchUsuarios,
  inactivateUsuario,
  updateConfiguracoes,
  updateUsuario,
  createBackup,
} from '../../api/admin';
import AdminPage from './index';

vi.mock('../../api/admin', () => ({
  fetchUsuarios: vi.fn(),
  createUsuario: vi.fn(),
  updateUsuario: vi.fn(),
  inactivateUsuario: vi.fn(),
  fetchAuditLog: vi.fn(),
  fetchConfiguracoes: vi.fn(),
  updateConfiguracoes: vi.fn(),
  fetchBackups: vi.fn(),
  createBackup: vi.fn(),
  deleteBackup: vi.fn(),
  downloadBackup: vi.fn(),
  restoreBackup: vi.fn(),
}));

function renderAdmin(initialEntry: string, perfil: string) {
  writeStoredSession({
    token: 'test-token',
    user: { username: 'user1', nome: 'Usuário Teste', perfil },
  });

  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/" element={<div>home-page</div>} />
          <Route path="/admin/*" element={<AdminPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('Administração pages', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchUsuarios).mockResolvedValue([]);
    vi.mocked(fetchAuditLog).mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 1 },
    });
    vi.mocked(fetchConfiguracoes).mockResolvedValue([]);
    vi.mocked(fetchBackups).mockResolvedValue([]);
    vi.mocked(createUsuario).mockResolvedValue({
      id: 2,
      username: 'novo',
      nome: 'Novo Usuário',
      perfil: 'Planejamento',
      ativo: true,
    });
    vi.mocked(updateConfiguracoes).mockResolvedValue([
      { chave: 'competencia_ativa_padrao', valor: '2026-05' },
    ]);
  });

  it('redirects non-admin user from /admin/usuarios to home', async () => {
    renderAdmin('/admin/usuarios', 'Gestor Secretaria');

    expect(await screen.findByText('home-page')).toBeInTheDocument();
    expect(fetchUsuarios).not.toHaveBeenCalled();
  });

  it('renders audit log empty state for admin', async () => {
    renderAdmin('/admin/auditoria', 'Administrador');

    expect(await screen.findByTestId('admin-audit-empty')).toHaveTextContent(
      'Nenhum registro de auditoria encontrado.',
    );
    expect(fetchAuditLog).toHaveBeenCalled();
  });

  it('renders usuario table and inactivates user', async () => {
    vi.mocked(fetchUsuarios).mockResolvedValue([
      {
        id: 1,
        username: 'admin',
        nome: 'Administrador',
        perfil: 'Administrador',
        ativo: true,
        ultimo_login: '2026-05-01T12:00:00.000Z',
      },
    ]);
    vi.mocked(inactivateUsuario).mockResolvedValue({ inativado: true, id: 1 });

    const user = userEvent.setup();
    renderAdmin('/admin/usuarios', 'Administrador');

    expect(await screen.findByTestId('cadastro-data-table')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Inativar' }));
    await user.click(screen.getByTestId('confirm-dialog-action'));

    await waitFor(() => {
      expect(inactivateUsuario).toHaveBeenCalledWith(1);
    });
  });

  it('blocks editing the logged user account', async () => {
    vi.mocked(fetchUsuarios).mockResolvedValue([
      {
        id: 1,
        username: 'user1',
        nome: 'Usuário Logado',
        perfil: 'Administrador',
        ativo: true,
      },
    ]);

    const user = userEvent.setup();
    renderAdmin('/admin/usuarios', 'Administrador');

    await user.click(await screen.findByRole('button', { name: 'Editar' }));

    expect(screen.queryByTestId('form-dialog')).not.toBeInTheDocument();
    expect(updateUsuario).not.toHaveBeenCalled();
  });

  it('redirects Planejamento from usuarios to auditoria', async () => {
    renderAdmin('/admin/usuarios', 'Planejamento');

    expect(await screen.findByTestId('admin-audit-page')).toBeInTheDocument();
    expect(fetchUsuarios).not.toHaveBeenCalled();
  });

  it('shows audit log load error', async () => {
    vi.mocked(fetchAuditLog).mockRejectedValueOnce(new Error('Falha de rede'));

    renderAdmin('/admin/auditoria', 'Administrador');

    expect(await screen.findByText('Falha de rede')).toBeInTheDocument();
  });

  it('navigates audit log pagination', async () => {
    vi.mocked(fetchAuditLog)
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            usuario_id: 1,
            username: 'admin',
            acao: 'login_success',
            recurso: 'auth/login',
            detalhes: null,
            ip: '127.0.0.1',
            criado_em: '2026-05-01T12:00:00.000Z',
          },
        ],
        pagination: { page: 1, limit: 20, total: 40, pages: 2 },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 2,
            usuario_id: 1,
            username: 'admin',
            acao: 'usuario_create',
            recurso: 'admin/usuarios/2',
            detalhes: null,
            ip: '127.0.0.1',
            criado_em: '2026-05-02T12:00:00.000Z',
          },
        ],
        pagination: { page: 2, limit: 20, total: 40, pages: 2 },
      });

    const user = userEvent.setup();
    renderAdmin('/admin/auditoria', 'Administrador');

    await screen.findByText('login_success');
    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    await waitFor(() => {
      expect(fetchAuditLog).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });
    expect(await screen.findByText('usuario_create')).toBeInTheDocument();
  });

  it('updates existing usuario through edit dialog', async () => {
    vi.mocked(fetchUsuarios).mockResolvedValue([
      {
        id: 1,
        username: 'admin',
        nome: 'Administrador',
        perfil: 'Administrador',
        ativo: true,
      },
    ]);
    vi.mocked(updateUsuario).mockResolvedValue({
      id: 1,
      username: 'admin',
      nome: 'Admin Atualizado',
      perfil: 'Administrador',
      ativo: true,
    });

    const user = userEvent.setup();
    renderAdmin('/admin/usuarios', 'Administrador');

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText(/Nome completo/i));
    await user.type(screen.getByLabelText(/Nome completo/i), 'Admin Atualizado');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(updateUsuario).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ nome: 'Admin Atualizado', ativo: true }),
      );
    });
  });

  it('renders audit log rows with pagination controls', async () => {
    vi.mocked(fetchAuditLog).mockResolvedValue({
      data: [
        {
          id: 1,
          usuario_id: 1,
          username: 'admin',
          acao: 'login_success',
          recurso: 'auth/login',
          detalhes: null,
          ip: '127.0.0.1',
          criado_em: '2026-05-01T12:00:00.000Z',
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });

    renderAdmin('/admin/auditoria', 'Administrador');

    expect(await screen.findByTestId('admin-audit-table')).toBeInTheDocument();
    expect(screen.getByText('login_success')).toBeInTheDocument();
    expect(screen.getByTestId('admin-audit-pagination')).toBeInTheDocument();
  });

  it('creates user form submits to API mock', async () => {
    vi.mocked(fetchUsuarios)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 2,
          username: 'novo',
          nome: 'Novo Usuário',
          perfil: 'Planejamento',
          ativo: true,
        },
      ]);

    const user = userEvent.setup();
    renderAdmin('/admin/usuarios', 'Administrador');

    await user.click(await screen.findByRole('button', { name: 'Novo usuário' }));
    const dialog = await screen.findByTestId('form-dialog');
    await user.type(dialog.querySelector('input.mono')!, 'novo');
    await user.type(screen.getByLabelText(/^Senha/i), 'senha-forte');
    await user.type(screen.getByLabelText(/Nome completo/i), 'Novo Usuário');
    await user.selectOptions(screen.getByLabelText(/^Perfil/i), 'Planejamento');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(createUsuario).toHaveBeenCalledWith({
        username: 'novo',
        senha: 'senha-forte',
        nome: 'Novo Usuário',
        perfil: 'Planejamento',
      });
    });
  });

  it('shows only auditoria sub-nav for Planejamento profile', async () => {
    renderAdmin('/admin/auditoria', 'Planejamento');

    expect(await screen.findByTestId('admin-subnav')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Auditoria' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Configurações' })).not.toBeInTheDocument();
  });

  it('saves default competencia configuration', async () => {
    vi.mocked(fetchConfiguracoes).mockResolvedValue([
      { chave: 'competencia_ativa_padrao', valor: '2026-04' },
    ]);

    const user = userEvent.setup();
    renderAdmin('/admin/configuracoes', 'Administrador');

    const select = await screen.findByTestId('competencia-padrao-select');
    await user.selectOptions(select, '2026-05');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(updateConfiguracoes).toHaveBeenCalledWith([
        expect.objectContaining({
          chave: 'competencia_ativa_padrao',
          valor: '2026-05',
        }),
      ]);
    });
  });

  it('renders backup page and creates backup', async () => {
    vi.mocked(fetchBackups)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          filename: 'simpa-backup-2026-06-21T12-00-00-000Z.sql',
          size: 2048,
          created_at: '2026-06-21T12:00:00.000Z',
        },
      ]);
    vi.mocked(createBackup).mockResolvedValue({
      filename: 'simpa-backup-2026-06-21T12-00-00-000Z.sql',
      size: 2048,
      created_at: '2026-06-21T12:00:00.000Z',
    });

    const user = userEvent.setup();
    renderAdmin('/admin/backup', 'Administrador');

    expect(await screen.findByTestId('admin-backup-empty')).toBeInTheDocument();
    await user.click(screen.getByTestId('admin-backup-create'));

    await waitFor(() => {
      expect(createBackup).toHaveBeenCalled();
    });
    expect(await screen.findByTestId('admin-backup-table')).toBeInTheDocument();
  });
});
