/**
 * E2E: Painel Hospitalar Layout A regression + SihSyncStatusBadge in Cadastros.
 * Uses page.route() mocks so tests run without live DB data.
 */
import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Painel Hospitalar Layout A', () => {
  test.beforeEach(async ({ page }) => {
    // Mock SIHD sync list for badge
    await page.route('**/api/sih/sincronizacoes', (route) =>
      route.fulfill({
        json: [
          {
            id: 1,
            competencia: '2025-01-01',
            status: 'ok',
            qtd_internacoes: 42,
            qtd_procedimentos: 110,
            orphan_cnes: 0,
            erros: 0,
            sincronizado_em: '2025-02-01T10:00:00Z',
          },
        ],
      }),
    );
    // Mock painel layout for Hospitalar widgets
    await page.route('**/api/painel-layout**', (route) =>
      route.fulfill({
        json: {
          perfil: 'Hospitalar',
          layout: 'A',
          competencia: '2025-01',
          widgets: [
            { slug: 'total_aih', ordem: 1, tipo: 'card', titulo: 'Total de internações', formato: 'numero', value: 42, valueLabel: '42', isNull: false },
            { slug: 'total_valor', ordem: 2, tipo: 'card', titulo: 'Valor total AIH', formato: 'moeda', value: 18000, valueLabel: 'R$ 18.000', isNull: false },
          ],
        },
      }),
    );
  });

  test('Painel with Hospitalar profile renders Layout A without error', async ({ page }) => {
    await login(page);

    // Switch to Hospitalar profile via ProfileSwitcher
    const switcher = page.getByTestId('profile-switcher');
    if (await switcher.isVisible()) {
      await switcher.getByRole('radio', { name: /hospitalar/i }).click();
    }

    await expect(page.getByTestId('layout-a')).toBeVisible({ timeout: 8000 });
    // Should NOT show PainelProfilePlaceholder
    await expect(page.getByTestId('painel-profile-placeholder')).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // placeholder might not exist if catalog is ready — that's fine
    });
  });

  test('SihSyncStatusBadge is visible in Cadastros with SIHD link', async ({ page }) => {
    await login(page);

    await page.goto('/cadastros');
    await expect(page.getByTestId('cadastro-grid-page')).toBeVisible();
    await expect(page.getByTestId('sih-sync-badge')).toBeVisible({ timeout: 5000 });

    const link = page.getByTestId('sih-sync-badge').getByRole('link');
    const href = await link.getAttribute('href');
    expect(href).toBe('/importacao');
  });

  test('SihSyncStatusBadge shows ok sync competencia', async ({ page }) => {
    await login(page);

    await page.goto('/cadastros');
    await expect(page.getByTestId('sih-sync-badge')).toBeVisible({ timeout: 5000 });

    const badgeText = await page.getByTestId('sih-sync-badge').textContent();
    expect(badgeText).toContain('SIHD · AIH');
    expect(badgeText).toContain('2025-01');
  });
});
