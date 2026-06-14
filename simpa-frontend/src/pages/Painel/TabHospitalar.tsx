import type { ModuloSIHD } from '../../types/contrato';

interface Props { sihd: ModuloSIHD }

export function TabHospitalar({ sihd }: Props) {
  const pendente = sihd.status_importacao === 'PENDING_AIH_FILE';
  return (
    <div className="flex items-center justify-center h-48">
      <div className="text-center">
        <div className="w-12 h-12 bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-amber-400 text-xl">⏳</span>
        </div>
        <p className="text-slate-300 text-sm font-medium mb-1">
          {pendente ? 'Aguardando arquivo AIH' : sihd.status_importacao}
        </p>
        <p className="text-slate-500 text-xs">
          Importe o arquivo SIHD/AIH no módulo de Importação para ativar este painel.
        </p>
      </div>
    </div>
  );
}
