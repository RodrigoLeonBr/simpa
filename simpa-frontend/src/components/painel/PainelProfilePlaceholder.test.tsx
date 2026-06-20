import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PainelProfilePlaceholder } from './PainelProfilePlaceholder';

describe('PainelProfilePlaceholder', () => {
  afterEach(() => cleanup());

  it('renders placeholder message for pending perfil', () => {
    render(<PainelProfilePlaceholder perfil="Hospitalar" />);

    expect(screen.getByTestId('painel-profile-placeholder')).toBeInTheDocument();
    expect(screen.getByText(/Indicadores em definição/i)).toBeInTheDocument();
    expect(screen.getByText(/Hospitalar/)).toBeInTheDocument();
  });

  it('shows unidades count when provided', () => {
    render(<PainelProfilePlaceholder perfil="MAC" unidadesCount={3} />);

    expect(screen.getByText(/3 estabelecimentos cadastrados neste perfil/i)).toBeInTheDocument();
  });
});
