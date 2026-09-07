import type { CoberturaRow } from '../../types/vacina';

// ponytail: CSS class names embed the color word so test regexes (/red/, /amber|yellow/, /green/, /gray|slate/) match;
// actual colors come from CSS vars (--red, --amber, --green) consistent with project tokens.
export function coberturaColor(pct: number | null): string {
  if (pct == null) return 'cobertura-cell-gray';
  if (pct < 50)    return 'cobertura-cell-red';
  if (pct < 80)    return 'cobertura-cell-amber';
  return 'cobertura-cell-green';
}

export function CoberturaMatrix({ rows }: { rows: CoberturaRow[] }) {
  const grupos = [...new Map(rows.map((r) => [r.grupo_id, r.grupo_nome])).entries()];
  const vacinas = [...new Map(rows.map((r) => [r.imuno_codigo, r.imuno_nome])).entries()];
  const cell = (imuno: string, grupo: number) =>
    rows.find((r) => r.imuno_codigo === imuno && r.grupo_id === grupo) ?? null;

  return (
    <table className="cobertura-matrix">
      <thead>
        <tr>
          <th className="cobertura-matrix-th cobertura-matrix-th-label">Vacina</th>
          {grupos.map(([id, nome]) => (
            <th key={id} className="cobertura-matrix-th">{nome}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {vacinas.map(([cod, nome]) => (
          <tr key={cod} className="cobertura-matrix-row">
            <td className="cobertura-matrix-name">{nome}</td>
            {grupos.map(([gid]) => {
              const c = cell(cod, gid);
              const pct = c?.cobertura_pct ?? null;
              return (
                <td
                  key={gid}
                  className={`cobertura-matrix-cell ${coberturaColor(pct)}`}
                  title={c ? `${c.doses} / ${c.denominador} doses` : ''}
                >
                  {pct == null ? '—' : `${Math.round(pct)}%`}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
