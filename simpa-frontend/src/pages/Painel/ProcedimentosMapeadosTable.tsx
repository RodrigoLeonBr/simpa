import type { ProcedimentoMapeado } from '../../types/contrato';

export const EMPTY_MAPPED_MSG =
  'Nenhum procedimento mapeado para estes filtros. Labels sem de-para são omitidos (silent skip).';

interface Props {
  rows: ProcedimentoMapeado[] | undefined | null;
}

export function ProcedimentosMapeadosTable({ rows }: Props) {
  const list = rows ?? [];

  return (
    <div className="bg-dark-700 rounded-xl overflow-hidden border border-dark-600">
      <div className="px-3 py-2 border-b border-dark-600">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
          Procedimentos mapeados (e-SUS → SIGTAP)
        </p>
      </div>
      {list.length === 0 ? (
        <p className="px-3 py-6 text-center text-slate-500 text-xs" role="status">
          {EMPTY_MAPPED_MSG}
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dark-600">
              {['Seção', 'Descrição e-SUS', 'Código SIGTAP', 'Quantidade'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-slate-500 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={`${r.codigo_sigtap}-${i}`} className="border-b border-dark-600/40">
                <td className="px-3 py-2 text-slate-400 max-w-[160px] truncate" title={r.secao}>
                  {r.secao}
                </td>
                <td className="px-3 py-2 text-slate-300" title={r.descricao_esus}>
                  {r.descricao_esus}
                </td>
                <td className="px-3 py-2 text-slate-300 font-mono">{r.codigo_sigtap}</td>
                <td className="px-3 py-2 text-slate-300 tabular-nums">{r.quantidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
