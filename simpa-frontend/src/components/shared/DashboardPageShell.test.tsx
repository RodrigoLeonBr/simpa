import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardPageShell } from './DashboardPageShell';

describe('DashboardPageShell', () => {
  afterEach(() => cleanup());

  it('renderiza estado de carregamento com analytics-state', () => {
    render(
      <DashboardPageShell loading error={null} loadingLabel="Carregando metas…" testId="dashboard-shell">
        <p>conteúdo</p>
      </DashboardPageShell>,
    );

    const state = screen.getByTestId('dashboard-shell');
    expect(state).toHaveClass('analytics-state');
    expect(state).not.toHaveClass('analytics-state-error');
    expect(state).toHaveTextContent('Carregando metas…');
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });

  it('renderiza erro com analytics-state-error', () => {
    render(
      <DashboardPageShell loading={false} error="Metas indisponíveis" testId="dashboard-shell">
        <p>conteúdo</p>
      </DashboardPageShell>,
    );

    const state = screen.getByTestId('dashboard-shell');
    expect(state).toHaveClass('analytics-state', 'analytics-state-error');
    expect(state).toHaveTextContent('Metas indisponíveis');
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });

  it('renderiza children quando pronto', () => {
    render(
      <DashboardPageShell loading={false} error={null}>
        <p data-testid="dashboard-content">Painel carregado</p>
      </DashboardPageShell>,
    );

    expect(screen.getByTestId('dashboard-content')).toHaveTextContent('Painel carregado');
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument();
  });

  it('prioriza loading sobre error', () => {
    render(
      <DashboardPageShell loading loadingLabel="Carregando indicadores…" error="Falha API">
        <p>conteúdo</p>
      </DashboardPageShell>,
    );

    expect(screen.getByText('Carregando indicadores…')).toBeInTheDocument();
    expect(screen.queryByText('Falha API')).not.toBeInTheDocument();
  });

  it('usa loadingLabel padrão quando omitido', () => {
    render(
      <DashboardPageShell loading>
        <p>conteúdo</p>
      </DashboardPageShell>,
    );

    expect(screen.getByText('Carregando…')).toBeInTheDocument();
  });

  it('não invoca children função durante loading ou erro', () => {
    const renderContent = vi.fn(() => <p>conteúdo lazy</p>);

    const { rerender } = render(
      <DashboardPageShell loading error={null}>
        {renderContent}
      </DashboardPageShell>,
    );
    expect(renderContent).not.toHaveBeenCalled();

    rerender(
      <DashboardPageShell loading={false} error="Falha API">
        {renderContent}
      </DashboardPageShell>,
    );
    expect(renderContent).not.toHaveBeenCalled();

    rerender(
      <DashboardPageShell loading={false} error={null}>
        {renderContent}
      </DashboardPageShell>,
    );
    expect(renderContent).toHaveBeenCalledOnce();
    expect(screen.getByText('conteúdo lazy')).toBeInTheDocument();
  });
});
