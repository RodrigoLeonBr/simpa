import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupPage } from './Backup';
import * as api from '../../api/admin';

vi.mock('../../api/admin');

const meta = (over: Partial<api.DbBackupMeta extends never ? never : import('../../types/admin').DbBackupMeta> = {}) =>
  ({ filename: 'dump-2026.sql', size: 2048, created_at: '2026-01-01T10:00:00Z', ...over }) as import('../../types/admin').DbBackupMeta;

beforeEach(() => {
  vi.mocked(api.fetchBackups).mockResolvedValue([meta({ size: 500 }), meta({ filename: 'big.sql', size: 2 * 1024 * 1024 })]);
  vi.mocked(api.createBackup).mockResolvedValue({ filename: 'novo.sql' } as never);
  vi.mocked(api.deleteBackup).mockResolvedValue(undefined as never);
  vi.mocked(api.downloadBackup).mockResolvedValue(undefined as never);
  vi.mocked(api.restoreBackup).mockResolvedValue(undefined as never);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('BackupPage', () => {
  it('lista backups com tamanhos formatados', async () => {
    render(<BackupPage />);
    expect(screen.getByText('Carregando backups…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('500 B')).toBeInTheDocument());
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });

  it('estado vazio', async () => {
    vi.mocked(api.fetchBackups).mockResolvedValueOnce([]);
    render(<BackupPage />);
    await waitFor(() => expect(screen.getByTestId('admin-backup-empty')).toBeInTheDocument());
  });

  it('erro ao carregar', async () => {
    vi.mocked(api.fetchBackups).mockRejectedValueOnce(new Error('sem permissão'));
    render(<BackupPage />);
    await waitFor(() => expect(screen.getByText('sem permissão')).toBeInTheDocument());
  });

  it('cria backup e recarrega', async () => {
    render(<BackupPage />);
    await screen.findByText('500 B');
    fireEvent.click(screen.getByTestId('admin-backup-create'));
    await waitFor(() => expect(screen.getByText(/Backup criado: novo.sql/)).toBeInTheDocument());
    expect(api.fetchBackups).toHaveBeenCalledTimes(2);
  });

  it('erro ao criar backup', async () => {
    vi.mocked(api.createBackup).mockRejectedValueOnce(new Error('disco cheio'));
    render(<BackupPage />);
    await screen.findByText('500 B');
    fireEvent.click(screen.getByTestId('admin-backup-create'));
    await waitFor(() => expect(screen.getByText('disco cheio')).toBeInTheDocument());
  });

  it('exclui backup', async () => {
    render(<BackupPage />);
    await screen.findByText('500 B');
    fireEvent.click(screen.getAllByText('Excluir')[0]);
    await waitFor(() => expect(api.deleteBackup).toHaveBeenCalled());
    expect(screen.getByText('Backup removido')).toBeInTheDocument();
  });

  it('erro ao baixar backup', async () => {
    vi.mocked(api.downloadBackup).mockRejectedValueOnce(new Error('indisponível'));
    render(<BackupPage />);
    await screen.findByText('500 B');
    fireEvent.click(screen.getAllByText('Baixar')[0]);
    await waitFor(() => expect(screen.getByText('indisponível')).toBeInTheDocument());
  });

  it('restaura a partir da lista', async () => {
    render(<BackupPage />);
    await screen.findByText('500 B');
    fireEvent.click(screen.getAllByText('Restaurar')[0]);
    expect(screen.getByText(/Todos os dados atuais serão substituídos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'RESTAURAR' }));
    await waitFor(() => expect(api.restoreBackup).toHaveBeenCalledWith(expect.objectContaining({ filename: 'dump-2026.sql', confirm: 'RESTAURAR' })));
    expect(screen.getByText('Banco restaurado com sucesso')).toBeInTheDocument();
  });

  it('restaura a partir de arquivo enviado', async () => {
    render(<BackupPage />);
    await screen.findByText('500 B');
    const f = new File(['-- dump'], 'manual.sql', { type: 'application/sql' });
    fireEvent.change(screen.getByTestId('admin-backup-file-input'), { target: { files: [f] } });
    expect(screen.getByText(/Restaurar o arquivo "manual.sql"/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'RESTAURAR' }));
    await waitFor(() => expect(api.restoreBackup).toHaveBeenCalledWith(expect.objectContaining({ file: f, confirm: 'RESTAURAR' })));
  });

  it('erro ao restaurar', async () => {
    vi.mocked(api.restoreBackup).mockRejectedValueOnce(new Error('restore falhou'));
    render(<BackupPage />);
    await screen.findByText('500 B');
    fireEvent.click(screen.getAllByText('Restaurar')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'RESTAURAR' }));
    await waitFor(() => expect(screen.getByText('restore falhou')).toBeInTheDocument());
  });
});
