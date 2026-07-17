import { Link } from 'react-router-dom';
import type { Estabelecimento } from '../../../types/cadastros';
import { formatCadastroCell } from '../../../utils/cadastroView';
import { formatImportDate } from '../../../utils/importacaoView';
import { LockedField } from './LockedField';

interface EstabelecimentoSyncedSectionProps {
  estabelecimento: Estabelecimento;
  showImportMappingsLink: boolean;
}

export function EstabelecimentoSyncedSection({
  estabelecimento,
  showImportMappingsLink,
}: EstabelecimentoSyncedSectionProps) {
  return (
    <>
      <section className="cadastro-detail-section">
        <h4>Dados sincronizados (SIA)</h4>
        <div className="cadastro-detail-grid">
          <LockedField label="Código externo" value={estabelecimento.codigo_externo} />
          <LockedField label="CNPJ" value={formatCadastroCell(estabelecimento.cnpj)} />
          <LockedField label="RE tipo" value={formatCadastroCell(estabelecimento.re_tipo)} />
          <LockedField label="Tipo unidade" value={formatCadastroCell(estabelecimento.tipouni)} />
          <LockedField
            label="Sincronizado em"
            value={
              estabelecimento.sincronizado_em
                ? formatImportDate(estabelecimento.sincronizado_em)
                : '—'
            }
          />
        </div>
      </section>

      {showImportMappingsLink ? (
        <section className="cadastro-detail-section">
          <h4>Importação e-SUS</h4>
          <p className="cadastro-detail-hint">
            Vínculos persistentes entre rótulos do e-SUS e este estabelecimento.
          </p>
          <Link
            to={`/importacao?tab=mapeamentos&q=${encodeURIComponent(estabelecimento.codigo_externo)}`}
            className="cadastro-btn ghost"
            data-testid="estabelecimento-mapeamentos-link"
          >
            Ver mapeamentos e-SUS →
          </Link>
        </section>
      ) : null}
    </>
  );
}
