import { expect, test, type Page, type Route } from 'playwright/test';

const SUPABASE_URL = 'https://e2e.supabase.test';
const OWNER_BARBERSHOP_ID = '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce';
const OTHER_BARBERSHOP_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_USER_ID = '8352cfec-3070-4cbe-b9ef-6fbabca12f0c';
const OWNER_EMAIL = 'owner@example.com';
const OWNER_PASSWORD = 'secret123';
const OWNER_DISPLAY_NAME = 'Leo Owner';
const OWNER_BARBER_ID = '252b5551-b8e7-4693-ab07-d0bbfde6ec05';
const OWNER_SERVICE_ID = '8b8a04ef-fd1d-40c9-98e1-c052345cf4b8';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': '*',
  'content-type': 'application/json'
};

type MockProfile = {
  id: string;
  display_name: string | null;
  role: 'owner' | 'barber';
  active: boolean;
  barbershop_id: string | null;
  barber_id: string | null;
};

type MockBarbershop = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  description: string | null;
  instagram_url: string | null;
  whatsapp: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  business_hours: Record<string, { active: boolean; open: string; close: string }> | null;
  slot_step_minutes: number | null;
  active: boolean;
};

type MockBarber = {
  id: string;
  name: string;
  barbershop_id: string;
  active: boolean;
};

type MockService = {
  id: string;
  name: string;
  barbershop_id: string;
  price: number;
  duration_minutes: number;
  commission_rate: number;
  active: boolean;
};

type MockAppointment = {
  id: string;
  barbershop_id: string;
  client_name: string;
  client_phone: string;
  barber_id: string;
  barber_name: string;
  service_id: string;
  service_type: string;
  service_value: number;
  start_at: string;
  end_at: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  financial_record_id: string | null;
  created_at: string;
  updated_at: string;
};

type MockFinancialRecord = {
  id: string;
  appointment_id: string;
  barbershop_id: string;
  barber_id: string | null;
  service_id: string | null;
  service_type: string;
  service_value: number;
  commission_rate: number;
  commission_value: number;
  completed_at: string;
  created_at: string;
};

type CapturedRequest = {
  method: string;
  url: string;
  body: unknown;
};

type MockRpcResponse = {
  status: number;
  body: unknown;
};

type MockScenario = {
  profile?: MockProfile;
  barbershops?: MockBarbershop[];
  barbers?: MockBarber[];
  services?: MockService[];
  appointments?: MockAppointment[];
  financialRecords?: MockFinancialRecord[];
  rpcResponse?: MockRpcResponse;
  completionRpcResponse?: MockRpcResponse;
};

const ownerBusinessHours = {
  sunday: { active: false, open: '09:00', close: '18:00' },
  monday: { active: true, open: '09:00', close: '18:00' },
  tuesday: { active: true, open: '09:00', close: '18:00' },
  wednesday: { active: true, open: '09:00', close: '18:00' },
  thursday: { active: true, open: '09:00', close: '18:00' },
  friday: { active: true, open: '09:00', close: '18:00' },
  saturday: { active: true, open: '09:00', close: '16:00' }
};

const ownerBarbershop: MockBarbershop = {
  id: OWNER_BARBERSHOP_ID,
  name: 'leo do leo',
  slug: 'leo-do-leo',
  phone: '81999999999',
  address: 'Rua do Leo, 123',
  logo_url: null,
  cover_image_url: null,
  description: 'Barbearia do tenant leo do leo.',
  instagram_url: 'https://instagram.com/leo-do-leo',
  whatsapp: '81999999999',
  primary_color: '#f59e0b',
  secondary_color: '#0ea5e9',
  business_hours: ownerBusinessHours,
  slot_step_minutes: 30,
  active: true
};

const otherBarbershop: MockBarbershop = {
  id: OTHER_BARBERSHOP_ID,
  name: 'Gestao Maxima',
  slug: 'gestao-maxima',
  phone: '81888888888',
  address: 'Rua Central, 1',
  logo_url: null,
  cover_image_url: null,
  description: 'Nao deve aparecer para o tenant owner.',
  instagram_url: null,
  whatsapp: null,
  primary_color: '#6366f1',
  secondary_color: '#22c55e',
  business_hours: ownerBusinessHours,
  slot_step_minutes: 30,
  active: true
};

const toEqValue = (value: string | null): string | null => {
  if (!value) return value;
  return value.startsWith('eq.') ? decodeURIComponent(value.slice(3)) : decodeURIComponent(value);
};

const parseRequestBody = (route: Route): unknown => {
  const body = route.request().postData();
  if (!body) return null;

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};

const fulfillJson = async (route: Route, status: number, body: unknown) => {
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    body: JSON.stringify(body)
  });
};

const getTodayString = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildLocalIso = (dateInput: string, timeInput: string): string => {
  return new Date(`${dateInput}T${timeInput}:00-03:00`).toISOString();
};

const makeAppointmentRow = ({
  id,
  clientName,
  barberId,
  barberName,
  barbershopId,
  date,
  time
}: {
  id: string;
  clientName: string;
  barberId: string;
  barberName: string;
  barbershopId: string;
  date: string;
  time: string;
}): MockAppointment => {
  const startAt = buildLocalIso(date, time);
  const endDate = new Date(startAt);
  endDate.setMinutes(endDate.getMinutes() + 30);

  return {
    id,
    barbershop_id: barbershopId,
    client_name: clientName,
    client_phone: '85999999999',
    barber_id: barberId,
    barber_name: barberName,
    service_id: OWNER_SERVICE_ID,
    service_type: 'Corte Leo',
    service_value: 60,
    start_at: startAt,
    end_at: endDate.toISOString(),
    status: 'scheduled',
    notes: null,
    financial_record_id: null,
    created_at: startAt,
    updated_at: startAt
  };
};

const installOwnerSupabaseMocks = async (page: Page, scenario: MockScenario = {}) => {
  const today = getTodayString();

  const profile: MockProfile = scenario.profile ?? {
    id: OWNER_USER_ID,
    display_name: OWNER_DISPLAY_NAME,
    role: 'owner',
    active: true,
    barbershop_id: OWNER_BARBERSHOP_ID,
    barber_id: null
  };

  const barbershops: MockBarbershop[] = scenario.barbershops ?? [
    ownerBarbershop,
    otherBarbershop
  ];

  const barbers: MockBarber[] = scenario.barbers ?? [
    { id: OWNER_BARBER_ID, name: 'Leo Barber', barbershop_id: OWNER_BARBERSHOP_ID, active: true },
    { id: '6a1c35f2-deec-4528-82dc-10dccb601e56', name: 'Barbeiro Gestao', barbershop_id: OTHER_BARBERSHOP_ID, active: true }
  ];

  const services: MockService[] = scenario.services ?? [
    { id: OWNER_SERVICE_ID, name: 'Corte Leo', barbershop_id: OWNER_BARBERSHOP_ID, price: 60, duration_minutes: 30, commission_rate: 50, active: true },
    { id: '4cbf9f97-598a-4574-8c72-95c94ec0aba5', name: 'Servico Gestao', barbershop_id: OTHER_BARBERSHOP_ID, price: 90, duration_minutes: 45, commission_rate: 45, active: true }
  ];

  const appointments: MockAppointment[] = scenario.appointments ?? [
    makeAppointmentRow({
      id: 'appointment-owner-tenant',
      clientName: 'Cliente Leo',
      barberId: OWNER_BARBER_ID,
      barberName: 'Leo Barber',
      barbershopId: OWNER_BARBERSHOP_ID,
      date: today,
      time: '09:00'
    }),
    makeAppointmentRow({
      id: 'appointment-other-tenant',
      clientName: 'Cliente Gestao',
      barberId: '6a1c35f2-deec-4528-82dc-10dccb601e56',
      barberName: 'Barbeiro Gestao',
      barbershopId: OTHER_BARBERSHOP_ID,
      date: today,
      time: '10:00'
    })
  ];
  const financialRecords = scenario.financialRecords ?? [];

  const rpcResponse: MockRpcResponse = scenario.rpcResponse ?? {
    status: 200,
    body: [{
      profile_id: '177e1e46-8f6c-4fe0-a31f-b0ce1c40f170',
      display_name: 'Leo Barber',
      role: 'barber',
      active: true,
      barbershop_id: OWNER_BARBERSHOP_ID,
      barber_id: OWNER_BARBER_ID
    }]
  };

  const signInRequests: CapturedRequest[] = [];
  const barbershopRequests: string[] = [];
  const barberRequests: string[] = [];
  const serviceRequests: string[] = [];
  const appointmentReadRequests: string[] = [];
  const rpcRequests: CapturedRequest[] = [];
  const completionRequests: CapturedRequest[] = [];

  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: CORS_HEADERS
      });
      return;
    }

    if (url.pathname === '/auth/v1/token') {
      signInRequests.push({
        method: request.method(),
        url: request.url(),
        body: parseRequestBody(route)
      });

      await fulfillJson(route, 200, {
        access_token: 'owner-access-token',
        refresh_token: 'owner-refresh-token',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: {
          id: OWNER_USER_ID,
          email: OWNER_EMAIL,
          user_metadata: {
            role: 'owner',
            display_name: OWNER_DISPLAY_NAME
          }
        }
      });
      return;
    }

    if (url.pathname === '/auth/v1/user') {
      await fulfillJson(route, 200, {
        id: OWNER_USER_ID,
        email: OWNER_EMAIL,
        user_metadata: {
          role: 'owner',
          display_name: OWNER_DISPLAY_NAME
        }
      });
      return;
    }

    if (url.pathname === '/rest/v1/profiles') {
      const id = toEqValue(url.searchParams.get('id'));
      const rows = id && id !== profile.id ? [] : [profile];
      const accept = request.headers()['accept'] || '';

      if (accept.includes('application/vnd.pgrst.object+json')) {
        if (rows.length === 0) {
          await fulfillJson(route, 406, {
            code: 'PGRST116',
            details: 'Results contain 0 rows, application/vnd.pgrst.object+json requires 1 row',
            hint: null,
            message: 'JSON object requested, multiple (or no) rows returned'
          });
          return;
        }

        await fulfillJson(route, 200, rows[0]);
        return;
      }

      await fulfillJson(route, 200, rows);
      return;
    }

    if (url.pathname === '/rest/v1/barbershops') {
      barbershopRequests.push(request.url());
      const id = toEqValue(url.searchParams.get('id'));
      const slug = toEqValue(url.searchParams.get('slug'));
      const active = toEqValue(url.searchParams.get('active'));
      const rows = barbershops.filter((shop) => {
        if (id && shop.id !== id) return false;
        if (slug && shop.slug !== slug) return false;
        if (active === 'true' && !shop.active) return false;
        return true;
      });
      const accept = request.headers()['accept'] || '';

      if (accept.includes('application/vnd.pgrst.object+json')) {
        if (rows.length === 0) {
          await fulfillJson(route, 406, {
            code: 'PGRST116',
            details: 'Results contain 0 rows, application/vnd.pgrst.object+json requires 1 row',
            hint: null,
            message: 'JSON object requested, multiple (or no) rows returned'
          });
          return;
        }

        await fulfillJson(route, 200, rows[0]);
        return;
      }

      await fulfillJson(route, 200, rows);
      return;
    }

    if (url.pathname === '/rest/v1/barbers') {
      barberRequests.push(request.url());
      const barbershopId = toEqValue(url.searchParams.get('barbershop_id'));
      const id = toEqValue(url.searchParams.get('id'));
      const active = toEqValue(url.searchParams.get('active'));

      const rows = barbers.filter((barber) => {
        if (barbershopId && barber.barbershop_id !== barbershopId) return false;
        if (id && barber.id !== id) return false;
        if (active === 'true' && !barber.active) return false;
        return true;
      });

      await fulfillJson(route, 200, rows);
      return;
    }

    if (url.pathname === '/rest/v1/services') {
      serviceRequests.push(request.url());
      const barbershopId = toEqValue(url.searchParams.get('barbershop_id'));
      const id = toEqValue(url.searchParams.get('id'));
      const active = toEqValue(url.searchParams.get('active'));

      const rows = services.filter((service) => {
        if (barbershopId && service.barbershop_id !== barbershopId) return false;
        if (id && service.id !== id) return false;
        if (active === 'true' && !service.active) return false;
        return true;
      });

      await fulfillJson(route, 200, rows);
      return;
    }

    if (url.pathname === '/rest/v1/appointments') {
      if (request.method() !== 'GET') {
        await fulfillJson(route, 405, { message: 'Owner e2e covers only appointment reads.' });
        return;
      }

      appointmentReadRequests.push(request.url());
      const barbershopId = toEqValue(url.searchParams.get('barbershop_id'));
      const barberId = toEqValue(url.searchParams.get('barber_id'));

      const rows = appointments.filter((appointment) => {
        if (barbershopId && appointment.barbershop_id !== barbershopId) return false;
        if (barberId && appointment.barber_id !== barberId) return false;
        return true;
      });

      await fulfillJson(route, 200, rows);
      return;
    }

    if (url.pathname === '/rest/v1/financial_records') {
      const barbershopId = toEqValue(url.searchParams.get('barbershop_id'));
      await fulfillJson(route, 200, financialRecords.filter((record) => !barbershopId || record.barbershop_id === barbershopId));
      return;
    }

    if (url.pathname === '/rest/v1/rpc/complete_appointment_with_financial_record') {
      const body = parseRequestBody(route) as { p_appointment_id?: string };
      completionRequests.push({ method: request.method(), url: request.url(), body });
      if (scenario.completionRpcResponse) {
        await fulfillJson(route, scenario.completionRpcResponse.status, scenario.completionRpcResponse.body);
        return;
      }

      const appointment = appointments.find((item) => item.id === body.p_appointment_id);
      if (!appointment) {
        await fulfillJson(route, 404, { message: 'FINANCIAL_COMPLETION_APPOINTMENT_NOT_FOUND' });
        return;
      }
      const financialId = appointment.financial_record_id || '7d78c751-94d7-4788-a1bd-93475cf9e274';
      appointment.status = 'completed';
      appointment.financial_record_id = financialId;
      if (!financialRecords.some((record) => record.appointment_id === appointment.id)) {
        financialRecords.push({
          id: financialId,
          appointment_id: appointment.id,
          barbershop_id: appointment.barbershop_id,
          barber_id: appointment.barber_id,
          service_id: appointment.service_id,
          service_type: appointment.service_type,
          service_value: appointment.service_value,
          commission_rate: 50,
          commission_value: 30,
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
      }
      await fulfillJson(route, 200, [{ appointment_id: appointment.id, financial_record_id: financialId }]);
      return;
    }

    if (url.pathname === '/rest/v1/rpc/link_barber_profile_by_email') {
      rpcRequests.push({
        method: request.method(),
        url: request.url(),
        body: parseRequestBody(route)
      });

      await fulfillJson(route, rpcResponse.status, rpcResponse.body);
      return;
    }

    await fulfillJson(route, 404, { message: `Unhandled mock path: ${url.pathname}` });
  });

  return {
    signInRequests,
    barbershopRequests,
    barberRequests,
    serviceRequests,
    appointmentReadRequests,
    rpcRequests,
    completionRequests
  };
};

const signInAsOwner = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hasSeenTour', 'true');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Painel interno/i })).toBeVisible();
  await page.locator('label').filter({ hasText: 'Email' }).locator('xpath=following-sibling::input').fill(OWNER_EMAIL);
  await page.locator('label').filter({ hasText: 'Senha' }).locator('xpath=following-sibling::input').fill(OWNER_PASSWORD);
  await page.locator('form button[type="submit"]').click();
};

const openOwnerManagement = async (page: Page) => {
  await page.getByRole('navigation', { name: 'Secoes do painel', exact: true })
    .getByRole('button', { name: 'Gestao' })
    .click();
};

test.describe('owner operational dashboard e2e', () => {
  test('financial completion persists after reload and remote failure creates no phantom record', async ({ page, browser }) => {
    const network = await installOwnerSupabaseMocks(page);
    await signInAsOwner(page);

    await page.getByRole('button', { name: 'Concluir' }).first().click();
    await expect(page.getByText('Agendamento concluido e financeiro lancado!')).toBeVisible();
    expect(network.completionRequests).toHaveLength(1);

    await page.getByRole('button', { name: 'Clientes' }).click();
    await expect(page.getByRole('cell', { name: /Cliente Leo/ }).first()).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Clientes' }).click();
    await expect(page.getByRole('cell', { name: /Cliente Leo/ }).first()).toBeVisible();

    const failedContext = await browser.newContext();
    const failedPage = await failedContext.newPage();
    const failedNetwork = await installOwnerSupabaseMocks(failedPage, {
      completionRpcResponse: {
        status: 400,
        body: { message: 'forced financial failure' }
      }
    });
    await signInAsOwner(failedPage);
    await failedPage.getByRole('button', { name: 'Concluir' }).first().click();
    await expect(failedPage.getByText(/Nao foi possivel concluir o agendamento e salvar o financeiro/)).toBeVisible();
    await failedPage.getByRole('button', { name: 'Clientes' }).click();
    await expect(failedPage.getByRole('cell', { name: /Cliente Leo/ })).toHaveCount(0);
    expect(failedNetwork.completionRequests).toHaveLength(1);
    await failedContext.close();
  });

  test('owner sees only own tenant data, operational checklist, and public booking link', async ({ page }) => {
    const network = await installOwnerSupabaseMocks(page);

    await signInAsOwner(page);

    await expect(page.getByText('leo do leo', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Prontidao operacional/i, includeHidden: true })).toBeHidden();
    await expect(page.getByRole('heading', { name: /Catalogo operacional/i, includeHidden: true })).toBeHidden();
    await openOwnerManagement(page);
    await expect(page.getByRole('heading', { name: /Prontidao operacional/i })).toBeVisible();
    await expect(page.getByText(/Booking pronto para receber agendamentos\./i)).toBeVisible();
    await expect(page.getByText('/book/leo-do-leo')).toBeVisible();
    await expect(page.getByRole('link', { name: /Abrir link/i })).toHaveAttribute('href', '/book/leo-do-leo');

    await expect(page.getByRole('heading', { name: /Catalogo operacional/i })).toBeVisible();
    await expect(page.locator('input[value="Leo Barber"]').first()).toBeVisible();
    await expect(page.locator('input[value="Corte Leo"]').first()).toBeVisible();
    await page.getByRole('navigation', { name: 'Secoes do painel', exact: true }).getByRole('button', { name: 'Agenda' }).click();
    await expect(page.getByText('Cliente Leo')).toBeVisible();

    await expect(page.getByText(/Gest[aã]o M[aá]xima/i)).toHaveCount(0);
    await expect(page.getByText('Barbeiro Gestao')).toHaveCount(0);
    await expect(page.getByText('Servico Gestao')).toHaveCount(0);
    await expect(page.getByText('Cliente Gestao')).toHaveCount(0);

    expect(network.signInRequests).toHaveLength(1);
    expect(network.barbershopRequests.some((url) => url.includes(`id=eq.${OWNER_BARBERSHOP_ID}`))).toBeTruthy();
    expect(network.barberRequests.some((url) => url.includes(`barbershop_id=eq.${OWNER_BARBERSHOP_ID}`))).toBeTruthy();
    expect(network.serviceRequests.some((url) => url.includes(`barbershop_id=eq.${OWNER_BARBERSHOP_ID}`))).toBeTruthy();
    expect(network.appointmentReadRequests.some((url) => url.includes(`barbershop_id=eq.${OWNER_BARBERSHOP_ID}`))).toBeTruthy();
    expect(network.appointmentReadRequests.every((url) => !url.includes(`barbershop_id=eq.${OTHER_BARBERSHOP_ID}`))).toBeTruthy();
  });

  test('owner management workspace is responsive and returns to the agenda', async ({ page }) => {
    await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installOwnerSupabaseMocks(page);
    await signInAsOwner(page);
    await openOwnerManagement(page);

    await expect(page.getByRole('heading', { name: 'Gestao da barbearia' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Grupos da gestao' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Configuracoes da barbearia/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Vincular barbeiro a usuario/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Catalogo operacional/i })).toBeVisible();
    await page.getByLabel('Nome da barbearia').fill('Nome em edicao nao salvo');

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 360, height: 800 }
    ]) {
      await page.setViewportSize(viewport);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      await expect(page.getByRole('link', { name: 'Presenca publica' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Salvar aparencia/i })).toBeVisible();
    }

    await page.setViewportSize({ width: 390, height: 844 });

    await page.getByRole('button', { name: 'Abrir navegacao' }).click();
    const mobileNavigation = page.getByRole('complementary', { name: 'Navegacao mobile' });
    await mobileNavigation.getByRole('button', { name: 'Agenda' }).click();
    await expect(page.getByRole('heading', { name: 'Agenda do dia' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gestao da barbearia', includeHidden: true })).toBeHidden();

    await page.setViewportSize({ width: 195, height: 422 });
    await page.getByRole('button', { name: 'Abrir navegacao' }).click();
    await page.getByRole('complementary', { name: 'Navegacao mobile' }).getByRole('button', { name: 'Gestao' }).click();
    await expect(page.getByLabel('Nome da barbearia')).toHaveValue('Nome em edicao nao salvo');
    const zoomDimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(zoomDimensions.scrollWidth).toBeLessThanOrEqual(zoomDimensions.clientWidth + 1);
  });

  test('owner shell keeps navigation accessible and responsive', async ({ page }) => {
    await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installOwnerSupabaseMocks(page);
    await signInAsOwner(page);

    const desktopNavigation = page.getByRole('navigation', { name: 'Secoes do painel', exact: true });
    await expect(page.getByRole('main')).toBeVisible();
    await expect(desktopNavigation.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page');
    await desktopNavigation.getByRole('button', { name: 'Clientes' }).click();
    await expect(page.getByRole('heading', { name: 'Clientes', exact: true })).toBeVisible();
    await expect(desktopNavigation.getByRole('button', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page');
    await desktopNavigation.getByRole('button', { name: 'Relatorios' }).click();
    await expect(page.getByRole('heading', { name: 'Relatorios', exact: true })).toBeVisible();

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 360, height: 800 }
    ]) {
      await page.setViewportSize(viewport);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      await expect(page.getByRole('heading', { name: 'Relatorios', exact: true })).toBeVisible();
    }

    await page.getByRole('button', { name: 'Abrir navegacao' }).click();
    const mobileNavigation = page.getByRole('complementary', { name: 'Navegacao mobile' });
    await expect(mobileNavigation).toBeVisible();
    await expect(mobileNavigation.getByRole('button', { name: 'Sair' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(mobileNavigation).toBeHidden();
    await expect(page.getByRole('button', { name: 'Abrir navegacao' })).toBeFocused();

    await page.setViewportSize({ width: 195, height: 422 });
    const zoomDimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(zoomDimensions.scrollWidth).toBeLessThanOrEqual(zoomDimensions.clientWidth + 1);
    await expect(page.getByRole('button', { name: 'Abrir navegacao' })).toBeVisible();
  });

  test('owner scheduling workspace keeps date, filter and appointments usable across viewports', async ({ page }) => {
    await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installOwnerSupabaseMocks(page);
    await signInAsOwner(page);

    await expect(page.getByRole('heading', { name: 'Agenda do dia' })).toBeVisible();
    const initialDate = await page.getByLabel('Data da agenda').inputValue();
    await expect(page.getByLabel('Barbeiro', { exact: true })).toBeVisible();
    await expect(page.getByText('Cliente Leo')).toBeVisible();
    await expect(page.getByText('Agendado', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Dia anterior' }).click();
    await expect(page.getByLabel('Data operacional')).not.toHaveValue(initialDate);
    await page.getByRole('button', { name: 'Proximo dia' }).click();
    await expect(page.getByLabel('Data operacional')).toHaveValue(initialDate);

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 360, height: 800 }
    ]) {
      await page.setViewportSize(viewport);
      const dimensions = await page.locator('.ui-schedule').evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      await expect(page.getByLabel('Data da agenda')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Agendar', exact: true }).last()).toBeVisible();
      await expect(page.getByText('Cliente Leo')).toBeVisible();
    }

    await page.setViewportSize({ width: 390, height: 844 });

    await page.setViewportSize({ width: 195, height: 422 });
    const zoomDimensions = await page.locator('.ui-schedule').evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    }));
    expect(zoomDimensions.scrollWidth).toBeLessThanOrEqual(zoomDimensions.clientWidth + 1);
    await expect(page.getByLabel('Data da agenda')).toBeVisible();
  });

  test('owner links a barber profile by email through the tenant-scoped RPC', async ({ page }) => {
    const network = await installOwnerSupabaseMocks(page);

    await signInAsOwner(page);
    await openOwnerManagement(page);

    await expect(page.getByRole('heading', { name: /Vincular barbeiro a usuario/i })).toBeVisible();
    await expect(page.getByText(/O barbeiro cria uma conta usando o e-mail dele/i)).toBeVisible();
    await expect(page.getByText(/Este fluxo nao envia convite automatico por e-mail/i)).toBeVisible();
    await expect(page.getByText(OWNER_BARBER_ID)).toHaveCount(0);
    await page.getByPlaceholder('E-mail da conta do barbeiro').fill('  BARBER@EXAMPLE.COM  ');
    const linkButton = page.getByRole('button', { name: /Vincular usuario/i });
    await expect(linkButton).toBeEnabled();
    await linkButton.evaluate((button: HTMLButtonElement) => button.click());

    await expect.poll(() => network.rpcRequests.length).toBe(1);
    await expect(page.getByText(/Conta vinculada ao profissional Leo Barber/i)).toBeVisible();
    await expect(page.getByText(/E-mail usado: barber@example\.com/i)).toBeVisible();
    await expect(page.getByText(/sair e entrar novamente/i)).toBeVisible();

    const [{ method, body }] = network.rpcRequests;
    expect(method).toBe('POST');
    expect(body).toMatchObject({
      p_target_email: 'barber@example.com',
      p_target_barber_id: OWNER_BARBER_ID
    });
  });

  for (const { code, message } of [
    {
      code: 'TARGET_USER_NOT_FOUND',
      message: 'Nenhuma conta foi encontrada com este e-mail. Peca para o barbeiro criar a conta primeiro e tente novamente.'
    },
    {
      code: 'BARBER_NOT_IN_TENANT',
      message: 'O profissional selecionado nao pertence a esta barbearia.'
    },
    {
      code: 'TARGET_PROFILE_BELONGS_TO_ANOTHER_TENANT',
      message: 'Esta conta ja esta vinculada a outra barbearia.'
    },
    {
      code: 'TARGET_PROFILE_IS_OWNER',
      message: 'Esta conta e de owner e nao pode ser vinculada como barbeiro.'
    },
    {
      code: 'TARGET_USER_CANNOT_BE_OWNER',
      message: 'Use uma conta separada para o barbeiro. Uma conta de owner nao deve ser usada como perfil de atendimento.'
    }
  ]) {
    test(`owner sees friendly linking error for ${code}`, async ({ page }) => {
      const network = await installOwnerSupabaseMocks(page, {
        rpcResponse: {
          status: 400,
          body: {
            code,
            message: code
          }
        }
      });

      await signInAsOwner(page);
      await openOwnerManagement(page);

      await page.getByPlaceholder('E-mail da conta do barbeiro').fill('barber@example.com');
      const linkButton = page.getByRole('button', { name: /Vincular usuario/i });
      await expect(linkButton).toBeEnabled();
      await linkButton.evaluate((button: HTMLButtonElement) => button.click());

      await expect.poll(() => network.rpcRequests.length).toBe(1);
      await expect(page.getByText(message)).toBeVisible();
    });
  }
});
