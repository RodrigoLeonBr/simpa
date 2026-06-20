import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../../contexts/AppContext';
import { Sidebar } from './Sidebar';

function renderSidebar(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppProvider>
        <Routes>
          <Route path="*" element={<Sidebar />} />
        </Routes>
      </AppProvider>
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  afterEach(() => cleanup());

  it('highlights the active route', () => {
    renderSidebar('/metas');

    const activeLink = screen.getByRole('link', { name: /Metas/i });
    expect(activeLink).toHaveClass('active');

    const inactiveLink = screen.getByRole('link', { name: /Painel/i });
    expect(inactiveLink).not.toHaveClass('active');
  });
});
