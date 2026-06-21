import { fetchCbos } from '../../api/cadastros';
import { ReadOnlyCatalogPage } from '../../components/cadastros/ReadOnlyCatalogPage';
import { usePaginatedCatalog } from '../../hooks/usePaginatedCatalog';
import { buildCbosQuery } from '../../utils/enrichmentView';

const LIST_COLUMNS = [
  { key: 'codigo_cbo', label: 'CBO', mono: true },
  { key: 'descricao', label: 'Descrição' },
  { key: 'status', label: 'Status' },
];

export function CbosPage() {
  const catalog = usePaginatedCatalog({
    fetchPage: fetchCbos,
    buildQuery: buildCbosQuery,
    errorMessage: 'Falha ao carregar CBOs',
  });

  return (
    <ReadOnlyCatalogPage
      title="CBOs"
      subtitle="Classificação Brasileira de Ocupações sincronizada do MySQL SIA — somente leitura."
      sectionTitle="CBOs ativos"
      columns={LIST_COLUMNS}
      catalog={catalog}
      searchPlaceholder="Buscar por código CBO ou descrição…"
      emptyMessage="Nenhum CBO encontrado."
      loadingMessage="Carregando CBOs…"
      testIds={{
        page: 'cbos-page',
        search: 'cbos-search',
        pagination: 'cbos-pagination',
      }}
    />
  );
}
