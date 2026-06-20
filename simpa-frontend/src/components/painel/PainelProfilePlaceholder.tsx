import type { PainelPerfil } from '../../types/painel';

interface PainelProfilePlaceholderProps {
  perfil: PainelPerfil;
  unidadesCount?: number;
}

export function PainelProfilePlaceholder({ perfil, unidadesCount }: PainelProfilePlaceholderProps) {
  return (
    <section className="card painel-profile-placeholder" data-testid="painel-profile-placeholder">
      <h3>Indicadores em definição</h3>
      <p>
        Os indicadores para o perfil <strong>{perfil}</strong> estão em definição e serão
        disponibilizados em uma fase futura do SIMPA.
      </p>
      {unidadesCount !== undefined && unidadesCount > 0 ? (
        <p className="painel-profile-placeholder-meta mono">
          {unidadesCount} estabelecimento{unidadesCount === 1 ? '' : 's'} cadastrado
          {unidadesCount === 1 ? '' : 's'} neste perfil.
        </p>
      ) : null}
    </section>
  );
}
