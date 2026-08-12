import { expect, test } from 'playwright/test';

test.describe('owner auth callback', () => {
  test('supports direct refresh, cleans invalid parameters, and never follows external redirect', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (message) => consoleMessages.push(message.text()));

    await page.goto(
      '/auth/callback?error=access_denied&error_description=sensitive&redirect=https://evil.example',
      { waitUntil: 'commit' }
    );

    await expect(page.getByRole('heading', { name: 'Nao foi possivel confirmar seu email' })).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/callback$/);
    expect(page.url()).not.toContain('evil.example');
    expect(consoleMessages.join('\n')).not.toMatch(/access_denied|sensitive|evil\.example/);
  });
});
