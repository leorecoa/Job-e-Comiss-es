import { expect, test, type Route } from 'playwright/test';

const SUPABASE_URL = 'https://e2e.supabase.test';

const fulfillJson = async (route: Route, status: number, body: unknown) => {
  await route.fulfill({
    status,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': '*',
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
};

test.describe('public barber signup entry point', () => {
  test('forces barber signup and ignores role manipulation', async ({ page }) => {
    const signupBodies: Array<Record<string, unknown>> = [];
    const signupRedirects: Array<string | undefined> = [];

    await page.route(`${SUPABASE_URL}/**`, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        return;
      }
      if (url.pathname === '/auth/v1/signup') {
        signupBodies.push(request.postDataJSON() as Record<string, unknown>);
        signupRedirects.push(url.searchParams.get('redirect_to') ?? undefined);
        await fulfillJson(route, 200, {
          user: {
            id: '8352cfec-3070-4cbe-b9ef-6fbabca12f0c',
            email: 'barber@example.com',
            user_metadata: { role: 'barber', display_name: 'Leo Barber' }
          },
          session: null
        });
        return;
      }
      await fulfillJson(route, 401, { message: 'No active session' });
    });

    await page.goto('/cadastro/barbeiro?role=owner#role=owner');
    await expect(page.getByRole('button', { name: 'Criar acesso', exact: true }).last()).toBeVisible();
    await expect(page.getByText('Este cadastro cria um acesso de barbeiro.')).toBeVisible();
    await expect(page.getByLabel('Perfil')).toHaveCount(0);
    await page.getByLabel('Nome').fill('Leo Barber');
    await page.getByLabel('Email').fill('barber@example.com');
    await page.getByLabel('Senha').fill('secret123');
    await page.getByRole('button', { name: 'Criar acesso', exact: true }).last().click();

    await expect(page.getByRole('alert')).toContainText('Cadastro criado. Confirme seu email antes de entrar.');
    expect(signupBodies).toHaveLength(1);
    expect(signupBodies[0]).toMatchObject({
      email: 'barber@example.com',
      data: { display_name: 'Leo Barber', role: 'barber' }
    });
    expect(JSON.stringify(signupBodies[0])).not.toContain('owner');
    expect(signupRedirects[0]).toBe('http://127.0.0.1:4173/auth/callback');
  });
});
