import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProvider, useApp } from './AppContext';
import { THEME_STORAGE_KEY } from '../utils/theme';

function ThemeProbe() {
  const { theme, toggleAppTheme } = useApp();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={toggleAppTheme}>
        toggle
      </button>
    </div>
  );
}

describe('AppContext', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('persists theme in localStorage when toggled', async () => {
    render(
      <AppProvider>
        <ThemeProbe />
      </AppProvider>,
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggles situacao overlay state', async () => {
    function SituacaoProbe() {
      const { isSituacao, openSituacao, closeSituacao } = useApp();
      return (
        <div>
          <span data-testid="situacao">{isSituacao ? 'open' : 'closed'}</span>
          <button type="button" onClick={openSituacao}>
            open
          </button>
          <button type="button" onClick={closeSituacao}>
            close
          </button>
        </div>
      );
    }

    render(
      <AppProvider>
        <SituacaoProbe />
      </AppProvider>,
    );

    expect(screen.getByTestId('situacao')).toHaveTextContent('closed');
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(screen.getByTestId('situacao')).toHaveTextContent('open');
    await userEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(screen.getByTestId('situacao')).toHaveTextContent('closed');
  });

  it('useApp throws outside AppProvider', () => {
    function BrokenConsumer() {
      useApp();
      return null;
    }

    expect(() => render(<BrokenConsumer />)).toThrow('useApp must be used within AppProvider');
  });
});
