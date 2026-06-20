import { useEffect, useMemo, useState } from 'react';
import { fetchEquipes, fetchEstabelecimentos, type Equipe } from '../../api/cadastros';
import type { Estabelecimento } from '../../types/cadastros';
import {
  activeEstabelecimentos,
  buildEstabelecimentosPerfilQuery,
} from '../../utils/estabelecimentosView';
import { useFilters } from '../../hooks/useFilters';

export function FilterBar() {
  const {
    competencia,
    unidadeId,
    equipeId,
    painelPerfil,
    competencias,
    setCompetencia,
    setUnidadeId,
    setEquipeId,
  } = useFilters();
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetchEstabelecimentos(buildEstabelecimentosPerfilQuery(painelPerfil))
      .then((result) => {
        if (!cancelled) {
          setEstabelecimentos(result.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEstabelecimentos([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [painelPerfil]);

  useEffect(() => {
    if (!unidadeId) {
      setEquipes([]);
      return;
    }

    fetchEquipes(unidadeId)
      .then(setEquipes)
      .catch(() => setEquipes([]));
  }, [unidadeId]);

  const estabelecimentoOptions = useMemo(
    () => activeEstabelecimentos(estabelecimentos),
    [estabelecimentos],
  );

  const equipeOptions = useMemo(
    () => equipes.filter((item) => item.status !== 'inativo'),
    [equipes],
  );

  return (
    <div className="filter-bar" data-testid="filter-bar">
      <label className="filter-field">
        <span className="filter-label">Competência</span>
        <select
          className="filter-select mono"
          value={competencia}
          onChange={(event) => setCompetencia(event.target.value)}
          data-testid="filter-competencia"
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
          data-testid="filter-unidade"
        >
          <option value="">Todas as unidades</option>
          {estabelecimentoOptions.map((item) => (
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
