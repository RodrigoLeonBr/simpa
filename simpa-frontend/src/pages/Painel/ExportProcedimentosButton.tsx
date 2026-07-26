import { useState } from 'react';
import { Download } from 'lucide-react';
import { useFilters } from '../../hooks/useFilters';
import {
  downloadProcedimentosExport,
  type ExportFormat,
} from '../../api/procedimentosExport';

/** Export CSV/JSON using active FilterBar context. */
export function ExportProcedimentosButton() {
  const { competencia, unidade, equipe } = useFilters();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const disabled = !competencia || !unidade || !equipe || busy;

  const run = async (format: ExportFormat) => {
    setMsg(null);
    setBusy(true);
    try {
      const result = await downloadProcedimentosExport({
        competencia,
        unidade,
        equipe,
        format,
      });
      if (!result.ok) {
        setMsg(result.error || 'Falha no export');
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha no export');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => run('csv')}
          title={
            disabled && (!unidade || !equipe)
              ? 'Selecione unidade e equipe no filtro'
              : 'Baixar CSV de procedimentos mapeados'
          }
          className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold rounded border border-dark-600 bg-dark-700 text-slate-300 hover:text-sky-300 disabled:opacity-40"
        >
          <Download size={11} />
          Export CSV
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => run('json')}
          title="Baixar JSON"
          className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold rounded border border-dark-600 bg-dark-700 text-slate-300 hover:text-sky-300 disabled:opacity-40"
        >
          <Download size={11} />
          JSON
        </button>
      </div>
      {msg && (
        <p role="alert" className="text-[10px] text-amber-400 max-w-[220px] text-right">
          {msg}
        </p>
      )}
    </div>
  );
}
