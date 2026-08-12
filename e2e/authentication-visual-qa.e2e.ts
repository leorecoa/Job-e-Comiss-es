import { expect, test, type Page } from 'playwright/test';

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 800 }
];

const assertNoHorizontalOverflow = async (page: Page) => {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
};

test.describe('authentication visual QA', () => {
  test('keeps login and signup accessible across required viewports without external fonts', async ({ page }) => {
    await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
    await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
    await page.route('https://e2e.supabase.test/**', (route) => route.abort());

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Painel interno' })).toBeVisible();
      await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', 'email');
      await expect(page.getByLabel('Senha')).toHaveAttribute('autocomplete', 'current-password');
      await assertNoHorizontalOverflow(page);

      await page.getByRole('button', { name: 'Criar acesso' }).click();
      await expect(page.getByLabel('Nome')).toHaveAttribute('autocomplete', 'name');
      await expect(page.getByLabel('Senha')).toHaveAttribute('autocomplete', 'new-password');
      await expect(page.getByLabel('Perfil')).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }
  });

  test('supports keyboard focus and 200 percent zoom without losing the primary action', async ({ page }) => {
    await page.route('https://e2e.supabase.test/**', (route) => route.abort());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const loginMode = page.getByLabel('Tipo de acesso').getByRole('button', { name: 'Entrar' });
    for (let step = 0; step < 8 && !(await loginMode.evaluate((element) => element === document.activeElement)); step += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(loginMode).toBeFocused();
    await page.setViewportSize({ width: 195, height: 422 });
    await expect(page.getByRole('button', { name: 'Entrar', exact: true }).last()).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
