import type { KpisGerais, ModuloAPS } from '../../types/contrato';
import { TendenciaChart } from '../../components/charts/TendenciaChart';
import { RoscaChart }     from '../../components/charts/RoscaChart';
import { PiramideChart }  from '../../components/charts/PiramideChart';
import { TemasChart }     from '../../components/charts/TemasChart';

interface KpiCardProps {
  label: string;
  value: number | null;
  sub: string;
  borderColor: string;
}

function KpiCard({ label, value, sub, borderColor }: KpiCardProps) {
  return (
    <div className={`flex-1 bg-dark-700 rounded-lg p-3 border-t-[3px]`} style={{ borderColor }}>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-100 leading-none">
        {value != null ? value.toLocaleString('pt-BR') : <span className="text-amber-500 text-sm">—</span>}
      </p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

interface Props {
  kpis: KpisGerais;
  aps: ModuloAPS;
}

export function IndicadoresGerais({ kpis, aps }: Props) {
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* KPI row */}
      <div className="flex gap-2.5 shrink-0">
        <KpiCard label="Atendimentos APS"      value={kpis.total_atendimentos_aps}          sub="individuais clínicos" borderColor="#2563eb" />
        <KpiCard label="Procedimentos"          value={kpis.total_procedimentos_ambulatoriais} sub="ambulatoriais"        borderColor="#10b981" />
        <KpiCard label="Participantes Coletivos" value={kpis.total_participantes_coletivos}  sub="ações coletivas"      borderColor="#f59e0b" />
        <KpiCard label="Odontológico"           value={kpis.atendimentos_odonto}             sub="atendimentos"         borderColor="#a855f7" />
      </div>

      {/* Grid 2x2 */}
      <div className="grid grid-cols-2 grid-rows-2 gap-2.5 flex-1 min-h-0">
        <div className="bg-dark-700 rounded-lg p-3 flex flex-col">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Tendência Mensal</p>
          <div className="flex-1">
            <TendenciaChart dados={aps.historico_mensal} altura={140} />
          </div>
        </div>

        <div className="bg-dark-700 rounded-lg p-3 flex flex-col">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Distribuição por Turno</p>
          <div className="flex-1 flex items-center gap-4">
            <RoscaChart dados={aps.distribuicao_turnos} altura={120} />
            <div className="flex flex-col gap-2">
              {aps.distribuicao_turnos.map((t, i) => (
                <div key={t.turno}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-2 h-2 rounded-sm" style={{ background: ['#2563eb','#10b981','#f59e0b'][i] }} />
                    <span className="text-[10px] text-slate-400">{t.turno}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-100 ml-3.5">
                    {t.atendimentos.toLocaleString('pt-BR')} <span className="text-[10px] text-slate-500 font-normal">atend.</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-dark-700 rounded-lg p-3 flex flex-col">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Pirâmide Etária</p>
          <div className="flex-1">
            <PiramideChart dados={aps.distribuicao_faixa_etaria} altura={140} />
          </div>
        </div>

        <div className="bg-dark-700 rounded-lg p-3 flex flex-col">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Temas — Ações Coletivas</p>
          <div className="flex-1">
            <TemasChart dados={aps.temas_coletivos} altura={140} />
          </div>
        </div>
      </div>
    </div>
  );
}
