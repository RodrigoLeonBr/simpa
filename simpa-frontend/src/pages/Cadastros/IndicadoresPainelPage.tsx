import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createPainelWidget,
  discoverPainelMetricas,
  inactivatePainelWidget,
  reorderPainelWidgets,
  updatePainelWidget,
} from '../../api/painelWidgets';
import { ConfirmDialog } from '../../components/cadastros/ConfirmDialog';
import { IndicadoresPainelWidgetTable } from '../../components/cadastros/IndicadoresPainelWidgetTable';
import {
  WidgetEditDrawer,
  type WidgetEditSubmitPayload,
} from '../../components/cadastros/WidgetEditDrawer';
import { WidgetPreviewModal } from '../../components/cadastros/WidgetPreviewModal';
import { ToastBanner } from '../../components/shared/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useEntityCrud } from '../../hooks/useEntityCrud';
import type { PainelWidgetConfig } from '../../types/painelWidgets';
import {
  canEditIndicadoresPainel,
  fetchPainelWidgetsByPerfilLayout,
  formatPainelWidgetLayoutLabel,
  type PainelWidgetLayout,
  type PainelWidgetPerfil,
  mapWidgetForTable,
  swapWidgetOrderIds,
  WIDGET_CRUD_MESSAGES,
  formatDiscoverCatalogToast,
  PAINEL_WIDGET_LAYOUTS,
  PAINEL_WIDGET_PERFIS,
} from '../../utils/indicadoresPainelView';

async function submitPainelWidget(
  payload: WidgetEditSubmitPayload,
  editing: PainelWidgetConfig | null,
  rowCount: number,
  perfil: PainelWidgetPerfil,
  layout: PainelWidgetLayout,
) {
  const body = { ...payload, perfil, layout };
  if (!editing) {
    await createPainelWidget({ ...body, ordem: rowCount + 1 });
  } else {
    await updatePainelWidget(editing.id, body);
  }
}

export function IndicadoresPainelPage() {
  const { user } = useAuth();
  const canEdit = useMemo(() => canEditIndicadoresPainel(user?.perfil), [user?.perfil]);
  const rowCountRef = useRef(0);
  const [widgetPerfil, setWidgetPerfil] = useState<PainelWidgetPerfil>('APS');
  const [widgetLayout, setWidgetLayout] = useState<PainelWidgetLayout>('A');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<PainelWidgetConfig | null>(null);
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);

  const fetchWidgets = useCallback(
    () => fetchPainelWidgetsByPerfilLayout(widgetPerfil, widgetLayout),
    [widgetPerfil, widgetLayout],
  );

  const handleWidgetSubmit = useCallback(
    async (payload: WidgetEditSubmitPayload, editing: PainelWidgetConfig | null) => {
      await submitPainelWidget(payload, editing, rowCountRef.current, widgetPerfil, widgetLayout);
    },
    [widgetPerfil, widgetLayout],
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
    carregar,
    showToast,
    toast,
  } = useEntityCrud<PainelWidgetConfig>({
    fetchList: fetchWidgets,
    mapRowForTable: mapWidgetForTable,
    errorMessage: 'Falha ao carregar widgets do painel',
    inactivateItem: inactivatePainelWidget,
    onSubmit: async () => {
      /* submit via WidgetEditDrawer */
    },
    messages: WIDGET_CRUD_MESSAGES,
  });

  rowCountRef.current = rows.length;

  async function handleDrawerSubmit(
    payload: WidgetEditSubmitPayload,
    editing: PainelWidgetConfig | null,
  ) {
    await handleWidgetSubmit(payload, editing);
    await carregar();
    showToast(editing ? WIDGET_CRUD_MESSAGES.updated : WIDGET_CRUD_MESSAGES.created);
  }

  function handleOpenPreview(row: PainelWidgetConfig) {
    setPreviewRow(row);
    setPreviewOpen(true);
  }

  async function handleDiscoverCatalog() {
    setDiscoveryBusy(true);
    try {
      const result = await discoverPainelMetricas();
      showToast(formatDiscoverCatalogToast(result));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao atualizar catálogo');
    } finally {
      setDiscoveryBusy(false);
    }
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    if (reorderBusy || index < 0 || index >= rows.length) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rows.length) return;

    setReorderBusy(true);
    try {
      const orderedIds = swapWidgetOrderIds(rows, index, direction);
      await reorderPainelWidgets({
        perfil: widgetPerfil,
        layout: widgetLayout,
        orderedIds,
      });
      await carregar();
      showToast(WIDGET_CRUD_MESSAGES.reordered);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao reordenar widgets');
    } finally {
      setReorderBusy(false);
    }
  }

  async function handleReactivate(row: PainelWidgetConfig) {
    try {
      await updatePainelWidget(row.id, { status: 'ativo' });
      await carregar();
      showToast(WIDGET_CRUD_MESSAGES.reactivated);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao reativar widget');
    }
  }

  const activeCount = rows.filter((row) => row.status === 'ativo').length;
  const inactiveCount = rows.length - activeCount;

  return (
    <section className="cadastro-page simpa-rise" data-testid="indicadores-painel-page">
      <div className="cadastro-crud-head">
        <div>
          <Link to="/cadastros" className="cadastro-back-link">
            ← Cadastros
          </Link>
          <h2 className="analytics-title">Indicadores do Painel</h2>
          <p className="analytics-subtitle">
            Cadastro dos widgets do Painel por perfil (APS, MAC, Hospitalar) e layout (A, B, C).
            Edite SQL customizado por widget (principal e sparkline) com teste por competência e
            estabelecimento.
          </p>
        </div>
        <div className="cadastro-head-actions">
          <label className="cadastro-inline-field">
            <span>Perfil</span>
            <select
              value={widgetPerfil}
              onChange={(event) => setWidgetPerfil(event.target.value as PainelWidgetPerfil)}
              data-testid="indicadores-painel-perfil-select"
            >
              {PAINEL_WIDGET_PERFIS.map((perfil) => (
                <option key={perfil} value={perfil}>
                  {perfil}
                </option>
              ))}
            </select>
          </label>
          <label className="cadastro-inline-field">
            <span>Layout</span>
            <select
              value={widgetLayout}
              onChange={(event) => setWidgetLayout(event.target.value as PainelWidgetLayout)}
              data-testid="indicadores-painel-layout-select"
            >
              {PAINEL_WIDGET_LAYOUTS.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.label}
                </option>
              ))}
            </select>
          </label>
          {canEdit ? (
            <>
              <button
                type="button"
                className="cadastro-btn ghost"
                disabled={discoveryBusy}
                data-testid="discover-catalog-button"
                onClick={() => void handleDiscoverCatalog()}
              >
                {discoveryBusy ? 'Atualizando catálogo…' : 'Atualizar catálogo'}
              </button>
              <button type="button" className="cadastro-btn primary" onClick={openCreate}>
                Novo widget
              </button>
            </>
          ) : null}
        </div>
      </div>

      <section className="card cadastro-crud-card">
        <div className="cadastro-crud-card-head">
          <h3>
            Widgets {widgetPerfil} · {formatPainelWidgetLayoutLabel(widgetLayout)}
          </h3>
          <span className="mono cadastro-count" data-testid="widget-count-summary">
            {activeCount} ativos · {inactiveCount} inativos
          </span>
        </div>

        {loading ? (
          <div className="analytics-state">Carregando widgets…</div>
        ) : error ? (
          <div className="analytics-state analytics-state-error">{error}</div>
        ) : rows.length === 0 ? (
          <p className="analytics-empty">
            Nenhum widget encontrado para {widgetPerfil}/{formatPainelWidgetLayoutLabel(widgetLayout)}.
          </p>
        ) : (
          <IndicadoresPainelWidgetTable
            rows={rows}
            canEdit={canEdit}
            reorderBusy={reorderBusy}
            onEdit={openEdit}
            onPreview={handleOpenPreview}
            onInactivate={openConfirm}
            onReactivate={(row) => void handleReactivate(row)}
            onMoveUp={(index) => void handleMove(index, 'up')}
            onMoveDown={(index) => void handleMove(index, 'down')}
          />
        )}
      </section>

      {canEdit ? (
        <WidgetEditDrawer
          open={formOpen}
          title={editingRow ? 'Editar widget do painel' : 'Novo widget do painel'}
          perfil={widgetPerfil}
          layout={widgetLayout}
          editingRow={editingRow}
          onClose={closeForm}
          onSubmit={handleDrawerSubmit}
          onError={showToast}
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
