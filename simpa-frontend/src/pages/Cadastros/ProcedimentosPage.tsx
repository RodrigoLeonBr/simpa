import { fetchProcedimentos } from '../../api/cadastros';
import { ReadOnlyCatalogPage } from '../../components/cadastros/ReadOnlyCatalogPage';
import { usePaginatedCatalog } from '../../hooks/usePaginatedCatalog';
import { buildProcedimentosQuery } from '../../utils/enrichmentView';

const LIST_COLUMNS = [
  { key: 'codigo_sigtap', label: 'SIGTAP', mono: true },
  { key: 'descricao', label: 'Descrição' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'status', label: 'Status' },
];

export function ProcedimentosPage() {
  const catalog = usePaginatedCatalog({
    fetchPage: fetchProcedimentos,
    buildQuery: buildProcedimentosQuery,
    errorMessage: 'Falha ao carregar procedimentos',
  });

  return (
    <ReadOnlyCatalogPage
      title="Procedimentos"
      subtitle="Catálogo SIGTAP sincronizado do MySQL — somente leitura."
      sectionTitle="Procedimentos ativos"
      columns={LIST_COLUMNS}
      catalog={catalog}
      searchPlaceholder="Buscar por código SIGTAP ou descrição…"
      emptyMessage="Nenhum procedimento encontrado."
      loadingMessage="Carregando procedimentos…"
      testIds={{
        page: 'procedimentos-page',
        search: 'procedimentos-search',
        pagination: 'procedimentos-pagination',
      }}
    />
  );
}
