import { FilterBar } from '../../components/layout/FilterBar';
export default function IndicadoresPage() {
  return (
    <div className="flex flex-col h-full">
      <FilterBar titulo="INDICADORES" />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Catálogo de Indicadores — em desenvolvimento</p>
      </div>
    </div>
  );
}
