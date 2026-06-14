import { FilterBar } from '../../components/layout/FilterBar';
export default function MetasPage() {
  return (
    <div className="flex flex-col h-full">
      <FilterBar titulo="METAS" />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Módulo de Metas — em desenvolvimento</p>
      </div>
    </div>
  );
}
