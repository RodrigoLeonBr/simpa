/**
 * E2E — cadastro widget edit reflected on Painel Layout A (task_17).
 *
 * Selectors (data-testid):
 * - cadastro-card-indicadores-painel, indicadores-painel-page, indicadores-painel-table
 * - form-dialog, toast-banner
 * - layout-a, kpi-card-{slug} (first card: kpi-card-atendimentos)
 *
 * Requires docker test stack on :8080 and admin seed (planning staff via Administrador).
 */
import { expect, test } from '@playwright/test';
import { login, openIndicadoresPainel } from './helpers';

const SEED_WIDGET_SLUG = 'atendimentos';
const SEED_WIDGET_TITLE = 'Atendimentos individuais';

async function editFirstWidgetTitle(page: import('@playwright/test').Page, titulo: string) {
  const table = page.getByTestId('indicadores-painel-table');
  const firstRow = table.locator('tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 30_000 });

  await firstRow.getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByTestId('form-dialog')).toBeVisible();

  const tituloInput = page.getByRole('textbox', { name: 'Título', exact: true });
  await expect(tituloInput).toBeVisible();
  await tituloInput.fill(titulo);

  const updateResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/cadastros/painel-widgets/') &&
      response.request().method() === 'PUT' &&
      response.ok(),
    { timeout: 30_000 },
  );

  await page.getByRole('button', { name: 'Salvar' }).click();
  await updateResponse;
  await expect(page.getByTestId('form-dialog')).not.toBeVisible();
}

test.describe('Painel widgets cadastro → Painel', () => {
  let restoreTitle: string | null = null;

  test.beforeEach(async ({ page }) => {
    restoreTitle = null;
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    if (!restoreTitle) return;

    try {
      await openIndicadoresPainel(page);
      await editFirstWidgetTitle(page, restoreTitle);
    } catch {
      // Best-effort cleanup; do not mask the primary assertion failure.
    } finally {
      restoreTitle = null;
    }
  });

  test('planning staff edits widget title and Layout A shows updated KpiCard label', async ({
    page,
  }) => {
    const uniqueTitle = `E2E Widget ${Date.now()}`;
    restoreTitle = SEED_WIDGET_TITLE;

    await openIndicadoresPainel(page);
    await expect(page.getByTestId('indicadores-painel-table')).toBeVisible();
    await expect(page.getByText(SEED_WIDGET_TITLE).first()).toBeVisible();

    await editFirstWidgetTitle(page, uniqueTitle);
    await expect(page.getByTestId('toast-banner')).toContainText(/Widget atualizado/i);
    await expect(page.getByTestId('indicadores-painel-table')).toContainText(uniqueTitle);

    await page.getByRole('link', { name: 'Painel' }).click();
    await expect(page.getByTestId('painel-page')).toBeVisible();
    await expect(page.getByTestId('profile-switch-aps')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('layout-a')).toBeVisible();

    const kpiCard = page.getByTestId(`kpi-card-${SEED_WIDGET_SLUG}`);
    await expect(kpiCard).toBeVisible({ timeout: 30_000 });
    await expect(kpiCard.locator('.kpi-card-label')).toHaveText(uniqueTitle);

    await openIndicadoresPainel(page);
    await editFirstWidgetTitle(page, SEED_WIDGET_TITLE);
    restoreTitle = null;
  });
});
