import { expect, type Page } from '@playwright/test';

export const ADMIN_USER = process.env.E2E_ADMIN_USER || 'admin';
export const ADMIN_PASS = process.env.E2E_ADMIN_PASS || 'simpa@2026';

export async function login(page: Page) {
  await page.goto('/login');
  await expect(page.getByTestId('login-page')).toBeVisible();
  await page.getByTestId('login-username').fill(ADMIN_USER);
  await page.getByTestId('login-password').fill(ADMIN_PASS);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('painel-page')).toBeVisible();
}

export async function openEstabelecimentos(page: Page) {
  await page.getByRole('link', { name: 'Cadastros' }).click();
  await expect(page.getByTestId('cadastro-grid-page')).toBeVisible();
  await page.getByTestId('cadastro-card-estabelecimentos').click();
  await expect(page.getByTestId('estabelecimentos-page')).toBeVisible();
}
