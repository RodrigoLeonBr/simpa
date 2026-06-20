/**
 * E2E critical path: login → painel filters → import → cadastros → theme → logout.
 * Multi-profile Painel and perfil edit scenarios live in perfil-painel.spec.ts (task_10).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { login } from './helpers';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const csvFixture = path.join(
  repoRoot,
  'Relatório de atendimento individual-20260613175047.csv',
);

test.describe('SIMPA critical flow', () => {
  test('login → painel → filters → import → cadastros → theme → logout', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('login-page')).toBeVisible();

    await login(page);

    await expect(page.getByTestId('layout-a')).toBeVisible();
    await page.getByTestId('layout-switch-b').click();
    await expect(page.getByTestId('layout-b')).toBeVisible();

    const filterBar = page.getByTestId('filter-bar');
    await expect(filterBar).toBeVisible();

    const unidadeSelect = page.getByTestId('filter-unidade');
    const unidadeValues = await unidadeSelect.locator('option').evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLOptionElement).value).filter(Boolean),
    );

    if (unidadeValues.length > 0) {
      const dashboardRefetch = page.waitForResponse((response) =>
        response.url().includes('/api/v1/dashboard/planejamento'),
      );
      await unidadeSelect.selectOption(unidadeValues[0]!);
      await dashboardRefetch;

      const resetRefetch = page.waitForResponse((response) =>
        response.url().includes('/api/v1/dashboard/planejamento'),
      );
      await unidadeSelect.selectOption('');
      await resetRefetch;
    } else {
      const competenciaSelect = page.getByTestId('filter-competencia');
      const initialCompetencia = await competenciaSelect.inputValue();
      const optionValues = await competenciaSelect.locator('option').evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLOptionElement).value).filter(Boolean),
      );
      const alternate =
        optionValues.find((value) => value !== initialCompetencia) ?? optionValues[0];
      const dashboardRefetch = page.waitForResponse((response) =>
        response.url().includes('/api/v1/dashboard/planejamento'),
      );
      await competenciaSelect.selectOption(alternate!);
      await dashboardRefetch;

      const resetRefetch = page.waitForResponse((response) =>
        response.url().includes('/api/v1/dashboard/planejamento'),
      );
      await competenciaSelect.selectOption(initialCompetencia);
      await resetRefetch;
    }

    await expect(page.getByTestId('painel-page')).toBeVisible();

    await page.getByRole('link', { name: 'Importação' }).click();
    await expect(page.getByTestId('importacao-page')).toBeVisible();

    await page.getByTestId('upload-input').setInputFiles(csvFixture);
    await expect(page.getByTestId('preview-row').first()).toBeVisible({ timeout: 60_000 });

    const uploadResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/importacao/upload') &&
        (response.status() === 200 || response.status() === 201),
      { timeout: 120_000 },
    );
    await page.getByTestId('upload-process-btn').click();
    await uploadResponse;
    await expect(page.getByTestId('historico-cargas')).toBeVisible();

    await page.getByRole('link', { name: 'Cadastros' }).click();
    await expect(page.getByTestId('cadastro-grid-page')).toBeVisible();
    await expect(page.getByTestId('cadastro-sync-banner')).toBeVisible();
    await expect(page.getByTestId('cadastro-card-estabelecimentos')).toBeVisible();
    await expect(page.getByTestId('cadastro-card-procedimentos')).toBeVisible();
    await expect(page.getByTestId('cadastro-card-unidades')).toHaveCount(0);
    await expect(page.getByTestId('cadastro-card-prestadores-mac')).toHaveCount(0);
    await expect(page.getByTestId('cadastro-card-hospitais')).toHaveCount(0);

    await page.getByTestId('cadastro-card-estabelecimentos').click();
    await expect(page.getByTestId('estabelecimentos-page')).toBeVisible();

    await page.getByTestId('sidebar-theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('simpa-theme')))
      .toBe('dark');

    await page.getByRole('link', { name: 'Painel' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByTestId('topbar-logout-btn').click();
    await expect(page.getByTestId('login-form')).toBeVisible();
  });
});
