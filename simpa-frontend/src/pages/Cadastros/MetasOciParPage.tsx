import { Link } from 'react-router-dom';
import {
  createMetaOciPar,
  fetchMetasOciPar,
  inactivateMetaOciPar,
  updateMetaOciPar,
  type MetaOciPar,
} from '../../api/cadastros';
import { ConfirmDialog } from '../../components/cadastros/ConfirmDialog';
import { DataTable } from '../../components/cadastros/DataTable';
import { FormDialog } from '../../components/cadastros/FormDialog';
import { ToastBanner } from '../../components/shared/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useEntityCrud } from '../../hooks/useEntityCrud';
import type { CadastroFieldDef } from '../../config/cadastroEntities';

const FIELDS: CadastroFieldDef[] = [
  { key: 'competencia', label: 'Competência (YYYY-MM)', required: true, mono: true },
  { key: 'tipo_oci', label: 'Tipo OCI', required: true },
  { key: 'meta_quantidade', label: 'Meta quantidade', required: true, type: 'number' },
  { key: 'meta_valor', label: 'Meta valor (opcional)', type: 'number' },
  { key: 'codigo_sigtap_prefix', label: 'Prefixo SIGTAP', mono: true },
  {
    key: 'periodicidade',
    label: 'Periodicidade',
    required: true,
    type: 'select',
  },
  { key: 'origem', label: 'Origem' },
];

const COLUMNS = [
  { key: 'competencia', label: 'Competência', mono: true },
  { key: 'tipo_oci', label: 'Tipo OCI' },
  { key: 'meta_quantidade', label: 'Meta qtd' },
  { key: 'codigo_sigtap_prefix', label: 'SIGTAP', mono: true },
  { key: 'periodicidade', label: 'Periodicidade' },
  { key: 'estabelecimento_nome', label: 'Estabelecimento' },
];

const PERIODICIDADE_OPTIONS = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'quadrimestral', label: 'Quadrimestral' },
  { value: 'anual', label: 'Anual' },
];

function rowToForm(row?: MetaOciPar | null): Record<string, string> {
  if (!row) {
    return {
      competencia: '',
      tipo_oci: '',
      meta_quantidade: '',
      meta_valor: '',
      codigo_sigtap_prefix: '',
      periodicidade: 'mensal',
      origem: 'PAR-PMAE',
    };
  }
  return {
    competencia: row.competencia,
    tipo_oci: row.tipo_oci,
    meta_quantidade: String(row.meta_quantidade),
    meta_valor: row.meta_valor == null ? '' : String(row.meta_valor),
    codigo_sigtap_prefix: row.codigo_sigtap_prefix ?? '',
    periodicidade: row.periodicidade,
    origem: row.origem,
  };
}

function mapPayload(values: Record<string, string>): Partial<MetaOciPar> {
  return {
    competencia: values.competencia.trim(),
    tipo_oci: values.tipo_oci.trim(),
    meta_quantidade: Number.parseInt(values.meta_quantidade, 10),
    meta_valor: values.meta_valor.trim() ? Number.parseFloat(values.meta_valor) : null,
    codigo_sigtap_prefix: values.codigo_sigtap_prefix.trim() || null,
    periodicidade: values.periodicidade as MetaOciPar['periodicidade'],
    origem: values.origem.trim() || 'PAR-PMAE',
  };
}

export function MetasOciParPage() {
  const { user } = useAuth();
  const canEdit = user?.perfil === 'Administrador' || user?.perfil === 'Planejamento';

  const {
    tableRows,
    loading,
    error,
    formOpen,
    editingRow,
    openCreate,
    openEdit,
    closeForm,
    confirmOpen,
    openConfirm,
    closeConfirm,
    handleConfirm,
    busyId,
    handleSubmit,
    toast,
  } = useEntityCrud<MetaOciPar>({
    fetchList: fetchMetasOciPar,
    mapRowForTable: (row) => row as unknown as Record<string, unknown>,
    errorMessage: 'Falha ao carregar metas OCI/PAR',
    inactivateItem: inactivateMetaOciPar,
    onSubmit: async (values, editing) => {
      const payload = mapPayload(values);
      if (editing) {
        await updateMetaOciPar(editing.id, payload);
      } else {
        await createMetaOciPar(payload);
      }
    },
    messages: {
      created: 'Meta OCI/PAR criada',
      updated: 'Meta OCI/PAR atualizada',
      inactivated: 'Meta OCI/PAR inativada',
      loadFailed: 'Falha ao carregar metas OCI/PAR',
    },
  });

  return (
    <section className="cadastro-page simpa-rise" data-testid="metas-oci-par-page">
      <div className="cadastro-crud-head">
        <div>
          <Link to="/cadastros" className="cadastro-back-link">
            ← Cadastros
          </Link>
          <h2 className="analytics-title">Metas OCI / PAR</h2>
          <p className="analytics-subtitle">
            Metas de produção pactuadas no PAR (PMAE/PATE). Alimentam o indicador de alcance no Painel
            MAC.
          </p>
        </div>
        {canEdit ? (
          <button type="button" className="cadastro-btn primary" onClick={openCreate}>
            Nova meta
          </button>
        ) : null}
      </div>

      <section className="card cadastro-crud-card">
        {loading ? (
          <div className="analytics-state">Carregando metas…</div>
        ) : error ? (
          <div className="analytics-state analytics-state-error">{error}</div>
        ) : (
          <DataTable
            columns={COLUMNS}
            rows={tableRows}
            canEdit={canEdit}
            showDelete={false}
            onEdit={(row) => openEdit(row as unknown as MetaOciPar)}
            onInactivate={(row) => openConfirm(row as unknown as MetaOciPar)}
          />
        )}
      </section>

      {canEdit ? (
        <FormDialog
          open={formOpen}
          title={editingRow ? 'Editar meta OCI/PAR' : 'Nova meta OCI/PAR'}
          fields={FIELDS}
          initialValues={rowToForm(editingRow)}
          selectOptions={{ periodicidade: PERIODICIDADE_OPTIONS }}
          onClose={closeForm}
          onSubmit={handleSubmit}
          submitDisabled={false}
        />
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Inativar meta"
        message="A meta deixará de ser considerada no cálculo de alcance PAR."
        confirmLabel="Inativar"
        onCancel={closeConfirm}
        onConfirm={() => void handleConfirm()}
        busy={busyId !== null}
      />
      <ToastBanner message={toast.message} visible={toast.visible} />
    </section>
  );
}
