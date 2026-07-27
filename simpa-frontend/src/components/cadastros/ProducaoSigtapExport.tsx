import { useEffect, useState } from 'react';
import { fetchProducaoSigtap, fetchProducaoSigtapCompetencias } from '../../api/cadastros';
import { downloadCsv, type CsvColumn } from '../../utils/csv';
import { ToastBanner, useToast } from '../shared/Toast';

const PRODUCAO_COLUMNS: CsvColumn[] = [
  { key: 'competencia', label: 'Competência' },
  { key: 'unidade', label: 'Unidade' },
  { key: 'tipo_relatorio', label: 'Relatório' },
  { key: 'bloco', label: 'Bloco' },
  { key: 'descricao_esus', label: 'Descrição e-SUS' },
  { key: 'codigo_sigtap', label: 'SIGTAP' },
  { key: 'descricao_sigtap', label: 'Descrição SIGTAP' },
  { key: 'quantidade', label: 'Quantidade' },
];

/** Exporta a produção e-SUS importada (competência) filtrada pelo de-para SIGTAP. */
export function ProducaoSigtapExport() {
  const [competencias, setCompetencias] = useState<string[]>([]);
  const [competencia, setCompetencia] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, showToast } = useToast();

  useEffect(() => {
    void fetchProducaoSigtapCompetencias()
      .then((list) => {
        setCompetencias(list);
        setCompetencia((atual) => atual || list[0] || '');
      })
      .catch(() => setCompetencias([]));
  }, []);

  const exportar = async () => {
    if (!competencia) return;
    setBusy(true);
    try {
      const rows = await fetchProducaoSigtap(competencia);
      if (rows.length === 0) {
        showToast('Sem produção com de-para nesta competência');
        return;
      }
      downloadCsv(`producao-sigtap-${competencia}.csv`, PRODUCAO_COLUMNS, rows);
      showToast(`Exportando ${rows.length} linhas…`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha na exportação');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card cadastro-crud-card" data-testid="producao-sigtap-export">
      <div className="cadastro-crud-card-head">
        <h3>Exportar produção e-SUS → SIGTAP</h3>
      </div>
      <p className="analytics-subtitle">
        Produção importada da competência, só procedimentos com de-para ativo. Agrega por unidade e
        código SIGTAP.
      </p>
      <div className="cadastro-head-actions" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
        <select
          id="producao-sigtap-comp"
          aria-label="Competência"
          className="cadastro-btn"
          value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}
          disabled={competencias.length === 0 || busy}
        >
          {competencias.length === 0 ? (
            <option value="">Sem produção importada</option>
          ) : (
            competencias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          className="cadastro-btn primary"
          onClick={() => void exportar()}
          disabled={!competencia || busy}
        >
          ⤓ Exportar produção
        </button>
      </div>
      <ToastBanner message={toast.message} visible={toast.visible} />
    </section>
  );
}
