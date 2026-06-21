import { useEffect, useMemo, useState } from 'react';
import { fetchEstabelecimentos } from '../../api/cadastros';
import type { EstabelecimentoSugestao } from '../../types/importacao';

export interface EstabelecimentoMappingValue {
  id: number;
  codigo_externo: string;
  nome: string;
}

interface EstabelecimentoMappingSelectProps {
  value: number | null;
  suggestions?: EstabelecimentoSugestao[];
  selectedLabel?: Pick<EstabelecimentoMappingValue, 'codigo_externo' | 'nome'> | null;
  onChange: (next: EstabelecimentoMappingValue | null) => void;
  selectTestId?: string;
  searchTestId?: string;
  disabled?: boolean;
}

function normalizeId(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatOptionLabel(option: EstabelecimentoMappingValue): string {
  return `${option.codigo_externo} · ${option.nome}`;
}

function toOption(item: EstabelecimentoSugestao | EstabelecimentoMappingValue): EstabelecimentoMappingValue {
  return {
    id: normalizeId(item.id),
    codigo_externo: String(item.codigo_externo ?? ''),
    nome: String(item.nome ?? ''),
  };
}

function sameId(left: unknown, right: unknown): boolean {
  return normalizeId(left) === normalizeId(right);
}

function parseOptionFromSelect(select: HTMLSelectElement): EstabelecimentoMappingValue | null {
  const nextId = normalizeId(select.value);
  if (!nextId) {
    return null;
  }

  const label = select.selectedOptions[0]?.textContent?.trim() ?? '';
  const separatorIndex = label.indexOf('·');
  if (separatorIndex === -1) {
    return { id: nextId, codigo_externo: '', nome: label };
  }

  return {
    id: nextId,
    codigo_externo: label.slice(0, separatorIndex).trim(),
    nome: label.slice(separatorIndex + 1).trim(),
  };
}

export function EstabelecimentoMappingSelect({
  value,
  suggestions = [],
  selectedLabel,
  onChange,
  selectTestId = 'mapping-estabelecimento-select',
  searchTestId = 'mapping-estabelecimento-search',
  disabled = false,
}: EstabelecimentoMappingSelectProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EstabelecimentoMappingValue[]>([]);
  const [loading, setLoading] = useState(false);

  const normalizedValue = value != null && normalizeId(value) > 0 ? normalizeId(value) : null;

  const suggestionOptions = useMemo(
    () => suggestions.map((item) => toOption(item)),
    [suggestions],
  );

  const usingSearchResults = searchOpen && query.trim().length >= 2;

  const selectOptions = useMemo(() => {
    const base = usingSearchResults ? searchResults : suggestionOptions;
    const merged = new Map<number, EstabelecimentoMappingValue>();

    for (const option of base) {
      merged.set(option.id, option);
    }

    if (normalizedValue != null) {
      const fromBase = base.find((item) => sameId(item.id, normalizedValue));
      if (fromBase) {
        merged.set(fromBase.id, fromBase);
      } else {
        const fromSuggestions = suggestionOptions.find((item) => sameId(item.id, normalizedValue));
        if (fromSuggestions) {
          merged.set(fromSuggestions.id, fromSuggestions);
        } else {
          const fromSearch = searchResults.find((item) => sameId(item.id, normalizedValue));
          if (fromSearch) {
            merged.set(fromSearch.id, fromSearch);
          } else if (selectedLabel?.nome || selectedLabel?.codigo_externo) {
            merged.set(normalizedValue, {
              id: normalizedValue,
              codigo_externo: selectedLabel.codigo_externo ?? '',
              nome: selectedLabel.nome ?? '',
            });
          }
        }
      }
    }

    if (usingSearchResults) {
      return [...merged.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }

    if (suggestionOptions.length === 0) {
      return [...merged.values()];
    }

    if (normalizedValue != null && !suggestionOptions.some((item) => sameId(item.id, normalizedValue))) {
      const selected = [...merged.values()].find((item) => sameId(item.id, normalizedValue));
      return selected ? [...suggestionOptions, selected] : suggestionOptions;
    }

    return suggestionOptions;
  }, [
    usingSearchResults,
    searchResults,
    suggestionOptions,
    normalizedValue,
    selectedLabel,
  ]);

  useEffect(() => {
    if (!searchOpen) {
      setSearchResults([]);
      setLoading(false);
      return undefined;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetchEstabelecimentos({
          q: trimmed,
          limit: 50,
          status: 'ativo',
        });
        if (cancelled) {
          return;
        }
        setSearchResults(response.data.map((item) => toOption(item)));
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, searchOpen]);

  useEffect(() => {
    if (suggestions.length === 0) {
      setSearchOpen(true);
    }
  }, [suggestions.length]);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const select = event.currentTarget;
    if (!select.value) {
      onChange(null);
      return;
    }

    const nextId = normalizeId(select.value);
    const option =
      selectOptions.find((item) => sameId(item.id, nextId)) ?? parseOptionFromSelect(select);

    if (option) {
      onChange(option);
    }
  };

  return (
    <div className="import-mapping-picker" data-testid="estabelecimento-mapping-select">
      <label className="import-mapping-picker">
        <span>Estabelecimento</span>
        <select
          value={normalizedValue != null ? String(normalizedValue) : ''}
          disabled={disabled}
          data-testid={selectTestId}
          onChange={handleSelectChange}
        >
          <option value="">Selecione…</option>
          {selectOptions.map((item) => (
            <option key={item.id} value={String(item.id)}>
              {formatOptionLabel(item)}
            </option>
          ))}
        </select>
      </label>

      {!searchOpen && suggestions.length > 0 ? (
        <button
          type="button"
          className="import-mapping-search-toggle"
          disabled={disabled}
          onClick={() => setSearchOpen(true)}
          data-testid="mapping-search-toggle"
        >
          Não encontrou? Buscar outro estabelecimento no cadastro
        </button>
      ) : null}

      {searchOpen ? (
        <div className="import-mapping-search-panel">
          <label className="import-mapping-search">
            <span>Buscar no cadastro</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome ou código (ex.: ZANAGA)"
              disabled={disabled}
              data-testid={searchTestId}
            />
          </label>
          {loading ? <span className="import-mapping-search-hint">Buscando…</span> : null}
          {!loading && query.trim().length >= 2 && searchResults.length === 0 ? (
            <span className="import-mapping-search-hint">Nenhum estabelecimento encontrado.</span>
          ) : null}
          {suggestions.length > 0 ? (
            <button
              type="button"
              className="import-mapping-search-toggle"
              disabled={disabled}
              onClick={() => {
                setSearchOpen(false);
                setQuery('');
                setSearchResults([]);
              }}
              data-testid="mapping-search-back"
            >
              Voltar às sugestões
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
