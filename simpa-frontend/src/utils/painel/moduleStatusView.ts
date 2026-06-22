import type { ContratoDashboard } from '../../types/contrato';
import type { ModuleStatus } from './types';

export function buildModuleStatuses(data: ContratoDashboard): ModuleStatus[] {
  const siaStatus = data.modulos?.ambulatorial_sia?.status_conexao ?? 'UNKNOWN';
  const sihdStatus = data.modulos?.hospitalar_sihd?.status_importacao ?? 'UNKNOWN';

  const siaTone =
    siaStatus.includes('CONNECTED') || siaStatus.includes('ATIVO')
      ? 'green'
      : siaStatus.includes('UNAVAILABLE')
        ? 'red'
        : 'amber';

  const sihdTone = sihdStatus.includes('PENDING') ? 'amber' : sihdStatus.includes('OK') ? 'green' : 'red';

  return [
    {
      id: 'sia',
      label: 'SIA · MAC',
      status: siaTone === 'green' ? 'Conectado' : siaStatus.replace(/_/g, ' '),
      tone: siaTone,
    },
    {
      id: 'sihd',
      label: 'SIHD · AIH',
      status: sihdStatus.includes('PENDING') ? 'Pendente' : sihdStatus.replace(/_/g, ' '),
      tone: sihdTone,
    },
  ];
}
