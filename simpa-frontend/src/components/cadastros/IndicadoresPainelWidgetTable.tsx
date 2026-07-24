import type { PainelWidgetConfig } from '../../types/painelWidgets';
import { formatWidgetTipo } from '../../utils/indicadoresPainelView';

interface IndicadoresPainelWidgetTableProps {
  rows: PainelWidgetConfig[];
  canEdit: boolean;
  reorderBusy?: boolean;
  onEdit: (row: PainelWidgetConfig) => void;
  onPreview: (row: PainelWidgetConfig) => void;
  onInactivate: (row: PainelWidgetConfig) => void;
  onReactivate: (row: PainelWidgetConfig) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

function formatWidgetStatus(status: string): string {
  return status === 'ativo' ? 'Ativo' : status === 'inativo' ? 'Inativo' : status;
}

export function IndicadoresPainelWidgetTable({
  rows,
  canEdit,
  reorderBusy = false,
  onEdit,
  onPreview,
  onInactivate,
  onReactivate,
  onMoveUp,
  onMoveDown,
}: IndicadoresPainelWidgetTableProps) {
  return (
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
          {rows.map((row, index) => {
            const isInactive = row.status === 'inativo';
            return (
              <tr
                key={row.id}
                className={isInactive ? 'cadastro-row-inactive' : undefined}
                data-testid={`widget-row-${row.id}`}
              >
                <td>
                  <div className="widget-order-cell">
                    <span className="mono">{row.ordem}</span>
                    {canEdit ? (
                      <div className="widget-order-actions">
                        <button
                          type="button"
                          className="cadastro-action-btn widget-order-btn"
                          disabled={reorderBusy || index === 0}
                          aria-label={`Subir ${row.titulo}`}
                          data-testid={`widget-move-up-${row.id}`}
                          onClick={() => onMoveUp(index)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="cadastro-action-btn widget-order-btn"
                          disabled={reorderBusy || index === rows.length - 1}
                          aria-label={`Descer ${row.titulo}`}
                          data-testid={`widget-move-down-${row.id}`}
                          onClick={() => onMoveDown(index)}
                        >
                          ↓
                        </button>
                      </div>
                    ) : null}
                  </div>
                </td>
                <td>{row.titulo}</td>
                <td>
                  <span className="cadastro-chip">{formatWidgetTipo(row.tipo)}</span>
                </td>
                <td>{row.metrica?.label ?? '—'}</td>
                <td>
                  <span
                    className={`cadastro-chip${row.status === 'ativo' ? ' active' : ''}`}
                    data-testid={`widget-status-${row.id}`}
                  >
                    {formatWidgetStatus(row.status)}
                  </span>
                </td>
                {canEdit ? (
                  <td>
                    <div className="cadastro-row-actions">
                      <button type="button" className="cadastro-action-btn" onClick={() => onEdit(row)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="cadastro-action-btn"
                        onClick={() => onPreview(row)}
                      >
                        Pré-visualizar
                      </button>
                      {row.status === 'ativo' ? (
                        <button
                          type="button"
                          className="cadastro-action-btn danger"
                          onClick={() => onInactivate(row)}
                        >
                          Inativar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="cadastro-action-btn"
                          data-testid={`widget-reactivate-${row.id}`}
                          onClick={() => onReactivate(row)}
                        >
                          Reativar
                        </button>
                      )}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
