import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createPainelWidget,
  discoverPainelMetricas,
  inactivatePainelWidget,
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
  fetchPainelWidgetsByPerfilLayoutA,
  type PainelWidgetPerfil,
  mapWidgetForTable,
  WIDGET_CRUD_MESSAGES,
  PAINEL_WIDGET_PERFIS,
} from '../../utils/indicadoresPainelView';

async function submitPainelWidget(
  payload: WidgetEditSubmitPayload,
  editing: PainelWidgetConfig | null,
  rowCount: number,
  perfil: PainelWidgetPerfil,
) {
  const body = { ...payload, perfil, layout: 'A' as const };
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<PainelWidgetConfig | null>(null);
  const [discoveryBusy, setDiscoveryBusy] = useState(false);

  const fetchWidgets = useCallback(
    () => fetchPainelWidgetsByPerfilLayoutA(widgetPerfil),
    [widgetPerfil],
  );

  const handleWidgetSubmit = useCallback(
    async (payload: WidgetEditSubmitPayload, editing: PainelWidgetConfig | null) => {
      await submitPainelWidget(payload, editing, rowCountRef.current, widgetPerfil);
    },
    [widgetPerfil],
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
      showToast(`Catálogo atualizado — ${result.inserted} inseridas, ${result.updated} atualizadas`);
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
            Cadastro dos widgets do Painel por perfil (APS, MAC, Hospitalar). Edite SQL customizado
            por widget (principal e sparkline) com teste por competência e estabelecimento.
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
          <h3>Widgets {widgetPerfil} · Layout A</h3>
          <span className="mono cadastro-count">{rows.length}</span>
        </div>

        {loading ? (
          <div className="analytics-state">Carregando widgets…</div>
        ) : error ? (
          <div className="analytics-state analytics-state-error">{error}</div>
        ) : rows.length === 0 ? (
          <p className="analytics-empty">Nenhum widget encontrado para {widgetPerfil}/Layout A.</p>
        ) : (
          <IndicadoresPainelWidgetTable
            rows={rows}
            canEdit={canEdit}
            onEdit={openEdit}
            onPreview={handleOpenPreview}
            onInactivate={openConfirm}
          />
        )}
      </section>

      {canEdit ? (
        <WidgetEditDrawer
          open={formOpen}
          title={editingRow ? 'Editar widget do painel' : 'Novo widget do painel'}
          perfil={widgetPerfil}
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
