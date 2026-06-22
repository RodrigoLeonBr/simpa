import type { PainelWidgetConfig } from '../../types/painelWidgets';
import { formatWidgetTipo } from '../../utils/indicadoresPainelView';

interface IndicadoresPainelWidgetTableProps {
  rows: PainelWidgetConfig[];
  canEdit: boolean;
  onEdit: (row: PainelWidgetConfig) => void;
  onPreview: (row: PainelWidgetConfig) => void;
  onInactivate: (row: PainelWidgetConfig) => void;
}

export function IndicadoresPainelWidgetTable({
  rows,
  canEdit,
  onEdit,
  onPreview,
  onInactivate,
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
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="mono">{row.ordem}</td>
              <td>{row.titulo}</td>
              <td>
                <span className="cadastro-chip">{formatWidgetTipo(row.tipo)}</span>
              </td>
              <td>{row.metrica?.label ?? '—'}</td>
              <td>{row.status}</td>
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
                    <button
                      type="button"
                      className="cadastro-action-btn"
                      onClick={() => onInactivate(row)}
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
  );
}
