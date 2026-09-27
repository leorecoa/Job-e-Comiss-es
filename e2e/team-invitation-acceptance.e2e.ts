import { expect, test, type Page } from 'playwright/test';

const token = 'c'.repeat(64);
const userId = 'eeee0033-0000-4000-8000-000000000104';
const tenantId = 'eeee0033-0000-4000-8000-000000000001';
const barberId = 'eeee0033-0000-4000-8000-000000000010';
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'content-type': 'application/json' };

async function mockInvitation(page: Page) {
  const state = { role: 'barber', linked: false, accepts: [] as unknown[], signups: [] as any[], failAccept: false,
    failRefresh: false, release: null as Promise<void> | null, profileReads: 0, requests: [] as string[] };
  await page.route('https://**/*', (route) => route.abort());
  await page.route('https://e2e.supabase.test/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    state.requests.push(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const user = { id: userId, email: 'recipient@example.test', user_metadata: { role: state.role, display_name: 'Recipient Fixture' } };
    let data: unknown = [];
    if (url.pathname === '/auth/v1/token') data = { access_token: 'mock-access-token', refresh_token: 'mock-refresh-token', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user };
    else if (url.pathname === '/auth/v1/user') data = user;
    else if (url.pathname === '/auth/v1/signup') { state.signups.push(request.postDataJSON()); data = { user, session: null }; }
    else if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers });
    else if (url.pathname === '/rest/v1/profiles') {
      state.profileReads++;
      if (state.linked && state.failRefresh) return route.fulfill({ status: 500, headers, body: JSON.stringify({ message: 'private profile failure' }) });
      data = { id: userId, display_name: 'Recipient Fixture', role: state.role, active: true,
        barbershop_id: state.linked ? tenantId : null, barber_id: state.linked ? barberId : null };
      if (!request.headers().accept?.includes('application/vnd.pgrst.object+json')) data = [data];
    } else if (url.pathname === '/rest/v1/rpc/accept_team_invitation') {
      state.accepts.push(request.postDataJSON());
      if (state.release) await state.release;
      if (state.failAccept) return route.fulfill({ status: 400, headers, body: JSON.stringify({ code: 'P0001', message: 'TEAM_INVITATION_UNAVAILABLE', details: token, hint: token }) });
      state.linked = true;
      data = null;
    } else if (url.pathname === '/rest/v1/barbers') data = [{ id: barberId, barbershop_id: tenantId, name: 'Recipient Fixture', active: true }];
    else if (url.pathname === '/rest/v1/barbershops') data = { id: tenantId, name: 'Fixture Shop', slug: 'fixture-shop', operational_timezone: 'America/Recife' };
    await route.fulfill({ status: 200, headers, body: JSON.stringify(data) });
  });
  return state;
}

async function login(page: Page) {
  await page.getByLabel('Email', { exact: true }).fill('recipient@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click();
}

test('invitation login explicit acceptance refreshes canonical profile; mobile token privacy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mockInvitation(page);
  const logs: string[] = [];
  page.on('console', (entry) => logs.push(entry.text()));
  page.on('pageerror', (error) => logs.push(error.message));
  await page.goto(`/convite#token=${token}`);
  await expect(page).toHaveURL(/\/convite$/);
  await login(page);
  await expect(page.getByRole('button', { name: 'Aceitar convite' })).toBeVisible();
  expect(state.accepts).toEqual([]);
  expect(await page.locator('body').innerHTML()).not.toContain(token);
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(token);
  await page.getByRole('button', { name: 'Aceitar convite' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Vínculo pendente' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Agendar', exact: true })).toBeVisible();
  expect(state.accepts).toEqual([{ p_token: token }]);
  expect(state.profileReads).toBeGreaterThanOrEqual(2);
  expect(state.requests.join('\n')).not.toContain(token);
  expect(logs.join('\n')).not.toContain(token);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('invitation signup forces barber and pending confirmation requires original link', async ({ page }) => {
  const state = await mockInvitation(page);
  await page.goto(`/convite?role=owner#token=${token}`);
  await page.getByRole('button', { name: 'Criar acesso', exact: true }).click();
  await expect(page.getByLabel('Perfil', { exact: true })).toHaveCount(0);
  await page.getByLabel('Nome', { exact: true }).fill('Recipient Fixture');
  await page.getByLabel('Email', { exact: true }).fill('recipient@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Criar acesso', exact: true }).last().click();
  await expect(page.getByText(/Confirme seu e-mail e depois reabra/)).toBeVisible();
  expect(state.signups).toHaveLength(1);
  expect(state.signups[0].data.role).toBe('barber');
  expect(new URL(state.requests.find((url) => url.includes('/auth/v1/signup'))!).searchParams.get('redirect_to')).toBe('http://127.0.0.1:4173/auth/callback');
  expect(state.accepts).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(token);
  await page.reload();
  await expect(page.getByText('Link ausente ou inválido.', { exact: false })).toBeVisible();
});

test('invalid token is cleaned and never submitted', async ({ page }) => {
  const state = await mockInvitation(page);
  await page.goto(`/convite#token=${token.toUpperCase()}`);
  await expect(page).toHaveURL(/\/convite$/);
  await expect(page.getByText('Link ausente ou inválido.', { exact: false })).toBeVisible();
  expect(state.accepts).toEqual([]);
});

test('owner stays on invitation, cannot accept or be converted, can switch account', async ({ page }) => {
  const state = await mockInvitation(page);
  state.role = 'owner';
  await page.goto(`/convite#token=${token}`);
  await login(page);
  await expect(page.getByText('Esta conta é de owner.', { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/convite$/);
  await expect(page.getByRole('button', { name: 'Aceitar convite' })).toHaveCount(0);
  expect(state.accepts).toEqual([]);
  await page.getByRole('button', { name: 'Sair e trocar de conta' }).click();
  state.role = 'barber';
  await login(page);
  await expect(page.getByRole('button', { name: 'Aceitar convite' })).toBeVisible();
});

test('unavailable response is generic without token, recipient or automatic retry', async ({ page }) => {
  const state = await mockInvitation(page);
  state.failAccept = true;
  await page.goto(`/convite#token=${token}`);
  await login(page);
  await page.getByRole('button', { name: 'Aceitar convite' }).click();
  await expect(page.getByRole('alert')).toHaveText('Não foi possível concluir esta ação com o convite.');
  expect(await page.locator('body').innerHTML()).not.toContain(token);
  expect(state.accepts).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Sair e trocar de conta' })).toBeEnabled();
});

test('successful accept followed by refresh failure retries only the read', async ({ page }) => {
  const state = await mockInvitation(page);
  state.failRefresh = true;
  await page.goto(`/convite#token=${token}`);
  await login(page);
  await page.getByRole('button', { name: 'Aceitar convite' }).click();
  await expect(page.getByRole('alert')).toContainText('Vínculo concluído');
  await expect(page.getByRole('button', { name: 'Aceitar convite' })).toHaveCount(0);
  state.failRefresh = false;
  await page.getByRole('button', { name: 'Atualizar acesso' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(state.accepts).toHaveLength(1);
});

test('double click submits once; navigation invalidates a late response', async ({ page }) => {
  const state = await mockInvitation(page);
  let release!: () => void;
  state.release = new Promise<void>((resolve) => { release = resolve; });
  await page.goto(`/convite#token=${token}`);
  await login(page);
  await page.getByRole('button', { name: 'Aceitar convite' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => state.accepts.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Aceitar convite' })).toBeDisabled();
  await page.evaluate(() => { history.pushState(null, '', '/convite'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByText('Este fluxo foi encerrado.', { exact: false })).toBeVisible();
  release();
  await expect.poll(() => state.linked).toBe(true);
  await expect(page).toHaveURL(/\/convite$/);
  await expect(page.getByText('Este fluxo foi encerrado.', { exact: false })).toBeVisible();
  expect(state.accepts).toHaveLength(1);
});

test('authenticated invitation works after reopening original link, clean reload loses token', async ({ page }) => {
  const state = await mockInvitation(page);
  await page.goto(`/convite#token=${token}`);
  await login(page);
  await expect(page.getByRole('button', { name: 'Aceitar convite' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Link ausente ou inválido.', { exact: false })).toBeVisible();
  await page.goto(`/convite#token=${token}`);
  await expect(page.getByRole('button', { name: 'Aceitar convite' })).toBeVisible();
  await page.getByRole('button', { name: 'Aceitar convite' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(state.accepts).toHaveLength(1);
});

test('old acceptance cannot clear a replacement invitation or redirect its screen', async ({ page }) => {
  const state = await mockInvitation(page);
  let release!: () => void;
  state.release = new Promise<void>((resolve) => { release = resolve; });
  await page.goto(`/convite#token=${token}`);
  await login(page);
  await page.getByRole('button', { name: 'Aceitar convite' }).click();
  await expect.poll(() => state.accepts.length).toBe(1);
  const replacement = 'd'.repeat(64);
  await page.goto(`/convite#token=${replacement}`);
  await expect(page.getByRole('button', { name: 'Aceitar convite' })).toBeEnabled();
  release();
  await expect.poll(() => state.linked).toBe(true);
  await expect(page).toHaveURL(/\/convite$/);
  await page.getByRole('button', { name: 'Aceitar convite' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(state.accepts).toEqual([{ p_token: token }, { p_token: replacement }]);
});

test('external signout invalidates token, explicit exit abandons the flow', async ({ page }) => {
  const state = await mockInvitation(page);
  await page.goto(`/convite#token=${token}`);
  await login(page);
  await expect(page.getByRole('button', { name: 'Aceitar convite' })).toBeVisible();
  await page.evaluate(async () => {
    const modulePath = '/lib/supabase.ts';
    const { supabase } = await import(modulePath);
    await supabase.auth.signOut();
  });
  await expect(page.getByText('Este fluxo foi encerrado.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aceitar convite' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sair do convite' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(state.accepts).toEqual([]);
});
