import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchUltimaSiaSync } from '../../api/sia';
import type { SiaSyncRecord } from '../../types/sia';
import { formatImportDate } from '../../utils/importacaoView';

export function SiaProducaoBadge() {
  const [ultima, setUltima] = useState<SiaSyncRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchUltimaSiaSync()
      .then((rec) => { if (active) setUltima(rec); })
      .catch(() => { if (active) setUltima(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return null;

  const tone = ultima?.status === 'ok' ? 'green' : ultima ? 'amber' : 'amber';
  const dotCls =
    tone === 'green' ? 'cadastro-sync-dot-green' : 'cadastro-sync-dot-amber';

  return (
    <div
      className="card cadastro-sync-banner cadastro-sync-banner--compact"
      data-testid="sia-producao-badge"
    >
      <div className="cadastro-sync-banner-main" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`cadastro-sync-dot ${dotCls}`} aria-hidden="true" />
          <strong className="cadastro-sync-title" style={{ fontSize: '0.95rem' }}>
            SIA · Produção
          </strong>
          {ultima ? (
            <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-muted, #666)' }}>
              {ultima.competencia.slice(0, 7)} ·{' '}
              {ultima.sincronizado_em ? formatImportDate(ultima.sincronizado_em) : '—'} ·{' '}
              {ultima.registros} registros
            </span>
          ) : (
            <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-muted, #666)' }}>
              Nenhuma importação registrada
            </span>
          )}
        </div>
        <Link to="/importacao" className="cadastro-btn ghost" style={{ marginLeft: 'auto' }}>
          Importar →
        </Link>
      </div>
    </div>
  );
}
