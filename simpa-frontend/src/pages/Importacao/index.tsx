import { useEffect, useState } from 'react';
import { FilterBar }      from '../../components/layout/FilterBar';
import { UploadZone }     from './UploadZone';
import { HistoricoCargas } from './HistoricoCargas';
import { fetchCargas }    from '../../api/importacao';
import type { CargaEsus } from '../../types/contrato';

export default function ImportacaoPage() {
  const [cargas,  setCargas]  = useState<CargaEsus[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    try {
      const dados = await fetchCargas();
      setCargas(dados);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FilterBar titulo="IMPORTAÇÃO" />
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <UploadZone onUploadConcluido={carregar} />
        {loading
          ? <p className="text-slate-500 text-sm">Carregando histórico...</p>
          : <HistoricoCargas cargas={cargas} onAtualizar={carregar} />
        }
      </div>
    </div>
  );
}
