import { FilterBar } from '../../components/layout/FilterBar';
import { ExportProcedimentosButton } from '../Painel/ExportProcedimentosButton';

export default function RelatoriosPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FilterBar titulo="RELATÓRIOS" />
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <div className="bg-dark-700 rounded-xl p-4 border border-dark-600 max-w-xl">
          <p className="text-xs text-slate-400 font-semibold uppercase mb-1">
            Procedimentos e-SUS → SIGTAP
          </p>
          <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
            Baixa a produção mapeada da competência/unidade/equipe ativas no filtro
            (mesma fonte do Painel e da API de export).
          </p>
          <ExportProcedimentosButton />
        </div>
      </div>
    </div>
  );
}
