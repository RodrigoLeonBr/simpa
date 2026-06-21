import { fetchFormas } from '../../api/cadastros';
import { ReadOnlyCatalogPage } from '../../components/cadastros/ReadOnlyCatalogPage';
import { usePaginatedCatalog } from '../../hooks/usePaginatedCatalog';
import { buildFormasQuery } from '../../utils/enrichmentView';

const LIST_COLUMNS = [
  { key: 'codigo_grupo', label: 'Grupo', mono: true },
  { key: 'codigo_subgrupo', label: 'Subgrupo', mono: true },
  { key: 'codigo_forma', label: 'Forma', mono: true },
  { key: 'descricao', label: 'Descrição' },
  { key: 'status', label: 'Status' },
];

export function FormasPage() {
  const catalog = usePaginatedCatalog({
    fetchPage: fetchFormas,
    buildQuery: buildFormasQuery,
    errorMessage: 'Falha ao carregar formas',
  });

  return (
    <ReadOnlyCatalogPage
      title="Formas de Organização"
      subtitle="Estrutura grupo/subgrupo/forma sincronizada do MySQL SIA — somente leitura."
      sectionTitle="Formas ativas"
      columns={LIST_COLUMNS}
      catalog={catalog}
      searchPlaceholder="Buscar por código da forma ou descrição…"
      emptyMessage="Nenhuma forma encontrada."
      loadingMessage="Carregando formas…"
      testIds={{
        page: 'formas-page',
        search: 'formas-search',
        pagination: 'formas-pagination',
      }}
    />
  );
}
