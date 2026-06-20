import type { CadastroColumnDef } from '../../config/cadastroEntities';
import { formatCadastroCell, formatCadastroStatus } from '../../utils/cadastroView';

interface ReadOnlyDataTableProps {
  columns: CadastroColumnDef[];
  rows: Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
}

function renderCell(key: string, row: Record<string, unknown>): string {
  if (key === 'status') {
    return formatCadastroStatus(String(row[key] ?? ''));
  }
  return formatCadastroCell(row[key]);
}

export function ReadOnlyDataTable({ columns, rows, onRowClick }: ReadOnlyDataTableProps) {
  return (
    <div className="cadastro-table-wrap">
      <table className="cadastro-table" data-testid="cadastro-readonly-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = Number(row.id);
            const clickable = Boolean(onRowClick);

            return (
              <tr
                key={id}
                className={clickable ? 'cadastro-row-clickable' : undefined}
                onClick={clickable ? () => onRowClick?.(row) : undefined}
                onKeyDown={
                  clickable
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick?.(row);
                        }
                      }
                    : undefined
                }
                tabIndex={clickable ? 0 : undefined}
                role={clickable ? 'button' : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={column.mono ? 'mono' : undefined}>
                    {renderCell(column.key, row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
