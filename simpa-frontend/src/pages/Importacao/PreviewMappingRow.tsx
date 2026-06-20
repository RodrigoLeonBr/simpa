import type { EstabelecimentoSugestao, PreviewCargaEnriquecida } from '../../types/importacao';
import {
  buildMappingStatusLabel,
  formatCadastroTargetLabel,
  previewEquipeLabel,
  previewUnidadeLabel,
  type ResolucaoDraft,
} from '../../utils/importacaoView';

interface PreviewMappingRowProps {
  item: PreviewCargaEnriquecida;
  draft: ResolucaoDraft;
  canEdit: boolean;
  onDraftChange: (next: ResolucaoDraft) => void;
}

function suggestionOptions(item: PreviewCargaEnriquecida): EstabelecimentoSugestao[] {
  return item.sugestoes_estabelecimento ?? [];
}

export function PreviewMappingRow({
  item,
  draft,
  canEdit,
  onDraftChange,
}: PreviewMappingRowProps) {
  const cadastroLabel = formatCadastroTargetLabel(item, draft);
  const showPicker =
    canEdit &&
    item.mapeamento_status === 'pending' &&
    suggestionOptions(item).length > 0;

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
            <label className="import-mapping-picker">
              <span>Estabelecimento</span>
              <select
                data-testid="mapping-estabelecimento-select"
                value={draft.estabelecimento_id ?? ''}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  const selected = suggestionOptions(item).find((s) => s.id === value);
                  onDraftChange({
                    ...draft,
                    estabelecimento_id: Number.isFinite(value) ? value : null,
                    equipe_id: item.equipe_id ?? draft.equipe_id,
                    salvar_mapeamento: draft.salvar_mapeamento || Boolean(selected),
                  });
                }}
              >
                <option value="">Selecione…</option>
                {suggestionOptions(item).map((sugestao) => (
                  <option key={sugestao.id} value={sugestao.id}>
                    {sugestao.codigo_externo} · {sugestao.nome}
                  </option>
                ))}
              </select>
            </label>
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
