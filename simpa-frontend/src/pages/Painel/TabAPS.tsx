import { useState } from 'react';
import { Settings } from 'lucide-react';
import type { KpisGerais, ModuloAPS } from '../../types/contrato';
import { IndicadoresGerais } from './IndicadoresGerais';
import { PorTema }           from './PorTema';

type ViewMode = 'indicadores' | 'temas';

interface Props {
  kpis: KpisGerais;
  aps: ModuloAPS;
}

export function TabAPS({ kpis, aps }: Props) {
  const [modo, setModo] = useState<ViewMode>('indicadores');

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Toggle */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex bg-dark-900 border border-dark-600 rounded-lg overflow-hidden">
          {(['indicadores', 'temas'] as ViewMode[]).map(m => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`px-3.5 py-1.5 text-xs font-semibold border-l border-dark-600 first:border-l-0 transition-colors ${
                modo === m
                  ? 'bg-blue-900/50 text-sky-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {m === 'indicadores' ? 'Indicadores Gerais' : 'Por Tema'}
            </button>
          ))}
        </div>
        <button className="bg-dark-700 border border-dark-600 rounded p-1.5 text-slate-500 hover:text-slate-300">
          <Settings size={12} />
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-h-0">
        {modo === 'indicadores'
          ? <IndicadoresGerais kpis={kpis} aps={aps} />
          : <PorTema kpis={kpis} aps={aps} />
        }
      </div>
    </div>
  );
}
