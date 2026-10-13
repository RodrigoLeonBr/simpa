import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCobertura } from '../../api/vacina';
import { fetchPainelLayout } from '../../api/painelWidgets';
import type { CoberturaRow } from '../../types/vacina';
import type { ResolvedPainelWidget } from '../../types/painelWidgets';
import { downloadCsv } from '../../utils/csv';
import { CoberturaMatrix } from './CoberturaMatrix';
import { DynamicWidgetGrid } from '../../components/painel/DynamicWidgetGrid';

const ANO = 2026;

const COLUMNS = [
  { key: 'imuno_nome',     label: 'Vacina'       },
  { key: 'grupo_nome',     label: 'Grupo'        },
  { key: 'doses',          label: 'Doses'        },
  { key: 'pop_alvo',       label: 'Pop alvo'     },
  { key: 'num_doses',      label: 'Esquema'      },
  { key: 'denominador',    label: 'Denominador'  },
  { key: 'cobertura_pct',  label: 'Cobertura %'  },
];

const MONTHS = [
  ['01','Janeiro'], ['02','Fevereiro'], ['03','Março'],
  ['04','Abril'],   ['05','Maio'],      ['06','Junho'],
  ['07','Julho'],   ['08','Agosto'],    ['09','Setembro'],
  ['10','Outubro'], ['11','Novembro'],  ['12','Dezembro'],
] as const;

export default function VacinasPage() {
  const [mes, setMes] = useState('12');
  const [rows, setRows] = useState<CoberturaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [indicadores, setIndicadores] = useState<ResolvedPainelWidget[]>([]);

  useEffect(() => {
    setLoading(true);
    fetchCobertura({ ano: ANO, competencia: `${ANO}-${mes}` })
      .then((r) => { setRows(r); setLoading(false); })
      .catch(() => setLoading(false));
  }, [mes]);

  useEffect(() => {
    fetchPainelLayout({ perfil: 'Vacinas', layout: 'A', periodo: `${ANO}-${mes}` })
      .then((r) => setIndicadores(r.widgets))
      .catch(() => setIndicadores([])); // ponytail: 404 = sem widgets → seção oculta
  }, [mes]);

  return (
    <div className="vacinas-page simpa-rise" data-testid="vacinas-page">
      <div className="vacinas-header">
        <div>
          <h2 className="painel-title">Cobertura Vacinal {ANO}</h2>
        </div>
        <div className="vacinas-header-controls">
          <label className="vacinas-filter-label" htmlFor="vacinas-mes-select">
            Acumulado até
          </label>
          <select
            id="vacinas-mes-select"
            className="vacinas-filter-select"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          >
            {MONTHS.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          <button
            className="vacinas-export-btn"
            onClick={() => downloadCsv('cobertura_vacinal.csv', COLUMNS, rows)}
            disabled={rows.length === 0}
          >
            Exportar CSV
          </button>
          <Link
            to="/cadastros/indicadores-painel?perfil=Vacinas"
            className="vacinas-export-btn"
            data-testid="vacinas-gerenciar-indicadores"
          >
            Gerenciar indicadores
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="vacinas-state" data-testid="vacinas-loading">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="vacinas-state" data-testid="vacinas-empty">
          Sem esquema/dados cadastrados para {ANO}.
        </p>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'auto' }} data-testid="vacinas-matrix">
            <CoberturaMatrix rows={rows} />
          </div>
          <div className="vacinas-legend">
            <span className="vacinas-legend-item"><span className="vacinas-legend-dot green" /> ≥ 80%</span>
            <span className="vacinas-legend-item"><span className="vacinas-legend-dot amber" /> 50–79%</span>
            <span className="vacinas-legend-item"><span className="vacinas-legend-dot red" /> &lt; 50%</span>
            <span className="vacinas-legend-item"><span className="vacinas-legend-dot gray" /> Sem dado</span>
            <span className="vacinas-legend-note">Meta proporcional ao mês ({mes}/12)</span>
          </div>
        </>
      )}

      {indicadores.length > 0 && (
        <section className="vacinas-indicadores" data-testid="vacinas-indicadores">
          <h3 className="painel-title">Indicadores</h3>
          <DynamicWidgetGrid widgets={indicadores} testId="vacinas-indicadores-grid" />
        </section>
      )}
    </div>
  );
}
