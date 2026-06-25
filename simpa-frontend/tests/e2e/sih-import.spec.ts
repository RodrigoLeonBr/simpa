/**
 * E2E: SIHD importation section on /importacao page.
 * API calls are mocked via page.route() so tests run without a live MySQL/SIHD server.
 */
import { expect, test } from '@playwright/test';
import { login } from './helpers';

const SYNC_RESULT = {
  sincronizacao_id: 1,
  competencia: '2025-01-01',
  status: 'ok',
  qtd_internacoes: 42,
  qtd_procedimentos: 110,
  orphan_cnes: 1,
  erros: 0,
  consolidacao: { ok: true },
};

const HISTORY = [
  {
    id: 1,
    competencia: '2025-01-01',
    status: 'ok',
    qtd_internacoes: 42,
    qtd_procedimentos: 110,
    orphan_cnes: 1,
    erros: 0,
    sincronizado_em: '2025-02-01T10:00:00Z',
  },
];

test.describe('SIHD import section', () => {
  test.beforeEach(async ({ page }) => {
    // Mock SIHD history — empty initially
    await page.route('**/api/sih/sincronizacoes', (route) =>
      route.fulfill({ json: [] }),
    );
    // Mock sync endpoint
    await page.route('**/api/sih/sincronizar', (route) =>
      route.fulfill({ json: SYNC_RESULT }),
    );
  });

  test('navigates to /importacao and finds SIHD section', async ({ page }) => {
    await login(page);

    await page.goto('/importacao');
    await expect(page.getByTestId('sih-import-section')).toBeVisible();
    await expect(page.getByTestId('sih-import-competencia')).toBeVisible();
    await expect(page.getByTestId('sih-import-btn')).toBeVisible();
  });

  test('input type=month has YYYY-MM default value', async ({ page }) => {
    await login(page);
    await page.goto('/importacao');

    const input = page.getByTestId('sih-import-competencia');
    const value = await input.inputValue();
    expect(value).toMatch(/^\d{4}-\d{2}$/);
  });

  test('successful import shows toast with internacoes count', async ({ page }) => {
    await login(page);
    await page.goto('/importacao');

    await page.getByTestId('sih-import-btn').click();

    await expect(page.getByTestId('toast-banner')).toBeVisible({ timeout: 8000 });
    const toastText = await page.getByTestId('toast-banner').textContent();
    expect(toastText).toContain('42 internações');
  });

  test('second import of same competencia shows ConfirmDialog with substitute text', async ({
    page,
  }) => {
    // First call: returns 409-like response → mock as 409
    let callCount = 0;
    await page.route('**/api/sih/sincronizar', (route) => {
      callCount++;
      if (callCount === 1) {
        return route.fulfill({
          status: 409,
          json: {
            code: 'SIH_COMPETENCIA_JA_IMPORTADA',
            competencia: '2025-01',
            sincronizado_em: '2025-02-01T10:00:00Z',
            qtd_internacoes: 42,
            qtd_procedimentos: 110,
          },
        });
      }
      return route.fulfill({ json: SYNC_RESULT });
    });

    await login(page);
    await page.goto('/importacao');

    await page.getByTestId('sih-import-btn').click();

    // ConfirmDialog should appear
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    const dialogText = await page.getByRole('dialog').textContent();
    expect(dialogText?.toLowerCase()).toMatch(/substitu/i);
  });

  test('ConfirmDialog cancel does not trigger second API call', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/sih/sincronizar', (route) => {
      callCount++;
      return route.fulfill({
        status: 409,
        json: {
          code: 'SIH_COMPETENCIA_JA_IMPORTADA',
          competencia: '2025-01',
          qtd_internacoes: 42,
          qtd_procedimentos: 110,
        },
      });
    });

    await login(page);
    await page.goto('/importacao');

    await page.getByTestId('sih-import-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /cancelar/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });

    expect(callCount).toBe(1);
  });

  test('ConfirmDialog confirm triggers reimport call', async ({ page }) => {
    let callCount = 0;
    const calls: string[] = [];

    await page.route('**/api/sih/sincronizar', async (route) => {
      callCount++;
      const body = JSON.parse((await route.request().postData()) ?? '{}') as {
        reimportar?: boolean;
      };
      calls.push(body.reimportar ? 'reimportar' : 'normal');

      if (callCount === 1) {
        return route.fulfill({
          status: 409,
          json: {
            code: 'SIH_COMPETENCIA_JA_IMPORTADA',
            competencia: '2025-01',
            qtd_internacoes: 42,
            qtd_procedimentos: 110,
          },
        });
      }
      return route.fulfill({ json: SYNC_RESULT });
    });

    await login(page);
    await page.goto('/importacao');

    await page.getByTestId('sih-import-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('confirm-dialog-action').click();

    await expect(page.getByTestId('toast-banner')).toBeVisible({ timeout: 8000 });
    expect(calls).toContain('reimportar');
  });

  test('MySQL unavailable shows PT-BR error message', async ({ page }) => {
    await page.route('**/api/sih/sincronizar', (route) =>
      route.fulfill({
        status: 503,
        json: {
          code: 'SIH_MYSQL_UNAVAILABLE',
          message: 'Banco SIHD (XAMPP) indisponível. Verifique a conexão e tente novamente.',
        },
      }),
    );

    await login(page);
    await page.goto('/importacao');

    await page.getByTestId('sih-import-btn').click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 });
    const alertText = await page.getByRole('alert').textContent();
    expect(alertText).toMatch(/XAMPP/i);
    expect(alertText).toMatch(/indisponível/i);
  });
});
