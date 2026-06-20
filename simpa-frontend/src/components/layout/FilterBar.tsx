import { useEffect, useMemo, useState } from 'react';
import { fetchEquipes, fetchUnidades, type Equipe, type Unidade } from '../../api/cadastros';
import { useFilters } from '../../hooks/useFilters';

export function FilterBar() {
  const { competencia, unidadeId, equipeId, competencias, setCompetencia, setUnidadeId, setEquipeId } =
    useFilters();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);

  useEffect(() => {
    fetchUnidades()
      .then(setUnidades)
      .catch(() => setUnidades([]));
  }, []);

  useEffect(() => {
    if (!unidadeId) {
      setEquipes([]);
      return;
    }

    fetchEquipes(unidadeId)
      .then(setEquipes)
      .catch(() => setEquipes([]));
  }, [unidadeId]);

  const unidadeOptions = useMemo(
    () => unidades.filter((item) => item.status !== 'inativo'),
    [unidades],
  );

  const equipeOptions = useMemo(
    () => equipes.filter((item) => item.status !== 'inativo'),
    [equipes],
  );

  return (
    <div className="filter-bar">
      <label className="filter-field">
        <span className="filter-label">Competência</span>
        <select
          className="filter-select mono"
          value={competencia}
          onChange={(event) => setCompetencia(event.target.value)}
        >
          {competencias.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span className="filter-label">Unidade</span>
        <select
          className="filter-select"
          value={unidadeId ?? ''}
          onChange={(event) => {
            const next = event.target.value ? Number(event.target.value) : null;
            setUnidadeId(next);
          }}
        >
          <option value="">Todas as unidades</option>
          {unidadeOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        <span className="filter-label">Equipe</span>
        <select
          className="filter-select"
          value={equipeId ?? ''}
          disabled={!unidadeId}
          onChange={(event) => {
            const next = event.target.value ? Number(event.target.value) : null;
            setEquipeId(next);
          }}
        >
          <option value="">Todas as equipes</option>
          {equipeOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome}
            </option>
          ))}
        </select>
      </label>

      <div className="filter-status mono">
        <span className="filter-status-dot" />
        Dados consolidados
      </div>
    </div>
  );
}
