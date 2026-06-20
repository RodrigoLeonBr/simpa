/**
 * E2E — multi-profile Painel and Cadastros perfil edit (PRD task_10).
 *
 * Scenarios:
 * - Painel MAC → painel-profile-placeholder (no APS KPI grid)
 * - Painel APS → layout-a/b/c switcher smoke
 * - Cadastros → drawer → change perfil → toast + list filter chip
 *
 * Requires docker test stack on :8080, admin seed, and seed-e2e-estabelecimentos.
 */
import { expect, test } from '@playwright/test';
import { login, openEstabelecimentos } from './helpers';

const E2E_CODIGO = 'E2E001';

test.describe('Painel multi-profile', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('MAC profile shows placeholder instead of APS KPI grid', async ({ page }) => {
    await page.getByTestId('profile-switch-mac').click();

    await expect(page.getByTestId('painel-profile-placeholder')).toBeVisible();
    await expect(page.getByText(/Indicadores em definição/i)).toBeVisible();
    await expect(page.getByTestId('layout-a')).not.toBeVisible();
    await expect(page.getByTestId('layout-b')).not.toBeVisible();
  });

  test('APS profile shows painel page and layouts A/B/C', async ({ page }) => {
    await expect(page.getByTestId('painel-page')).toBeVisible();
    await expect(page.getByTestId('profile-switch-aps')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('layout-a')).toBeVisible();

    await page.getByTestId('layout-switch-b').click();
    await expect(page.getByTestId('layout-b')).toBeVisible();
    await expect(page.getByText(/Atendimentos individuais/i)).toBeVisible();

    await page.getByTestId('layout-switch-c').click();
    await expect(page.getByTestId('layout-c')).toBeVisible();
  });
});

test.describe('Cadastros perfil edit', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await openEstabelecimentos(page);
  });

  test('change perfil in drawer updates dedicated E2E row and filter chip', async ({
    page,
  }) => {
    const table = page.getByTestId('cadastro-readonly-table');
    const targetRow = table.locator('tbody tr').filter({ hasText: E2E_CODIGO });
    await expect(targetRow).toBeVisible({ timeout: 30_000 });

    const initialPerfil = (await targetRow.locator('td').nth(2).innerText()).trim();
    const targetPerfil = initialPerfil === 'APS' ? 'MAC' : 'APS';

    await targetRow.click();
    await expect(page.getByTestId('estabelecimento-detail-drawer')).toBeVisible();

    const perfilSelect = page.getByTestId('estabelecimento-perfil-select');
    await expect(perfilSelect).toBeVisible();

    const updatePerfil = page.waitForResponse(
      (response) =>
        response.url().includes('/estabelecimentos/') &&
        response.url().includes('/perfil') &&
        response.request().method() === 'PUT' &&
        response.ok(),
    );

    await perfilSelect.selectOption(targetPerfil);
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    await updatePerfil;

    await expect(page.getByTestId('toast-banner')).toContainText(/Perfil atualizado/i);
    await expect(perfilSelect).toHaveValue(targetPerfil);

    await page.getByRole('button', { name: 'Fechar' }).click();
    await expect(page.getByTestId('estabelecimento-detail-drawer')).not.toBeVisible();

    await page.getByTestId(`perfil-chip-${targetPerfil}`).click();
    const filteredRow = table.locator('tbody tr').filter({ hasText: E2E_CODIGO });
    await expect(filteredRow).toBeVisible();
    await expect(filteredRow.locator('td').nth(2)).toHaveText(targetPerfil);

    await filteredRow.click();
    await expect(page.getByTestId('estabelecimento-detail-drawer')).toBeVisible();

    const restorePerfil = page.waitForResponse(
      (response) =>
        response.url().includes('/estabelecimentos/') &&
        response.url().includes('/perfil') &&
        response.request().method() === 'PUT' &&
        response.ok(),
    );

    await perfilSelect.selectOption(initialPerfil);
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    await restorePerfil;

    await page.getByRole('button', { name: 'Fechar' }).click();

    await page.getByTestId(`perfil-chip-${initialPerfil}`).click();
    const restoredRow = table.locator('tbody tr').filter({ hasText: E2E_CODIGO });
    await expect(restoredRow.locator('td').nth(2)).toHaveText(initialPerfil);
  });
});
