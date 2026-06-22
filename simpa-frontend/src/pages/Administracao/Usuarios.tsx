import { useMemo } from 'react';
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
import { ToastBanner } from '../../components/shared/Toast';
import { useEntityCrud } from '../../hooks/useEntityCrud';
import {
  mapUsuarioCreatePayload,
  mapUsuarioForTable,
  mapUsuarioUpdatePayload,
  perfilSelectOptions,
  USUARIO_COLUMNS,
  USUARIO_CREATE_FIELDS,
  USUARIO_CRUD_MESSAGES,
  USUARIO_EDIT_FIELDS,
  type UsuarioCreatePayload,
  type UsuarioUpdatePayload,
} from '../../utils/adminView';

export function UsuariosPage() {
  const { user } = useAuth();
  const perfilOptions = useMemo(() => ({ perfil: perfilSelectOptions() }), []);

  const {
    rows,
    tableRows,
    loading,
    error,
    formOpen,
    editingRow,
    openCreate,
    openEdit,
    closeForm,
    confirmOpen,
    targetRow,
    openConfirm,
    closeConfirm,
    handleConfirm,
    busyId,
    handleSubmit,
    toast,
  } = useEntityCrud<AdminUsuario, UsuarioCreatePayload, UsuarioUpdatePayload>({
    fetchList: fetchUsuarios,
    mapRowForTable: mapUsuarioForTable,
    errorMessage: 'Falha ao carregar usuários',
    createItem: createUsuario,
    updateItem: updateUsuario,
    inactivateItem: inactivateUsuario,
    mapCreatePayload: mapUsuarioCreatePayload,
    mapUpdatePayload: mapUsuarioUpdatePayload,
    messages: USUARIO_CRUD_MESSAGES,
  });

  return (
    <section className="cadastro-crud-page" data-testid="admin-usuarios-page">
      <div className="cadastro-crud-head">
        <div>
          <h2 className="analytics-title">Usuários e Perfis</h2>
          <p className="analytics-subtitle">Gerencie contas de acesso e perfis do SIMPA</p>
        </div>
        <button type="button" className="cadastro-btn primary" onClick={openCreate}>
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
            if (original?.username === user?.username) return;
            if (original) openEdit(original);
          }}
          onInactivate={(row) => {
            const original = rows.find((item) => item.id === Number(row.id));
            if (!original || original.username === user?.username) return;
            openConfirm(original);
          }}
          onDelete={() => {}}
        />
      )}

      <FormDialog
        open={formOpen}
        title={editingRow ? 'Editar usuário' : 'Novo usuário'}
        fields={editingRow ? USUARIO_EDIT_FIELDS : USUARIO_CREATE_FIELDS}
        initialValues={
          editingRow
            ? {
                nome: editingRow.nome,
                perfil: editingRow.perfil,
                ativo: editingRow.ativo ? 'sim' : 'não',
                senha: '',
              }
            : undefined
        }
        selectOptions={perfilOptions}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Inativar usuário"
        message={`Deseja inativar o usuário "${targetRow?.username}"?`}
        confirmLabel="Inativar"
        busy={busyId !== null}
        onCancel={closeConfirm}
        onConfirm={() => void handleConfirm()}
      />

      <ToastBanner message={toast.message} visible={toast.visible} />
    </section>
  );
}
