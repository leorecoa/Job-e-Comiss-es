import { expect, test, type Page, type Route } from 'playwright/test';

const SUPABASE_URL = 'https://e2e.supabase.test';
const LEO_BARBERSHOP_ID = '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce';
const GESTAO_BARBERSHOP_ID = '11111111-1111-4111-8111-111111111111';
const LEO_BARBER_ID = '6a1c35f2-deec-4528-82dc-10dccb601e56';
const OTHER_BARBER_ID = '49591f96-fcff-4cc1-b0bf-17d2932251c6';
const LEO_SERVICE_ID = '8b8a04ef-fd1d-40c9-98e1-c052345cf4b8';
const OTHER_SERVICE_ID = '4cbf9f97-598a-4574-8c72-95c94ec0aba5';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': '*',
  'content-type': 'application/json'
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

type MockSlot = {
  barber_id: string;
  barber_name: string;
  barbershop_id: string;
  start_at: string;
  end_at: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
};

type CapturedRequest = {
  method: string;
  url: string;
  body: unknown;
};

type MockScenario = {
  barbershops?: MockBarbershop[];
  barbers?: MockBarber[];
  services?: MockService[];
  slots?: MockSlot[];
  appointmentInsertResponse?: {
    status: number;
    body: unknown;
  };
  appointmentInsertDelayMs?: number;
};

const tomorrowDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

const allDaysBusinessHours = {
  sunday: { active: true, open: '09:00', close: '18:00' },
  monday: { active: true, open: '09:00', close: '18:00' },
  tuesday: { active: true, open: '09:00', close: '18:00' },
  wednesday: { active: true, open: '09:00', close: '18:00' },
  thursday: { active: true, open: '09:00', close: '18:00' },
  friday: { active: true, open: '09:00', close: '18:00' },
  saturday: { active: true, open: '09:00', close: '18:00' }
};

const leoBarbershop: MockBarbershop = {
  id: LEO_BARBERSHOP_ID,
  name: 'leo do leo',
  slug: 'leo-do-leo',
  phone: '81999999999',
  address: 'Rua do Leo, 123',
  logo_url: null,
  cover_image_url: null,
  description: 'Agenda premium da leo do leo.',
  instagram_url: 'instagram.com/leo-do-leo',
  whatsapp: '81999999999',
  primary_color: '#f59e0b',
  secondary_color: '#0ea5e9',
  business_hours: allDaysBusinessHours,
  slot_step_minutes: 30,
  active: true
};

const gestaoBarbershop: MockBarbershop = {
  id: GESTAO_BARBERSHOP_ID,
  name: 'Gestao Maxima',
  slug: 'gestao-maxima',
  phone: '81888888888',
  address: 'Rua Central, 1',
  logo_url: null,
  cover_image_url: null,
  description: 'Nao deve vazar para outro tenant.',
  instagram_url: null,
  whatsapp: null,
  primary_color: '#6366f1',
  secondary_color: '#22c55e',
  business_hours: allDaysBusinessHours,
  slot_step_minutes: 30,
  active: true
};

const scenarioDefaults: Required<MockScenario> = {
  barbershops: [leoBarbershop, gestaoBarbershop],
  barbers: [
    { id: LEO_BARBER_ID, name: 'test', barbershop_id: LEO_BARBERSHOP_ID, active: true },
    { id: '44ff8c5c-3a89-4ef0-98c1-d345c613fa00', name: 'Leo Inativo', barbershop_id: LEO_BARBERSHOP_ID, active: false },
    { id: OTHER_BARBER_ID, name: 'Barbeiro Gestao', barbershop_id: GESTAO_BARBERSHOP_ID, active: true }
  ],
  services: [
    { id: LEO_SERVICE_ID, name: 'corte', barbershop_id: LEO_BARBERSHOP_ID, price: 60, duration_minutes: 30, commission_rate: 50, active: true },
    { id: '4dc85c40-d7f9-4fc9-88bb-e202e56f1b9b', name: 'Servico Inativo', barbershop_id: LEO_BARBERSHOP_ID, price: 80, duration_minutes: 45, commission_rate: 50, active: false },
    { id: OTHER_SERVICE_ID, name: 'combo gestao', barbershop_id: GESTAO_BARBERSHOP_ID, price: 70, duration_minutes: 50, commission_rate: 50, active: true }
  ],
  slots: [],
  appointmentInsertResponse: {
    status: 201,
    body: []
  },
  appointmentInsertDelayMs: 0
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

const installSupabaseMocks = async (page: Page, scenario: MockScenario = {}) => {
  const state: Required<MockScenario> = {
    barbershops: scenario.barbershops ?? scenarioDefaults.barbershops,
    barbers: scenario.barbers ?? scenarioDefaults.barbers,
    services: scenario.services ?? scenarioDefaults.services,
    slots: scenario.slots ?? scenarioDefaults.slots,
    appointmentInsertResponse: scenario.appointmentInsertResponse ?? scenarioDefaults.appointmentInsertResponse,
    appointmentInsertDelayMs: scenario.appointmentInsertDelayMs ?? 0
  };

  const barbersRequests: string[] = [];
  const servicesRequests: string[] = [];
  const slotRequests: CapturedRequest[] = [];
  const appointmentRequests: CapturedRequest[] = [];
  const appointmentReadRequests: CapturedRequest[] = [];

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

    if (url.pathname === '/auth/v1/user') {
      await fulfillJson(route, 401, { message: 'Auth session missing' });
      return;
    }

    if (url.pathname === '/rest/v1/barbershops') {
      const slug = toEqValue(url.searchParams.get('slug'));
      const id = toEqValue(url.searchParams.get('id'));
      const active = toEqValue(url.searchParams.get('active'));

      const rows = state.barbershops.filter((shop) => {
        if (slug && shop.slug !== slug) return false;
        if (id && shop.id !== id) return false;
        if (active === 'true' && !shop.active) return false;
        return true;
      });

      await fulfillJson(route, 200, rows);
      return;
    }

    if (url.pathname === '/rest/v1/barbers') {
      barbersRequests.push(request.url());
      const barbershopId = toEqValue(url.searchParams.get('barbershop_id'));
      const id = toEqValue(url.searchParams.get('id'));
      const active = toEqValue(url.searchParams.get('active'));

      const rows = state.barbers.filter((barber) => {
        if (barbershopId && barber.barbershop_id !== barbershopId) return false;
        if (id && barber.id !== id) return false;
        if (active === 'true' && !barber.active) return false;
        return true;
      });

      await fulfillJson(route, 200, rows);
      return;
    }

    if (url.pathname === '/rest/v1/services') {
      servicesRequests.push(request.url());
      const barbershopId = toEqValue(url.searchParams.get('barbershop_id'));
      const id = toEqValue(url.searchParams.get('id'));
      const active = toEqValue(url.searchParams.get('active'));

      const rows = state.services.filter((service) => {
        if (barbershopId && service.barbershop_id !== barbershopId) return false;
        if (id && service.id !== id) return false;
        if (active === 'true' && !service.active) return false;
        return true;
      });

      await fulfillJson(route, 200, rows);
      return;
    }

    if (url.pathname === '/rest/v1/rpc/get_public_appointment_slots') {
      const body = parseRequestBody(route) as { p_barbershop_id?: string } | null;
      slotRequests.push({
        method: request.method(),
        url: request.url(),
        body
      });
      const barbershopId = body?.p_barbershop_id || null;

      const rows = state.slots.filter((slot) => (
        !barbershopId || slot.barbershop_id === barbershopId
      ));

      await fulfillJson(route, 200, rows);
      return;
    }

    if (url.pathname === '/rest/v1/rpc/create_public_appointment') {
      appointmentRequests.push({
        method: request.method(),
        url: request.url(),
        body: parseRequestBody(route)
      });
      if (state.appointmentInsertDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, state.appointmentInsertDelayMs));
      }
      await fulfillJson(
        route,
        state.appointmentInsertResponse.status,
        state.appointmentInsertResponse.body
      );
      return;
    }

    if (url.pathname === '/rest/v1/appointments') {
      const captured = {
        method: request.method(),
        url: request.url(),
        body: parseRequestBody(route)
      };

      appointmentReadRequests.push(captured);
      await fulfillJson(route, 405, { message: 'Public booking must not access appointments directly' });
      return;
    }

    await fulfillJson(route, 404, { message: `Unhandled mock path: ${url.pathname}` });
  });

  return {
    barbersRequests,
    servicesRequests,
    slotRequests,
    appointmentRequests,
    appointmentReadRequests
  };
};

const fillValidPublicBookingForm = async (page: Page) => {
  await page.getByRole('button', { name: /test/i }).click();
  await page.getByRole('button', { name: /corte/i }).click();
  await page.locator('input[type="date"]').fill(tomorrowDate());

  const firstSlot = page.locator('button[type="button"]').filter({ hasText: /^\d{2}:\d{2}$/ }).first();
  await expect(firstSlot).toBeVisible();
  await firstSlot.click();

  await page.locator('label').filter({ hasText: 'Seu nome' }).locator('xpath=following-sibling::input').fill('pedro');
  await page.locator('label').filter({ hasText: 'WhatsApp' }).locator('xpath=following-sibling::input').fill('81987324097');
  await page.locator('label').filter({ hasText: 'Observacoes' }).locator('xpath=following-sibling::textarea').fill('teste e2e');
};

test.describe('public booking /book/:slug', () => {
  test('loads the correct barbershop and tenant-scoped public catalog without fallback', async ({ page }) => {
    const network = await installSupabaseMocks(page);

    await page.goto('/book/leo-do-leo');

    await expect(page.locator('header h1')).toHaveText(/leo do leo/i);
    await expect(page.getByText(/Agenda premium da leo do leo/i)).toBeVisible();
    await expect(page.getByText(/Gest[aã]o M[aá]xima/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /test/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /corte/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Barbeiro selecionado: test/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /Servico selecionado: corte/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/R\$\s*60,00/i).first()).toBeVisible();
    await expect(page.getByText(/30 min/i).first()).toBeVisible();
    await expect(page.getByText(/Leo Inativo/i)).toHaveCount(0);
    await expect(page.getByText(/Barbeiro Gestao/i)).toHaveCount(0);
    await expect(page.getByText(/Servico Inativo/i)).toHaveCount(0);
    await expect(page.getByText(/combo gestao/i)).toHaveCount(0);

    expect(network.barbersRequests.some((url) => url.includes(`barbershop_id=eq.${LEO_BARBERSHOP_ID}`))).toBeTruthy();
    expect(network.barbersRequests.some((url) => url.includes('active=eq.true'))).toBeTruthy();
    expect(network.servicesRequests.some((url) => url.includes(`barbershop_id=eq.${LEO_BARBERSHOP_ID}`))).toBeTruthy();
    expect(network.servicesRequests.some((url) => url.includes('active=eq.true'))).toBeTruthy();
    expect(network.slotRequests.some((request) => (
      request.method === 'POST'
      && (request.body as { p_barbershop_id?: string } | null)?.p_barbershop_id === LEO_BARBERSHOP_ID
    ))).toBeTruthy();
    expect(network.appointmentReadRequests).toHaveLength(0);
  });

  test('creates a valid public appointment through RPC without direct appointments access', async ({ page }) => {
    const network = await installSupabaseMocks(page);

    await page.goto('/book/leo-do-leo');
    await fillValidPublicBookingForm(page);

    await expect(page.getByText(/Confira sua reserva/i)).toBeVisible();
    await expect(page.getByText(/Pronto para reservar/i)).toBeVisible();
    await expect(page.getByText(/pedro/i)).toBeVisible();
    await expect(page.getByText(/Revise os dados antes de confirmar/i)).toBeVisible();

    await page.getByRole('button', { name: /Reservar horario/i }).click();

    await expect(page.getByRole('heading', { name: /Horario reservado com sucesso/i })).toBeVisible();
    await expect(page.getByText(/Resumo confirmado/i)).toBeVisible();
    await expect(page.getByText(/leo do leo/i)).toBeVisible();
    await expect(page.getByText(/corte/i)).toBeVisible();
    await expect(page.getByText(/test/i)).toBeVisible();
    await expect(page.getByText(/pagamento.*combinado diretamente/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Falar com a barbearia/i })).toBeVisible();
    expect(network.appointmentRequests).toHaveLength(1);
    expect(network.appointmentReadRequests).toHaveLength(0);

    const [{ method, url, body }] = network.appointmentRequests;
    const payload = Array.isArray(body) ? body[0] : body as Record<string, unknown>;

    expect(method).toBe('POST');
    expect(url).toContain('/rpc/create_public_appointment');
    expect(payload).toMatchObject({
      p_barbershop_id: LEO_BARBERSHOP_ID,
      p_barber_id: LEO_BARBER_ID,
      p_service_id: LEO_SERVICE_ID,
      p_client_name: 'pedro',
      p_client_phone: '81987324097'
    });
    expect(payload).not.toHaveProperty('barber_name');
    expect(payload).not.toHaveProperty('service_type');
    expect(payload).not.toHaveProperty('service_value');
    expect(payload).not.toHaveProperty('commission_rate');
    expect(payload).not.toHaveProperty('status');
  });

  test('prevents double submit while the public RPC is in flight', async ({ page }) => {
    const network = await installSupabaseMocks(page, { appointmentInsertDelayMs: 150 });

    await page.goto('/book/leo-do-leo');
    await fillValidPublicBookingForm(page);

    const submitButton = page.getByRole('button', { name: /Reservar horario/i });
    await submitButton.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });

    await expect(page.getByRole('button', { name: /Confirmando/i })).toBeDisabled();
    await expect(page.getByRole('heading', { name: /Horario reservado com sucesso/i })).toBeVisible();
    expect(network.appointmentRequests).toHaveLength(1);
  });

  for (const [code, message] of [
    ['PUBLIC_APPOINTMENT_RATE_LIMITED', /Aguarde um minuto antes de tentar agendar novamente/i],
    ['PUBLIC_APPOINTMENT_ACTIVE_LIMIT', /ja possui tres agendamentos futuros ativos/i]
  ] as const) {
    test(`shows friendly public abuse error ${code} and restores submit`, async ({ page }) => {
      const network = await installSupabaseMocks(page, {
        appointmentInsertResponse: { status: 429, body: { code: 'P0001', message: code } }
      });

      await page.goto('/book/leo-do-leo');
      await fillValidPublicBookingForm(page);
      await page.getByRole('button', { name: /Reservar horario/i }).click();

      await expect(page.getByText(message).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Reservar horario/i })).toBeEnabled();
      expect(network.appointmentRequests).toHaveLength(1);
    });
  }

  test('blocks submit when no slot is selected and does not post appointments', async ({ page }) => {
    const network = await installSupabaseMocks(page);

    await page.goto('/book/leo-do-leo');

    await page.getByRole('button', { name: /test/i }).click();
    await page.getByRole('button', { name: /corte/i }).click();
    await page.locator('input[type="date"]').fill(tomorrowDate());
    await page.locator('label').filter({ hasText: 'Seu nome' }).locator('xpath=following-sibling::input').fill('pedro');
    await page.locator('label').filter({ hasText: 'WhatsApp' }).locator('xpath=following-sibling::input').fill('81987324097');

    const submitButton = page.getByRole('button', { name: /Reservar horario/i });
    await expect(submitButton).toBeDisabled();

    expect(network.appointmentRequests).toHaveLength(0);
    expect(network.appointmentReadRequests).toHaveLength(0);
  });

  test('shows the friendly conflict message when a slot is taken during public RPC', async ({ page }) => {
    const network = await installSupabaseMocks(page, {
      appointmentInsertResponse: {
        status: 409,
        body: {
          code: 'P0001',
          message: 'PUBLIC_APPOINTMENT_SLOT_CONFLICT'
        }
      }
    });

    await page.goto('/book/leo-do-leo');
    await fillValidPublicBookingForm(page);
    await page.getByRole('button', { name: /Reservar horario/i }).click();

    await expect(page.getByText(/Esse hor.rio acabou de ser reservado\..*Escolha outro hor.rio\./i).first()).toBeVisible();
    expect(network.appointmentRequests).toHaveLength(1);
    expect(network.appointmentReadRequests).toHaveLength(0);
  });

  test('shows a friendly error for an unknown slug without falling back to Gestao Maxima', async ({ page }) => {
    await installSupabaseMocks(page, {
      barbershops: [gestaoBarbershop]
    });

    await page.goto('/book/barbearia-inexistente');

    await expect(page.getByText(/Link indisponivel/i)).toBeVisible();
    await expect(page.getByText(/Barbearia.*encontrada.*indispon/i)).toBeVisible();
    await expect(page.getByText(/Gest[aã]o M[aá]xima/i)).toHaveCount(0);
  });
});
