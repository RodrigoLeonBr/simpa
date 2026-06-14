import { useFilters } from '../../hooks/useFilters';

type PeriodoTipo = 'mes' | 'quadrimestre' | 'ano';

const PERIODOS: { value: PeriodoTipo; label: string }[] = [
  { value: 'mes',          label: 'Mês' },
  { value: 'quadrimestre', label: 'Quadrim.' },
  { value: 'ano',          label: 'Ano' },
];

// Opções estáticas por enquanto — virão da API em Task de integração
const UNIDADES = [
  { value: '', label: 'Todas as unidades' },
  { value: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO', label: 'CAFI' },
];

const EQUIPES: Record<string, { value: string; label: string }[]> = {
  'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO': [
    { value: '', label: 'Todas as equipes' },
    { value: 'EQUIPE 9 EAP', label: 'Equipe 9 EAP' },
  ],
};

interface FilterBarProps {
  titulo: string;
}

export function FilterBar({ titulo }: FilterBarProps) {
  const {
    competencia, setCompetencia,
    periodoTipo, setPeriodoTipo,
    unidade, setUnidade,
    equipe, setEquipe,
  } = useFilters();

  const equipeOpcoes = unidade ? (EQUIPES[unidade] || []) : [];
  const equipeDisabilitada = !unidade;

  const badge = [
    unidade || 'Município',
    equipe || 'Todas as equipes',
    competencia,
  ].join(' · ');

  return (
    <div className="bg-dark-800 border-b border-dark-600 px-4 py-2 flex items-center gap-3 flex-wrap">
      <span className="text-slate-400 text-xs font-semibold tracking-wide mr-1">{titulo}</span>

      {/* Segmented: Mês / Quadrim. / Ano */}
      <div className="flex bg-dark-900 border border-dark-600 rounded-md overflow-hidden">
        {PERIODOS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriodoTipo(p.value)}
            className={`px-2.5 py-1 text-xs border-l border-dark-600 first:border-l-0 transition-colors ${
              periodoTipo === p.value
                ? 'bg-brand-blue text-white font-semibold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Seletor de competência */}
      <input
        type="month"
        value={competencia}
        onChange={e => setCompetencia(e.target.value)}
        className="bg-dark-700 border border-dark-600 rounded text-slate-300 text-xs px-2 py-1"
      />

      <div className="w-px h-5 bg-dark-600 mx-1" />

      {/* Unidade */}
      <div className="flex flex-col gap-0.5">
        <span className="text-dark-500 text-[8px] uppercase tracking-wider">Unidade</span>
        <select
          value={unidade}
          onChange={e => setUnidade(e.target.value)}
          className="bg-dark-700 border border-dark-600 rounded text-slate-300 text-xs px-2 py-1 min-w-[120px]"
        >
          {UNIDADES.map(u => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
      </div>

      {/* Equipe — desabilitada se unidade = Todas */}
      <div className="flex flex-col gap-0.5">
        <span className="text-dark-500 text-[8px] uppercase tracking-wider">Equipe</span>
        <select
          value={equipe}
          onChange={e => setEquipe(e.target.value)}
          disabled={equipeDisabilitada}
          className="bg-dark-700 border border-dark-600 rounded text-slate-300 text-xs px-2 py-1 min-w-[120px] disabled:opacity-40"
        >
          {equipeDisabilitada
            ? <option value="">Selecione uma unidade</option>
            : equipeOpcoes.map(eq => (
                <option key={eq.value} value={eq.value}>{eq.label}</option>
              ))
          }
        </select>
      </div>

      <div className="flex-1" />

      {/* Badge contexto ativo */}
      <div className="bg-blue-900/40 border border-blue-800 rounded px-2 py-1 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
        <span className="text-sky-300 text-[9px]">{badge}</span>
      </div>
    </div>
  );
}
