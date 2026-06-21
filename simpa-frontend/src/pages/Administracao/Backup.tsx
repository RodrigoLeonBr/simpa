import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createBackup,
  deleteBackup,
  downloadBackup,
  fetchBackups,
  restoreBackup,
} from '../../api/admin';
import type { DbBackupMeta } from '../../types/admin';
import { ConfirmDialog } from '../../components/cadastros/ConfirmDialog';
import { ToastBanner, useToast } from '../../components/shared/Toast';

const RESTORE_CONFIRM = 'RESTAURAR';

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

export function BackupPage() {
  const [backups, setBackups] = useState<DbBackupMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<DbBackupMeta | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busyFilename, setBusyFilename] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast, showToast } = useToast();

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchBackups();
      setBackups(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar backups');
      setBackups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await createBackup();
      showToast(`Backup criado: ${created.filename}`);
      await carregar();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao criar backup');
    } finally {
      setCreating(false);
    }
  }

  async function handleDownload(filename: string) {
    setBusyFilename(filename);
    try {
      await downloadBackup(filename);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao baixar backup');
    } finally {
      setBusyFilename(null);
    }
  }

  async function handleDelete(filename: string) {
    setBusyFilename(filename);
    try {
      await deleteBackup(filename);
      showToast('Backup removido');
      await carregar();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao remover backup');
    } finally {
      setBusyFilename(null);
    }
  }

  function openRestoreFromList(item: DbBackupMeta) {
    setRestoreTarget(item);
    setRestoreFile(null);
    setConfirmOpen(true);
  }

  function openRestoreFromFile(file: File) {
    setRestoreTarget(null);
    setRestoreFile(file);
    setConfirmOpen(true);
  }

  async function handleRestoreConfirmed() {
    setConfirmOpen(false);
    setBusyFilename(restoreTarget?.filename ?? 'upload');
    try {
      await restoreBackup({
        filename: restoreTarget?.filename,
        file: restoreFile ?? undefined,
        confirm: RESTORE_CONFIRM,
      });
      showToast('Banco restaurado com sucesso');
      setRestoreTarget(null);
      setRestoreFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao restaurar backup');
    } finally {
      setBusyFilename(null);
    }
  }

  return (
    <section className="cadastro-crud-page" data-testid="admin-backup-page">
      <div>
        <h2 className="analytics-title">Backup do Banco de Dados</h2>
        <p className="analytics-subtitle">
          Gere, baixe e restaure backups PostgreSQL diretamente pelo sistema
        </p>
      </div>

      <div className="admin-backup-actions card">
        <button
          type="button"
          className="cadastro-btn primary"
          onClick={() => void handleCreate()}
          disabled={creating}
          data-testid="admin-backup-create"
        >
          {creating ? 'Gerando backup…' : 'Gerar backup agora'}
        </button>

        <div className="admin-backup-upload">
          <label htmlFor="backup-restore-file">Restaurar de arquivo .sql</label>
          <input
            id="backup-restore-file"
            ref={fileInputRef}
            type="file"
            accept=".sql,text/sql,application/sql"
            data-testid="admin-backup-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                openRestoreFromFile(file);
              }
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="analytics-state">Carregando backups…</div>
      ) : error ? (
        <div className="analytics-state analytics-state-error">{error}</div>
      ) : backups.length === 0 ? (
        <div className="analytics-state" data-testid="admin-backup-empty">
          Nenhum backup armazenado no servidor. Clique em &quot;Gerar backup agora&quot;.
        </div>
      ) : (
        <div className="admin-backup-table-wrap card" data-testid="admin-backup-table">
          <table className="cadastro-table">
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Tamanho</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((item) => (
                <tr key={item.filename}>
                  <td className="mono">{item.filename}</td>
                  <td>{formatBytes(item.size)}</td>
                  <td>{formatDate(item.created_at)}</td>
                  <td className="admin-backup-row-actions">
                    <button
                      type="button"
                      className="cadastro-btn ghost"
                      disabled={busyFilename === item.filename}
                      onClick={() => void handleDownload(item.filename)}
                    >
                      Baixar
                    </button>
                    <button
                      type="button"
                      className="cadastro-btn ghost"
                      disabled={busyFilename === item.filename}
                      onClick={() => openRestoreFromList(item)}
                    >
                      Restaurar
                    </button>
                    <button
                      type="button"
                      className="cadastro-btn ghost danger"
                      disabled={busyFilename === item.filename}
                      onClick={() => void handleDelete(item.filename)}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="admin-config-hint">
        A restauração substitui os dados atuais do PostgreSQL. Digite {RESTORE_CONFIRM} para
        confirmar. Operação registrada na auditoria.
      </p>

      <ConfirmDialog
        open={confirmOpen}
        title="Restaurar backup"
        message={
          restoreTarget
            ? `Restaurar o backup "${restoreTarget.filename}"? Todos os dados atuais serão substituídos.`
            : restoreFile
              ? `Restaurar o arquivo "${restoreFile.name}"? Todos os dados atuais serão substituídos.`
              : 'Confirmar restauração do banco de dados?'
        }
        confirmLabel={RESTORE_CONFIRM}
        onConfirm={() => void handleRestoreConfirmed()}
        onCancel={() => {
          setConfirmOpen(false);
          setRestoreTarget(null);
          setRestoreFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
      />

      <ToastBanner message={toast.message} visible={toast.visible} />
    </section>
  );
}
