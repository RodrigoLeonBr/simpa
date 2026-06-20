import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createUsuario,
  fetchUsuarios,
  inactivateUsuario,
  updateUsuario,
} from '../../api/admin';
import { useAuth } from '../../contexts/AuthContext';
import type { AdminUsuario } from '../../types/admin';
import { ConfirmDialog } from '../../components/cadastros/ConfirmDialog';
import { DataTable } from '../../components/cadastros/DataTable';
import { FormDialog } from '../../components/cadastros/FormDialog';
import { ToastBanner, useToast } from '../../components/shared/Toast';
import {
  perfilSelectOptions,
  USUARIO_COLUMNS,
  USUARIO_CREATE_FIELDS,
  USUARIO_EDIT_FIELDS,
  usuarioRowForTable,
} from '../../utils/adminView';

export function UsuariosPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AdminUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUsuario | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<AdminUsuario | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const { toast, showToast } = useToast();

  const perfilOptions = useMemo(() => ({ perfil: perfilSelectOptions() }), []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dados = await fetchUsuarios();
      setRows(dados);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar usuários');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const tableRows = useMemo(
    () => rows.map((row) => usuarioRowForTable(row as unknown as Record<string, unknown>)),
    [rows],
  );

  async function handleCreate(values: Record<string, string>) {
    await createUsuario({
      username: values.username.trim(),
      senha: values.senha,
      nome: values.nome.trim(),
      perfil: values.perfil,
    });
    showToast('Usuário criado');
    await carregar();
  }

  async function handleUpdate(values: Record<string, string>) {
    if (!editingUser) return;

    const payload: Partial<{ nome: string; perfil: string; ativo: boolean; senha: string }> = {
      nome: values.nome.trim(),
      perfil: values.perfil,
      ativo: values.ativo.trim().toLowerCase() === 'sim',
    };
    if (values.senha.trim()) {
      payload.senha = values.senha;
    }

    await updateUsuario(editingUser.id, payload);
    showToast('Usuário atualizado');
    await carregar();
  }

  async function confirmInactivate() {
    if (!targetUser) return;
    setBusyId(targetUser.id);
    try {
      await inactivateUsuario(targetUser.id);
      showToast('Usuário inativado');
      setConfirmOpen(false);
      setTargetUser(null);
      await carregar();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao inativar');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="cadastro-crud-page" data-testid="admin-usuarios-page">
      <div className="cadastro-crud-head">
        <div>
          <h2 className="analytics-title">Usuários e Perfis</h2>
          <p className="analytics-subtitle">Gerencie contas de acesso e perfis do SIMPA</p>
        </div>
        <button
          type="button"
          className="cadastro-btn primary"
          onClick={() => {
            setEditingUser(null);
            setFormOpen(true);
          }}
        >
          Novo usuário
        </button>
      </div>

      {loading ? (
        <div className="analytics-state">Carregando usuários…</div>
      ) : error ? (
        <div className="analytics-state analytics-state-error">{error}</div>
      ) : tableRows.length === 0 ? (
        <div className="analytics-state" data-testid="admin-usuarios-empty">
          Nenhum usuário cadastrado.
        </div>
      ) : (
        <DataTable
          columns={USUARIO_COLUMNS}
          rows={tableRows}
          busyId={busyId}
          showDelete={false}
          onEdit={(row) => {
            const original = rows.find((item) => item.id === Number(row.id));
            if (!original) return;
            setEditingUser(original);
            setFormOpen(true);
          }}
          onInactivate={(row) => {
            const original = rows.find((item) => item.id === Number(row.id));
            if (!original || original.username === user?.username) return;
            setTargetUser(original);
            setConfirmOpen(true);
          }}
          onDelete={() => {}}
        />
      )}

      <FormDialog
        open={formOpen}
        title={editingUser ? 'Editar usuário' : 'Novo usuário'}
        fields={editingUser ? USUARIO_EDIT_FIELDS : USUARIO_CREATE_FIELDS}
        initialValues={
          editingUser
            ? {
                nome: editingUser.nome,
                perfil: editingUser.perfil,
                ativo: editingUser.ativo ? 'sim' : 'não',
                senha: '',
              }
            : undefined
        }
        selectOptions={perfilOptions}
        onClose={() => {
          setFormOpen(false);
          setEditingUser(null);
        }}
        onSubmit={editingUser ? handleUpdate : handleCreate}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Inativar usuário"
        message={`Deseja inativar o usuário "${targetUser?.username}"?`}
        confirmLabel="Inativar"
        busy={busyId !== null}
        onCancel={() => {
          setConfirmOpen(false);
          setTargetUser(null);
        }}
        onConfirm={() => void confirmInactivate()}
      />

      <ToastBanner message={toast.message} visible={toast.visible} />
    </section>
  );
}
