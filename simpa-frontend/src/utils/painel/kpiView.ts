import type { ContratoDashboard, HistoricoMensal } from '../../types/contrato';
import { computeDelta, EM_DASH, formatKpi, isNullKpi } from '../kpi';
import { countMetasAtingidas, countMetasTotal, historicoSorted, sparkFromHistorico } from './dashboardHelpers';
import type { PainelKpi } from './types';

export function buildPainelKpis(data: ContratoDashboard): PainelKpi[] {
  const historico = historicoSorted(data);
  const prev = historico.length > 1 ? historico[historico.length - 2] : null;
  const metasAtingidas = countMetasAtingidas(data);
  const metasTotal = countMetasTotal(data);

  const atendimentos = data.kpis_gerais?.total_atendimentos_aps ?? null;
  const odonto = data.kpis_gerais?.atendimentos_odonto ?? null;
  const coletivas = data.kpis_gerais?.total_participantes_coletivos ?? null;

  const metasLabel =
    metasAtingidas === null || metasTotal === null ? EM_DASH : `${metasAtingidas} / ${metasTotal}`;

  const defs: Array<Omit<PainelKpi, 'sparkSeries'> & { sparkField?: keyof HistoricoMensal }> = [
    {
      id: 'atendimentos',
      label: 'Atendimentos individuais',
      value: formatKpi(atendimentos),
      raw: atendimentos,
      isNull: isNullKpi(atendimentos),
      delta: computeDelta(atendimentos, prev?.atendimentos ?? null),
      sparkField: 'atendimentos',
    },
    {
      id: 'cobertura',
      label: 'Cobertura APS',
      value: EM_DASH,
      raw: null,
      isNull: true,
      delta: { label: 'Não apurado', direction: 'flat' },
    },
    {
      id: 'equipes',
      label: 'Equipes ativas',
      value: EM_DASH,
      raw: null,
      isNull: true,
      delta: { label: '—', direction: 'flat' },
    },
    {
      id: 'metas',
      label: 'Metas atingidas',
      value: metasLabel,
      raw: metasAtingidas,
      isNull: metasAtingidas === null,
      delta: { label: 'Comp. Qualidade', direction: 'flat' },
    },
    {
      id: 'odonto',
      label: 'Produção odontológica',
      value: formatKpi(odonto),
      raw: odonto,
      isNull: isNullKpi(odonto),
      delta: computeDelta(odonto, prev?.procedimentos ?? null),
      sparkField: 'procedimentos',
    },
    {
      id: 'coletivas',
      label: 'Atividades coletivas',
      value: formatKpi(coletivas),
      raw: coletivas,
      isNull: isNullKpi(coletivas),
      delta: { label: '—', direction: 'flat' },
    },
  ];

  return defs.map((item) => ({
    ...item,
    sparkSeries: item.sparkField ? sparkFromHistorico(historico, item.sparkField) : [],
  }));
}
