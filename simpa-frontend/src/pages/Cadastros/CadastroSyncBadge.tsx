import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchUltimaCadastroSync } from '../../api/cadastros';
import type { CadastroSyncRecord } from '../../types/cadastros';
import { formatImportDate } from '../../utils/importacaoView';

export function CadastroSyncBadge() {
  const [ultima, setUltima] = useState<CadastroSyncRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchUltimaCadastroSync()
      .then((rec) => { if (active) setUltima(rec); })
      .catch(() => { if (active) setUltima(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return null;

  const tone = ultima ? 'green' : 'amber';
  const dotCls =
    tone === 'green' ? 'cadastro-sync-dot-green' : 'cadastro-sync-dot-amber';

  return (
    <div
      className="card cadastro-sync-banner cadastro-sync-banner--compact"
      data-testid="cadastro-sync-badge"
    >
      <div className="cadastro-sync-banner-main" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`cadastro-sync-dot ${dotCls}`} aria-hidden="true" />
          <strong className="cadastro-sync-title" style={{ fontSize: '0.95rem' }}>
            SIA · Cadastros
          </strong>
          {ultima ? (
            <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-muted, #666)' }}>
              {formatImportDate(ultima.sincronizado_em)} ·{' '}
              {ultima.estabelecimentos.inserted + ultima.estabelecimentos.updated} estab. ·{' '}
              {ultima.procedimentos.inserted + ultima.procedimentos.updated} proc.
            </span>
          ) : (
            <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-muted, #666)' }}>
              Nenhuma sincronização registrada
            </span>
          )}
        </div>
        <Link to="/importacao" className="cadastro-btn ghost" style={{ marginLeft: 'auto' }}>
          Sincronizar →
        </Link>
      </div>
    </div>
  );
}
