import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createPainelWidget,
  fetchPainelMetricas,
  fetchPainelWidgets,
  inactivatePainelWidget,
  updatePainelWidget,
} from '../../api/painelWidgets';
import { ConfirmDialog } from '../../components/cadastros/ConfirmDialog';
import { FormDialog, type SelectOption } from '../../components/cadastros/FormDialog';
import { ToastBanner, useToast } from '../../components/shared/Toast';
import type { CadastroFieldDef } from '../../config/cadastroEntities';
import { useAuth } from '../../contexts/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import type { PainelMetricaCatalogo, PainelWidgetConfig } from '../../types/painelWidgets';

function canEditIndicadoresPainel(perfil: string | undefined): boolean {
  return perfil === 'Administrador' || perfil === 'Planejamento';
}

function formatTipo(tipo: PainelWidgetConfig['tipo']): string {
  if (tipo === 'card') return 'Card';
  if (tipo === 'grafico_linha') return 'Linha';
  if (tipo === 'grafico_ranking') return 'Ranking';
  return 'Barra';
}

const WIDGET_FIELDS: CadastroFieldDef[] = [
  { key: 'slug', label: 'Slug', required: true, mono: true },
  { key: 'titulo', label: 'Título', required: true },
  { key: 'subtitulo', label: 'Subtítulo' },
  { key: 'tipo', label: 'Tipo', required: true, type: 'select' },
  { key: 'formato', label: 'Formato', required: true, type: 'select' },
  { key: 'metrica_id', label: 'Métrica principal', required: true, type: 'select' },
  { key: 'spark_metrica_id', label: 'Métrica sparkline (opcional)', type: 'select' },
];

function rowToValues(row?: PainelWidgetConfig | null): Record<string, string> {
  if (!row) {
    return {
      slug: '',
      titulo: '',
      subtitulo: '',
      tipo: 'card',
      formato: 'numero',
      metrica_id: '',
      spark_metrica_id: '',
    };
  }

  return {
    slug: row.slug,
    titulo: row.titulo,
    subtitulo: row.subtitulo ?? '',
    tipo: row.tipo,
    formato: row.formato,
    metrica_id: row.metrica_id ? String(row.metrica_id) : '',
    spark_metrica_id: row.spark_metrica_id ? String(row.spark_metrica_id) : '',
  };
}

export function IndicadoresPainelPage() {
  const { user } = useAuth();
  const canEdit = useMemo(() => canEditIndicadoresPainel(user?.perfil), [user?.perfil]);
  const [rows, setRows] = useState<PainelWidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<PainelWidgetConfig | null>(null);
  const [dialogValues, setDialogValues] = useState<Record<string, string>>(rowToValues(null));
  const [metricQuery, setMetricQuery] = useState('');
  const [metricOptions, setMetricOptions] = useState<PainelMetricaCatalogo[]>([]);
  const [metricBusy, setMetricBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetRow, setTargetRow] = useState<PainelWidgetConfig | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const { toast, showToast } = useToast();
  const debouncedMetricQuery = useDebounce(metricQuery, 300);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPainelWidgets({ perfil: 'APS', layout: 'A' });
      setRows([...data].sort((a, b) => a.ordem - b.ordem));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar widgets do painel');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!dialogOpen || !canEdit) return;
    let cancelled = false;

    async function loadMetricas() {
      setMetricBusy(true);
      try {
        const response = await fetchPainelMetricas({
          q: debouncedMetricQuery || undefined,
          limit: 20,
          page: 1,
        });
        if (!cancelled) {
          setMetricOptions(response.data);
        }
      } catch (_err) {
        if (!cancelled) {
          setMetricOptions([]);
        }
      } finally {
        if (!cancelled) {
          setMetricBusy(false);
        }
      }
    }

    void loadMetricas();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, canEdit, debouncedMetricQuery]);

  const selectOptions = useMemo<Record<string, SelectOption[]>>(
    () => ({
      tipo: [
        { value: 'card', label: 'Card' },
        { value: 'grafico_linha', label: 'Linha' },
        { value: 'grafico_ranking', label: 'Ranking' },
        { value: 'grafico_barra', label: 'Barra' },
      ],
      formato: [
        { value: 'numero', label: 'Número' },
        { value: 'percentual', label: 'Percentual' },
        { value: 'moeda', label: 'Moeda' },
        { value: 'texto', label: 'Texto' },
        { value: 'fracao', label: 'Fração' },
      ],
      metrica_id: metricOptions.map((metric) => ({
        value: String(metric?.id ?? ''),
        label: metric?.label ?? '',
      })),
      spark_metrica_id: [
        { value: '', label: 'Sem sparkline' },
        ...metricOptions.map((metric) => ({
          value: String(metric?.id ?? ''),
          label: metric?.label ?? '',
        })),
      ],
    }),
    [metricOptions]
  );

  const selectedMetric = useMemo(() => {
    if (!dialogValues.metrica_id) return null;
    return (
      metricOptions.find((metric) => String(metric?.id) === dialogValues.metrica_id) ??
      rows.find((row) => String(row.metrica?.id) === dialogValues.metrica_id)?.metrica ??
      null
    );
  }, [dialogValues.metrica_id, metricOptions, rows]);
  const formInitialValues = useMemo(() => rowToValues(editingRow), [editingRow]);

  function openCreate() {
    setEditingRow(null);
    setDialogValues(rowToValues(null));
    setMetricQuery('');
    setDialogOpen(true);
  }

  function openEdit(row: PainelWidgetConfig) {
    setEditingRow(row);
    setDialogValues(rowToValues(row));
    setMetricQuery('');
    setDialogOpen(true);
  }

  function openInactivate(row: PainelWidgetConfig) {
    setTargetRow(row);
    setConfirmOpen(true);
  }

  async function handleSave(values: Record<string, string>) {
    const payload: Partial<PainelWidgetConfig> = {
      slug: values.slug.trim(),
      titulo: values.titulo.trim(),
      subtitulo: values.subtitulo.trim() || null,
      tipo: values.tipo as PainelWidgetConfig['tipo'],
      formato: values.formato as PainelWidgetConfig['formato'],
      metrica_id: values.metrica_id ? Number(values.metrica_id) : null,
      spark_metrica_id: values.spark_metrica_id ? Number(values.spark_metrica_id) : null,
      perfil: 'APS',
      layout: 'A',
    };

    if (!editingRow) {
      payload.ordem = rows.length + 1;
      await createPainelWidget(payload);
      showToast('Widget criado com sucesso');
    } else {
      await updatePainelWidget(editingRow.id, payload);
      showToast('Widget atualizado com sucesso');
    }

    await carregar();
  }

  async function handleInactivateConfirm() {
    if (!targetRow) return;
    setConfirmBusy(true);
    try {
      await inactivatePainelWidget(targetRow.id);
      setConfirmOpen(false);
      setTargetRow(null);
      showToast('Widget inativado com sucesso');
      await carregar();
    } finally {
      setConfirmBusy(false);
    }
  }

  const submitDisabled = !dialogValues.titulo?.trim();

  return (
    <section className="cadastro-page simpa-rise" data-testid="indicadores-painel-page">
      <div className="cadastro-crud-head">
        <div>
          <Link to="/cadastros" className="cadastro-back-link">
            ← Cadastros
          </Link>
          <h2 className="analytics-title">Indicadores do Painel</h2>
          <p className="analytics-subtitle">
            Cadastro dos widgets do Painel APS. Diferente de <code>/indicadores</code>, esta tela
            configura cards e gráficos exibidos no Painel gerencial.
          </p>
        </div>
        {canEdit ? (
          <button type="button" className="cadastro-btn primary" onClick={openCreate}>
            Novo widget
          </button>
        ) : null}
      </div>

      <section className="card cadastro-crud-card">
        <div className="cadastro-crud-card-head">
          <h3>Widgets APS · Layout A</h3>
          <span className="mono cadastro-count">{rows.length}</span>
        </div>

        {loading ? (
          <div className="analytics-state">Carregando widgets…</div>
        ) : error ? (
          <div className="analytics-state analytics-state-error">{error}</div>
        ) : rows.length === 0 ? (
          <p className="analytics-empty">Nenhum widget encontrado para APS/Layout A.</p>
        ) : (
          <div className="cadastro-table-wrap">
            <table className="cadastro-table" data-testid="indicadores-painel-table">
              <thead>
                <tr>
                  <th>Ordem</th>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Métrica</th>
                  <th>Status</th>
                  {canEdit ? <th aria-label="Ações" /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.ordem}</td>
                    <td>{row.titulo}</td>
                    <td>
                      <span className="cadastro-chip">{formatTipo(row.tipo)}</span>
                    </td>
                    <td>{row.metrica?.label ?? '—'}</td>
                    <td>{row.status}</td>
                    {canEdit ? (
                      <td>
                        <div className="cadastro-row-actions">
                          <button
                            type="button"
                            className="cadastro-action-btn"
                            onClick={() => openEdit(row)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="cadastro-action-btn"
                            onClick={() => openInactivate(row)}
                          >
                            Inativar
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canEdit ? (
        <FormDialog
          open={dialogOpen}
          title={editingRow ? 'Editar widget do painel' : 'Novo widget do painel'}
          fields={WIDGET_FIELDS}
          initialValues={formInitialValues}
          selectOptions={selectOptions}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleSave}
          onValuesChange={setDialogValues}
          submitDisabled={submitDisabled}
          extraContent={
            <div className="cadastro-field" data-testid="metric-picker">
              <span>Buscar métrica no catálogo</span>
              <input
                type="search"
                value={metricQuery}
                onChange={(event) => setMetricQuery(event.target.value)}
                placeholder="Digite parte do nome da métrica..."
                data-testid="metric-search-input"
              />
              {metricBusy ? <span className="cadastro-field-hint">Buscando métricas...</span> : null}
              {selectedMetric ? (
                <p className="cadastro-field-hint" data-testid="selected-metric-summary">
                  {selectedMetric.label} · {selectedMetric.fonte_tipo} · {selectedMetric.chave}
                </p>
              ) : null}
            </div>
          }
        />
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Inativar widget"
        message="O widget será removido da visualização ativa do Painel. Deseja continuar?"
        confirmLabel="Inativar"
        onCancel={() => {
          setConfirmOpen(false);
          setTargetRow(null);
        }}
        onConfirm={() => void handleInactivateConfirm()}
        busy={confirmBusy}
      />
      <ToastBanner message={toast.message} visible={toast.visible} />
    </section>
  );
}
