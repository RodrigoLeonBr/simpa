import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createPainelWidget,
  discoverPainelMetricas,
  fetchPainelMetricas,
  inactivatePainelWidget,
  updatePainelWidget,
} from '../../api/painelWidgets';
import { ConfirmDialog } from '../../components/cadastros/ConfirmDialog';
import { FormDialog } from '../../components/cadastros/FormDialog';
import { IndicadoresPainelWidgetTable } from '../../components/cadastros/IndicadoresPainelWidgetTable';
import {
  PainelMetricPicker,
  resolveSelectedMetric,
} from '../../components/cadastros/PainelMetricPicker';
import { WidgetPreviewModal } from '../../components/cadastros/WidgetPreviewModal';
import { ToastBanner } from '../../components/shared/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { useEntityCrud } from '../../hooks/useEntityCrud';
import type { PainelMetricaCatalogo, PainelWidgetConfig } from '../../types/painelWidgets';
import {
  canEditIndicadoresPainel,
  fetchPainelWidgetsApsLayoutA,
  mapWidgetForTable,
  mapWidgetFormPayload,
  WIDGET_CRUD_MESSAGES,
  WIDGET_FIELDS,
  WIDGET_FORMATO_SELECT_OPTIONS,
  WIDGET_TIPO_SELECT_OPTIONS,
  widgetRowToFormValues,
} from '../../utils/indicadoresPainelView';

async function submitPainelWidget(
  values: Record<string, string>,
  editing: PainelWidgetConfig | null,
  rowCount: number,
) {
  const payload = mapWidgetFormPayload(values);
  if (!editing) {
    await createPainelWidget({ ...payload, ordem: rowCount + 1 });
  } else {
    await updatePainelWidget(editing.id, payload);
  }
}

export function IndicadoresPainelPage() {
  const { user } = useAuth();
  const canEdit = useMemo(() => canEditIndicadoresPainel(user?.perfil), [user?.perfil]);
  const rowCountRef = useRef(0);

  const [dialogValues, setDialogValues] = useState<Record<string, string>>(
    widgetRowToFormValues(null),
  );
  const [metricQuery, setMetricQuery] = useState('');
  const [metricOptions, setMetricOptions] = useState<PainelMetricaCatalogo[]>([]);
  const [metricBusy, setMetricBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<PainelWidgetConfig | null>(null);
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [metricCatalogVersion, setMetricCatalogVersion] = useState(0);
  const debouncedMetricQuery = useDebounce(metricQuery, 300);

  const handleWidgetSubmit = useCallback(
    (values: Record<string, string>, editing: PainelWidgetConfig | null) =>
      submitPainelWidget(values, editing, rowCountRef.current),
    [],
  );

  const {
    rows,
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
    showToast,
    toast,
  } = useEntityCrud<PainelWidgetConfig>({
    fetchList: fetchPainelWidgetsApsLayoutA,
    mapRowForTable: mapWidgetForTable,
    errorMessage: 'Falha ao carregar widgets do painel',
    inactivateItem: inactivatePainelWidget,
    onSubmit: handleWidgetSubmit,
    messages: WIDGET_CRUD_MESSAGES,
  });

  rowCountRef.current = rows.length;

  useEffect(() => {
    if (!formOpen || !canEdit) return;
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
      } catch (err) {
        if (!cancelled) {
          setMetricOptions([]);
          showToast(err instanceof Error ? err.message : 'Falha ao carregar métricas');
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
  }, [formOpen, canEdit, debouncedMetricQuery, metricCatalogVersion]);

  const selectOptions = useMemo(
    () => ({
      tipo: WIDGET_TIPO_SELECT_OPTIONS,
      formato: WIDGET_FORMATO_SELECT_OPTIONS,
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
    [metricOptions],
  );

  const selectedMetric = useMemo(
    () => resolveSelectedMetric(dialogValues.metrica_id, metricOptions, rows),
    [dialogValues.metrica_id, metricOptions, rows],
  );
  const formInitialValues = useMemo(() => widgetRowToFormValues(editingRow), [editingRow]);
  const submitDisabled = !dialogValues.titulo?.trim();

  function handleOpenCreate() {
    setMetricQuery('');
    setDialogValues(widgetRowToFormValues(null));
    openCreate();
  }

  function handleOpenEdit(row: PainelWidgetConfig) {
    setMetricQuery('');
    setDialogValues(widgetRowToFormValues(row));
    openEdit(row);
  }

  function handleOpenPreview(row: PainelWidgetConfig) {
    setPreviewRow(row);
    setPreviewOpen(true);
  }

  async function handleDiscoverCatalog() {
    setDiscoveryBusy(true);
    try {
      const result = await discoverPainelMetricas();
      showToast(`Catálogo atualizado — ${result.inserted} inseridas, ${result.updated} atualizadas`);
      setMetricCatalogVersion((version) => version + 1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao atualizar catálogo');
    } finally {
      setDiscoveryBusy(false);
    }
  }

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
          <div className="cadastro-head-actions">
            <button
              type="button"
              className="cadastro-btn ghost"
              disabled={discoveryBusy}
              data-testid="discover-catalog-button"
              onClick={() => void handleDiscoverCatalog()}
            >
              {discoveryBusy ? 'Atualizando catálogo…' : 'Atualizar catálogo'}
            </button>
            <button type="button" className="cadastro-btn primary" onClick={handleOpenCreate}>
              Novo widget
            </button>
          </div>
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
          <IndicadoresPainelWidgetTable
            rows={rows}
            canEdit={canEdit}
            onEdit={handleOpenEdit}
            onPreview={handleOpenPreview}
            onInactivate={openConfirm}
          />
        )}
      </section>

      {canEdit ? (
        <FormDialog
          open={formOpen}
          title={editingRow ? 'Editar widget do painel' : 'Novo widget do painel'}
          fields={WIDGET_FIELDS}
          initialValues={formInitialValues}
          selectOptions={selectOptions}
          onClose={closeForm}
          onSubmit={handleSubmit}
          onValuesChange={setDialogValues}
          submitDisabled={submitDisabled}
          extraContent={
            <PainelMetricPicker
              metricQuery={metricQuery}
              metricBusy={metricBusy}
              selectedMetric={selectedMetric}
              onQueryChange={setMetricQuery}
            />
          }
        />
      ) : null}

      {canEdit ? (
        <WidgetPreviewModal
          open={previewOpen}
          widget={previewRow}
          onClose={() => {
            setPreviewOpen(false);
            setPreviewRow(null);
          }}
          onError={showToast}
        />
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Inativar widget"
        message="O widget será removido da visualização ativa do Painel. Deseja continuar?"
        confirmLabel="Inativar"
        onCancel={closeConfirm}
        onConfirm={() => void handleConfirm()}
        busy={busyId !== null}
      />
      <ToastBanner message={toast.message} visible={toast.visible} />
    </section>
  );
}
