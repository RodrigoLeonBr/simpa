import type { CadastroColumnDef } from '../../config/cadastroEntities';
import { formatCadastroCell, formatCadastroStatus } from '../../utils/cadastroView';

interface DataTableProps {
  columns: CadastroColumnDef[];
  rows: Record<string, unknown>[];
  onEdit: (row: Record<string, unknown>) => void;
  onInactivate: (row: Record<string, unknown>) => void;
  onDelete?: (row: Record<string, unknown>) => void;
  busyId?: number | null;
  showDelete?: boolean;
  canEdit?: boolean;
}

function renderCell(key: string, row: Record<string, unknown>): string {
  if (key === 'status') {
    return formatCadastroStatus(String(row[key] ?? ''));
  }
  return formatCadastroCell(row[key]);
}

export function DataTable({
  columns,
  rows,
  onEdit,
  onInactivate,
  onDelete,
  busyId = null,
  showDelete = true,
  canEdit = true,
}: DataTableProps) {
  return (
    <div className="cadastro-table-wrap">
      <table className="cadastro-table" data-testid="cadastro-data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            {canEdit ? <th aria-label="Ações" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = Number(row.id);
            const disabled = busyId === id;

            return (
              <tr key={id}>
                {columns.map((column) => (
                  <td key={column.key} className={column.mono ? 'mono' : undefined}>
                    {renderCell(column.key, row)}
                  </td>
                ))}
                {canEdit ? (
                <td>
                  <div className="cadastro-row-actions">
                    <button
                      type="button"
                      className="cadastro-action-btn"
                      disabled={disabled}
                      onClick={() => onEdit(row)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="cadastro-action-btn"
                      disabled={disabled}
                      onClick={() => onInactivate(row)}
                    >
                      Inativar
                    </button>
                    {showDelete && onDelete ? (
                      <button
                        type="button"
                        className="cadastro-action-btn danger"
                        disabled={disabled}
                        onClick={() => onDelete(row)}
                      >
                        Excluir
                      </button>
                    ) : null}
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
