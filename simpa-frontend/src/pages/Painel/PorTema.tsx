import { useState } from 'react';
import type { ModuloAPS, KpisGerais } from '../../types/contrato';
import { TendenciaChart } from '../../components/charts/TendenciaChart';

const TEMAS_CONFIG = [
  { key: 'gestante',         emoji: '🤰', label: 'Gestante',         cor: '#2563eb' },
  { key: 'primeira_infancia', emoji: '👶', label: 'Primeira Infância', cor: '#3b82f6' },
  { key: 'idoso',            emoji: '🧓', label: 'Idoso',            cor: '#a855f7' },
  { key: 'outros',           emoji: '👥', label: 'Outros',           cor: '#10b981' },
];

interface Props {
  kpis: KpisGerais;
  aps: ModuloAPS;
}

export function PorTema({ kpis, aps }: Props) {
  const [temaSelecionado, setTemaSelecionado] = useState<string | null>('gestante');

  // Distribuição aproximada por tema (em produção virá do backend)
  const totalAtend = kpis.total_atendimentos_aps;
  const estimativas: Record<string, number> = {
    gestante:          Math.round(totalAtend * 0.12),
    primeira_infancia: Math.round(totalAtend * 0.26),
    idoso:             Math.round(totalAtend * 0.37),
    outros:            Math.round(totalAtend * 0.25),
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Cards de tema */}
      <div className="flex gap-2.5 shrink-0">
        {TEMAS_CONFIG.map(t => {
          const ativo = temaSelecionado === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTemaSelecionado(ativo ? null : t.key)}
              className={`flex-1 rounded-lg p-3 text-left relative transition-all ${
                ativo
                  ? 'bg-blue-900/40 border-2 border-brand-blue'
                  : 'bg-dark-700 border border-dark-600 hover:border-dark-500'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-base">{t.emoji}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t.label}</span>
                {ativo && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />}
              </div>
              <p className="text-lg font-bold text-slate-100">
                {estimativas[t.key].toLocaleString('pt-BR')}
                <span className="text-[10px] text-slate-500 font-normal ml-1">atend.</span>
              </p>
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-lg"
                style={{ background: t.cor, opacity: 0.7 }}
              />
            </button>
          );
        })}
      </div>

      {/* Detalhe do tema selecionado */}
      {temaSelecionado && (
        <div className="bg-blue-950/40 border border-blue-900 rounded-lg p-3 shrink-0">
          <p className="text-sky-300 text-[10px] font-semibold mb-2">
            {TEMAS_CONFIG.find(t => t.key === temaSelecionado)?.emoji}{' '}
            DETALHES — {TEMAS_CONFIG.find(t => t.key === temaSelecionado)?.label.toUpperCase()}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Atendimentos', value: estimativas[temaSelecionado], cor: '#10b981' },
              { label: 'vs. mês anterior', value: null, cor: null },
              { label: 'Indicador específico', value: null, cor: null },
            ].map(item => (
              <div key={item.label} className="bg-dark-700 rounded p-2">
                <p className="text-[9px] text-slate-500 mb-0.5">{item.label}</p>
                {item.value != null
                  ? <p className="text-sm font-bold text-slate-100">{item.value.toLocaleString('pt-BR')}</p>
                  : <p className="text-sm font-bold text-amber-500">—</p>
                }
                {item.cor && (
                  <p className="text-[9px] mt-0.5" style={{ color: item.cor }}>apurado</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tendência do tema */}
      <div className="bg-dark-700 rounded-lg p-3 flex-1 flex flex-col min-h-0">
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">
          Tendência — {TEMAS_CONFIG.find(t => t.key === temaSelecionado)?.label || 'Geral'}
        </p>
        <div className="flex-1">
          <TendenciaChart dados={aps.historico_mensal} altura={130} />
        </div>
      </div>
    </div>
  );
}
