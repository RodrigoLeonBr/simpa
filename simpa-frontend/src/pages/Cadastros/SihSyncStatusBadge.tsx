import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSihSincronizacoes } from '../../api/sih';
import type { SihSincronizacao } from '../../types/sih';
import { formatImportDate } from '../../utils/importacaoView';

function toneFor(status: string): 'green' | 'amber' | 'red' {
  if (status === 'ok') return 'green';
  if (status === 'parcial' || status === 'pendente') return 'amber';
  return 'red';
}

function toneClass(tone: 'green' | 'amber' | 'red'): string {
  if (tone === 'green') return 'cadastro-sync-dot-green';
  if (tone === 'amber') return 'cadastro-sync-dot-amber';
  return 'cadastro-sync-dot-red';
}

export function SihSyncStatusBadge() {
  const [lastSync, setLastSync] = useState<SihSincronizacao | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSihSincronizacoes()
      .then((list) => {
        if (!active) return;
        const ok = list.find((s) => s.status === 'ok') ?? list[0] ?? null;
        setLastSync(ok);
      })
      .catch(() => {
        if (active) setLastSync(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return null;

  const tone = lastSync ? toneFor(lastSync.status) : 'amber';
  const dotCls = toneClass(tone);

  return (
    <div
      className="card cadastro-sync-banner cadastro-sync-banner--compact"
      data-testid="sih-sync-badge"
    >
      <div className="cadastro-sync-banner-main" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`cadastro-sync-dot ${dotCls}`} aria-hidden="true" />
          <strong className="cadastro-sync-title" style={{ fontSize: '0.95rem' }}>
            SIHD · AIH
          </strong>
          {lastSync ? (
            <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-muted, #666)' }}>
              {lastSync.competencia.slice(0, 7)} ·{' '}
              {lastSync.sincronizado_em ? formatImportDate(lastSync.sincronizado_em) : '—'} ·{' '}
              {lastSync.qtd_internacoes} internações
            </span>
          ) : (
            <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-muted, #666)' }}>
              Sem importação registrada
            </span>
          )}
        </div>
        <Link to="/importacao" className="cadastro-btn ghost" style={{ marginLeft: 'auto' }}>
          Importar SIHD →
        </Link>
      </div>
    </div>
  );
}
