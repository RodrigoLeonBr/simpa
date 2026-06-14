import { FilterBar }     from '../../components/layout/FilterBar';
import { useDashboard }  from '../../hooks/useDashboard';
import { TabAPS }        from './TabAPS';
import { TabMAC }        from './TabMAC';
import { TabHospitalar } from './TabHospitalar';
import { useState }      from 'react';

type AbaAtiva = 'aps' | 'mac' | 'hospitalar';

export default function PainelPage() {
  const { data, loading, error } = useDashboard();
  const [aba, setAba]            = useState<AbaAtiva>('aps');

  const abas: { key: AbaAtiva; label: string; badge?: string }[] = [
    { key: 'aps',         label: 'Atenção Primária' },
    { key: 'mac',         label: 'MAC / SIA' },
    { key: 'hospitalar',  label: 'Hospitalar', badge: 'Pendente' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FilterBar titulo="PAINEL" />

      {/* Tabs */}
      <div className="bg-dark-800 border-b border-dark-600 px-4 flex gap-0 shrink-0">
        {abas.map(a => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              aba === a.key
                ? 'text-sky-400 border-brand-blue'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            {a.label}
            {a.badge && (
              <span className="bg-dark-700 text-amber-400 text-[9px] px-1.5 py-0.5 rounded-full">
                {a.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <p className="text-slate-500 text-sm">Carregando dados...</p>
          </div>
        )}
        {error && (
          <div className="bg-red-950/40 border border-red-900 rounded-lg p-4 text-red-400 text-sm">
            Erro ao carregar dados: {error}
          </div>
        )}
        {data && !loading && (
          <>
            {aba === 'aps' && (
              <TabAPS
                kpis={data.kpis_gerais}
                aps={data.modulos.atencao_primaria_esus}
              />
            )}
            {aba === 'mac' && <TabMAC sia={data.modulos.ambulatorial_sia} />}
            {aba === 'hospitalar' && <TabHospitalar sihd={data.modulos.hospitalar_sihd} />}
          </>
        )}
      </div>
    </div>
  );
}
