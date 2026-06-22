import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ModuleLoadError,
  ModuleLoadErrorBoundary,
} from './ModuleLoadError';
import { ModuleLoadingFallback } from './ModuleLoadingFallback';

describe('ModuleLoadingFallback', () => {
  afterEach(() => cleanup());

  it('renderiza mensagem de carregamento', () => {
    render(<ModuleLoadingFallback />);
    expect(screen.getByTestId('module-loading-fallback')).toHaveTextContent(
      'Carregando módulo…',
    );
  });
});

describe('ModuleLoadError', () => {
  afterEach(() => cleanup());

  it('renderiza mensagem em PT com botão de retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ModuleLoadError onRetry={onRetry} />);

    expect(screen.getByTestId('module-load-error')).toHaveTextContent(
      'Não foi possível carregar esta página.',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('ModuleLoadErrorBoundary', () => {
  afterEach(() => cleanup());

  it('captura erro de chunk e exibe fallback', () => {
    function Broken() {
      const error = new Error('Failed to fetch dynamically imported module');
      error.name = 'ChunkLoadError';
      throw error;
    }

    render(
      <ModuleLoadErrorBoundary>
        <Broken />
      </ModuleLoadErrorBoundary>,
    );

    expect(screen.getByTestId('module-load-error')).toBeInTheDocument();
  });

  it('não mascara erro de runtime não relacionado a chunk', () => {
    function BrokenRuntime() {
      throw new Error('runtime bug');
    }

    expect(() =>
      render(
        <ModuleLoadErrorBoundary>
          <BrokenRuntime />
        </ModuleLoadErrorBoundary>,
      ),
    ).toThrow('runtime bug');
  });
});
