import { useMemo } from 'react';
import {
  PERIODO_TIPOS,
  buildPeriodoValues,
  formatPeriodoLabel,
  periodoTipo,
  type PeriodoTipo,
} from '../../utils/periodo';

interface PeriodoSelectProps {
  periodo: string;
  competencias: string[];
  onChange: (periodo: string) => void;
  testIdPrefix?: string;
  labelGrao?: string;
  labelPeriodo?: string;
}

/** Dois selects: grão (mês/trimestre/quadri/ano) + valor. Reutilizado no FilterBar e nos previews. */
export function PeriodoSelect({
  periodo,
  competencias,
  onChange,
  testIdPrefix = 'periodo',
  labelGrao = 'Grão',
  labelPeriodo = 'Período',
}: PeriodoSelectProps) {
  const tipo = periodoTipo(periodo);
  const valores = useMemo(() => buildPeriodoValues(competencias, tipo), [competencias, tipo]);

  function handleTipoChange(nextTipo: PeriodoTipo) {
    const opcoes = buildPeriodoValues(competencias, nextTipo);
    if (opcoes.length) {
      onChange(opcoes[0]!);
    }
  }

  return (
    <>
      <label className="filter-field">
        <span className="filter-label">{labelGrao}</span>
        <select
          className="filter-select"
          value={tipo}
          onChange={(event) => handleTipoChange(event.target.value as PeriodoTipo)}
          data-testid={`${testIdPrefix}-grao`}
        >
          {PERIODO_TIPOS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span className="filter-label">{labelPeriodo}</span>
        <select
          className="filter-select mono"
          value={periodo}
          onChange={(event) => onChange(event.target.value)}
          data-testid={`${testIdPrefix}-valor`}
        >
          {valores.map((value) => (
            <option key={value} value={value}>
              {formatPeriodoLabel(value)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
