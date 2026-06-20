import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CadastroEntityConfig } from '../../config/cadastroEntities';
import {
  createCadastro,
  fetchCadastroList,
  fetchEstabelecimentosAps,
  inactivateCadastro,
  updateCadastro,
} from '../../api/cadastros';
import { ToastBanner, useToast } from '../shared/Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { DataTable } from './DataTable';
import { FormDialog, type SelectOption } from './FormDialog';

type ConfirmAction = 'inactivate' | 'delete';

interface CadastroCrudPageProps {
  config: CadastroEntityConfig;
}

function rowToFormValues(
  config: CadastroEntityConfig,
  row: Record<string, unknown>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of config.fields) {
    let raw = row[field.key];
    if (raw === undefined && field.key === 'estabelecimento_id') {
      raw = row.unidade_id;
    }
    values[field.key] = raw === null || raw === undefined ? '' : String(raw);
  }
  return values;
}

function formValuesToPayload(
  config: CadastroEntityConfig,
  values: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of config.fields) {
    const value = values[field.key]?.trim() ?? '';
    if (!value) continue;

    if (field.type === 'number') {
      payload[field.key] = Number(value);
    } else if (field.type === 'select' && field.key.endsWith('_id')) {
      payload[field.key] = Number(value);
    } else {
      payload[field.key] = value;
    }
  }

  return payload;
}

export function CadastroCrudPage({ config }: CadastroCrudPageProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>('inactivate');
  const [targetRow, setTargetRow] = useState<Record<string, unknown> | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [estabelecimentoOptions, setEstabelecimentoOptions] = useState<SelectOption[]>([]);
  const { toast, showToast } = useToast();

  const selectOptions = useMemo<Record<string, SelectOption[]>>(() => {
    if (config.key !== 'equipes') {
      return {} as Record<string, SelectOption[]>;
    }
    return { estabelecimento_id: estabelecimentoOptions };
  }, [config.key, estabelecimentoOptions]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchCadastroList(config.key);
      setRows(data as unknown as Record<string, unknown>[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar cadastro');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [config.key]);

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial list fetch on mount
  }, [carregar]);

  useEffect(() => {
    if (config.key !== 'equipes') return;

    void fetchEstabelecimentosAps()
      .then((items) =>
        setEstabelecimentoOptions(
          items.map((est) => ({
            value: String(est.id),
            label: est.nome,
          })),
        ),
      )
      .catch(() => setEstabelecimentoOptions([]));
  }, [config.key]);

  const openCreate = () => {
    setEditingRow(null);
    setFormOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditingRow(row);
    setFormOpen(true);
  };

  const openConfirm = (row: Record<string, unknown>, action: ConfirmAction) => {
    setTargetRow(row);
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleSubmit = async (values: Record<string, string>) => {
    const payload = formValuesToPayload(config, values);

    if (editingRow) {
      await updateCadastro(config.key, Number(editingRow.id), payload);
      showToast(`${config.title} atualizado`);
    } else {
      await createCadastro(config.key, payload);
      showToast(`${config.title} criado`);
    }

    await carregar();
  };

  const handleConfirm = async () => {
    if (!targetRow) return;

    const id = Number(targetRow.id);
    setBusyId(id);

    try {
      await inactivateCadastro(config.key, id);
      showToast(
        confirmAction === 'delete'
          ? `${config.title} excluído`
          : `${config.title} inativado`,
      );
      setConfirmOpen(false);
      setTargetRow(null);
      await carregar();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha na operação');
    } finally {
      setBusyId(null);
    }
  };

  const confirmCopy =
    confirmAction === 'delete'
      ? {
          title: 'Excluir registro',
          message: 'Esta ação remove o registro da listagem ativa. Deseja continuar?',
          confirmLabel: 'Excluir',
        }
      : {
          title: 'Inativar registro',
          message: 'O registro ficará inativo e sairá da listagem. Deseja continuar?',
          confirmLabel: 'Inativar',
        };

  return (
    <div className="cadastro-crud-page simpa-rise" data-testid={`cadastro-crud-${config.key}`}>
      <div className="cadastro-crud-head">
        <div>
          <Link to="/cadastros" className="cadastro-back-link">
            ← Cadastros
          </Link>
          <h2 className="analytics-title">{config.title}</h2>
          <p className="analytics-subtitle">{config.description}</p>
        </div>
        <button type="button" className="cadastro-btn primary" onClick={openCreate}>
          Novo
        </button>
      </div>

      <section className="card cadastro-crud-card">
        <div className="cadastro-crud-card-head">
          <h3>Registros ativos</h3>
          <span className="mono cadastro-count">{rows.length}</span>
        </div>

        {loading ? (
          <div className="analytics-state">Carregando registros…</div>
        ) : error ? (
          <div className="analytics-state analytics-state-error">{error}</div>
        ) : rows.length === 0 ? (
          <p className="analytics-empty">Nenhum registro cadastrado.</p>
        ) : (
          <DataTable
            columns={config.columns}
            rows={rows}
            busyId={busyId}
            onEdit={openEdit}
            onInactivate={(row) => openConfirm(row, 'inactivate')}
            onDelete={(row) => openConfirm(row, 'delete')}
          />
        )}
      </section>

      <FormDialog
        open={formOpen}
        title={editingRow ? `Editar ${config.title}` : `Novo ${config.title}`}
        fields={config.fields}
        initialValues={editingRow ? rowToFormValues(config, editingRow) : undefined}
        selectOptions={selectOptions}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmLabel={confirmCopy.confirmLabel}
        busy={busyId !== null}
        onCancel={() => {
          setConfirmOpen(false);
          setTargetRow(null);
        }}
        onConfirm={() => void handleConfirm()}
      />

      <ToastBanner message={toast.message} visible={toast.visible} />
    </div>
  );
}
