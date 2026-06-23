import type { PreviewCargaEnriquecida } from '../../types/importacao';
import {
  buildMappingStatusLabel,
  formatCadastroTargetLabel,
  previewEquipeLabel,
  previewUnidadeLabel,
  type ResolucaoDraft,
} from '../../utils/importacaoView';
import { EstabelecimentoMappingSelect } from './EstabelecimentoMappingSelect';

interface PreviewMappingRowProps {
  item: PreviewCargaEnriquecida;
  draft: ResolucaoDraft;
  canEdit: boolean;
  onDraftChange: (patch: Partial<ResolucaoDraft>) => void;
}

export function PreviewMappingRow({
  item,
  draft,
  canEdit,
  onDraftChange,
}: PreviewMappingRowProps) {
  const cadastroLabel = formatCadastroTargetLabel(item, draft);
  const showPicker = canEdit && item.mapeamento_status === 'pending';

  return (
    <div className="import-preview-row" data-testid="preview-row">
      <span className="import-preview-check" aria-hidden="true">
        {item.error ? '!' : item.mapeamento_status === 'resolved' ? '✓' : '○'}
      </span>
      <span className="import-preview-name">{item.nome}</span>

      {item.error ? (
        <span className="import-preview-error">{item.error}</span>
      ) : (
        <>
          {item.mapeamento_status ? (
            <span
              className={`import-mapping-badge import-mapping-badge--${item.mapeamento_status}`}
              data-testid="mapping-status-badge"
            >
              {buildMappingStatusLabel(item.mapeamento_status)}
            </span>
          ) : null}
          <span className="import-preview-tag mono">{item.tipo_relatorio}</span>
          {item.tipo_relatorio === 'cadastro_individual' && item.cidadaos_ativos != null ? (
            <span className="import-preview-badge-pop" data-testid="cidadaos-ativos-badge">
              {item.cidadaos_ativos.toLocaleString('pt-BR')} cidadãos
            </span>
          ) : null}
          {item.ja_importado ? (
            <span className="import-preview-warning">já importado</span>
          ) : null}
          <div className="import-preview-mapping">
            <p className="import-preview-esus mono">
              e-SUS: {previewUnidadeLabel(item)} · {previewEquipeLabel(item)}
            </p>
            {cadastroLabel ? (
              <p className="import-preview-cadastro mono" data-testid="cadastro-target-label">
                Cadastro: {cadastroLabel}
                {item.equipe_nome ? ` · ${item.equipe_nome}` : ''}
              </p>
            ) : null}
          </div>
          {showPicker ? (
            <EstabelecimentoMappingSelect
              value={draft.estabelecimento_id}
              suggestions={item.sugestoes_estabelecimento}
              selectedLabel={
                draft.estabelecimento_codigo || draft.estabelecimento_nome
                  ? {
                      codigo_externo: draft.estabelecimento_codigo ?? '',
                      nome: draft.estabelecimento_nome ?? '',
                    }
                  : null
              }
              onChange={(selected) => {
                if (!selected) {
                  onDraftChange({
                    estabelecimento_id: null,
                    estabelecimento_codigo: null,
                    estabelecimento_nome: null,
                  });
                  return;
                }
                onDraftChange({
                  estabelecimento_id: Number(selected.id),
                  estabelecimento_codigo: selected.codigo_externo,
                  estabelecimento_nome: selected.nome,
                  equipe_id: item.equipe_id ?? draft.equipe_id,
                  salvar_mapeamento: draft.salvar_mapeamento || true,
                });
              }}
            />
          ) : null}
          {canEdit && showPicker && draft.estabelecimento_id ? (
            <label className="import-mapping-save">
              <input
                type="checkbox"
                checked={draft.salvar_mapeamento}
                onChange={(event) =>
                  onDraftChange({ ...draft, salvar_mapeamento: event.target.checked })
                }
                data-testid="mapping-save-checkbox"
              />
              Salvar mapeamento para próximas importações
            </label>
          ) : null}
          <span className="import-preview-meta mono">
            {item.competencia?.slice(0, 7) ?? '—'}
          </span>
        </>
      )}
    </div>
  );
}
