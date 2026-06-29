import { expect, test, type Page, type Route } from 'playwright/test';

const SUPABASE_URL = 'https://e2e.supabase.test';
const BARBERSHOP_ID = '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce';
const OTHER_BARBERSHOP_ID = '11111111-1111-4111-8111-111111111111';
const BARBER_ID = '252b5551-b8e7-4693-ab07-d0bbfde6ec05';
const OTHER_BARBER_ID = '6a1c35f2-deec-4528-82dc-10dccb601e56';
const SERVICE_ID = '8b8a04ef-fd1d-40c9-98e1-c052345cf4b8';
const BARBER_USER_ID = '8352cfec-3070-4cbe-b9ef-6fbabca12f0c';
const BARBER_EMAIL = 'barber@example.com';
const BARBER_PASSWORD = 'secret123';
const BARBER_DISPLAY_NAME = 'Leo Barber';

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

type CapturedRequest = {
  method: string;
  url: string;
  body: unknown;
};

type MockScenario = {
  profile?: MockProfile;
  barbers?: MockBarber[];
  services?: MockService[];
  appointments?: MockAppointment[];
  appointmentInsertResponse?: {
    status: number;
    body: unknown;
  };
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
  date,
  time
}: {
  id: string;
  clientName: string;
  barberId: string;
  barberName: string;
  date: string;
  time: string;
}): MockAppointment => {
  const startAt = buildLocalIso(date, time);
  const endDate = new Date(startAt);
  endDate.setMinutes(endDate.getMinutes() + 30);

  return {
    id,
    barbershop_id: BARBERSHOP_ID,
    client_name: clientName,
    client_phone: '85999999999',
    barber_id: barberId,
    barber_name: barberName,
    service_id: SERVICE_ID,
    service_type: 'Corte',
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

const installBarberSupabaseMocks = async (page: Page, scenario: MockScenario = {}) => {
  const today = getTodayString();

  const profile: MockProfile = scenario.profile ?? {
    id: BARBER_USER_ID,
    display_name: BARBER_DISPLAY_NAME,
    role: 'barber',
    active: true,
    barbershop_id: BARBERSHOP_ID,
    barber_id: BARBER_ID
  };

  const barbers: MockBarber[] = scenario.barbers ?? [
    { id: BARBER_ID, name: BARBER_DISPLAY_NAME, barbershop_id: BARBERSHOP_ID, active: true },
    { id: OTHER_BARBER_ID, name: 'Outro Barbeiro', barbershop_id: BARBERSHOP_ID, active: true },
    { id: '49591f96-fcff-4cc1-b0bf-17d2932251c6', name: 'Barbeiro Outro Tenant', barbershop_id: OTHER_BARBERSHOP_ID, active: true }
  ];

  const services: MockService[] = scenario.services ?? [
    { id: SERVICE_ID, name: 'Corte', barbershop_id: BARBERSHOP_ID, price: 60, duration_minutes: 30, commission_rate: 50, active: true },
    { id: '4cbf9f97-598a-4574-8c72-95c94ec0aba5', name: 'Barba', barbershop_id: BARBERSHOP_ID, price: 40, duration_minutes: 20, commission_rate: 50, active: true }
  ];

  const appointments: MockAppointment[] = scenario.appointments ?? [
    makeAppointmentRow({
      id: 'appointment-own',
      clientName: 'Cliente do Leo',
      barberId: BARBER_ID,
      barberName: BARBER_DISPLAY_NAME,
      date: today,
      time: '09:00'
    }),
    makeAppointmentRow({
      id: 'appointment-other-barber',
      clientName: 'Cliente do Outro',
      barberId: OTHER_BARBER_ID,
      barberName: 'Outro Barbeiro',
      date: today,
      time: '10:00'
    }),
    {
      ...makeAppointmentRow({
        id: 'appointment-other-tenant',
        clientName: 'Cliente Outro Tenant',
        barberId: '49591f96-fcff-4cc1-b0bf-17d2932251c6',
        barberName: 'Barbeiro Outro Tenant',
        date: today,
        time: '11:00'
      }),
      barbershop_id: OTHER_BARBERSHOP_ID
    }
  ];

  const appointmentInsertResponse = scenario.appointmentInsertResponse ?? {
    status: 201,
    body: []
  };

  const signInRequests: CapturedRequest[] = [];
  const appointmentReadRequests: string[] = [];
  const appointmentCreateRequests: CapturedRequest[] = [];

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
        access_token: 'barber-access-token',
        refresh_token: 'barber-refresh-token',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: {
          id: BARBER_USER_ID,
          email: BARBER_EMAIL,
          user_metadata: {
            role: 'barber',
            display_name: BARBER_DISPLAY_NAME
          }
        }
      });
      return;
    }

    if (url.pathname === '/auth/v1/user') {
      await fulfillJson(route, 200, {
        id: BARBER_USER_ID,
        email: BARBER_EMAIL,
        user_metadata: {
          role: 'barber',
          display_name: BARBER_DISPLAY_NAME
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

    if (url.pathname === '/rest/v1/barbers') {
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
      if (request.method() === 'POST') {
        appointmentCreateRequests.push({
          method: request.method(),
          url: request.url(),
          body: parseRequestBody(route)
        });

        await fulfillJson(route, appointmentInsertResponse.status, appointmentInsertResponse.body);
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

    await fulfillJson(route, 404, { message: `Unhandled mock path: ${url.pathname}` });
  });

  return {
    signInRequests,
    appointmentReadRequests,
    appointmentCreateRequests
  };
};

const signInAsBarber = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Painel interno/i })).toBeVisible();
  await page.locator('label').filter({ hasText: 'Email' }).locator('xpath=following-sibling::input').fill(BARBER_EMAIL);
  await page.locator('label').filter({ hasText: 'Senha' }).locator('xpath=following-sibling::input').fill(BARBER_PASSWORD);
  await page.locator('form button[type="submit"]').click();
};

const openNewAppointmentModal = async (page: Page) => {
  await page.getByRole('button', { name: /Novo Agendamento/i }).click();
  await expect(page.getByRole('heading', { name: /Novo agendamento/i })).toBeVisible();
};

const fillBarberAppointmentModal = async (page: Page, clientName: string) => {
  const today = getTodayString();
  await page.getByLabel('Cliente').fill(clientName);
  await page.getByLabel('Telefone WhatsApp').fill('81987324097');
  await page.getByLabel('Data').fill(today);
  await page.getByLabel('Hora').fill('14:00');
  await page.getByLabel('Servico').selectOption({ label: 'Corte' });
  await page.getByLabel('Valor').fill('60');
  await page.getByLabel('Observacoes').fill('teste e2e barbeiro');
};

test.describe('barber dashboard e2e', () => {
  test('authenticated linked barber accesses the dashboard and sees only own appointments', async ({ page }) => {
    const network = await installBarberSupabaseMocks(page);

    await signInAsBarber(page);

    await expect(page.getByRole('heading', { name: /Leo Barber/i })).toBeVisible();
    await expect(page.getByText(/Cliente do Leo/i)).toBeVisible();
    await expect(page.getByText(/Cliente do Outro/i)).toHaveCount(0);
    await expect(page.getByText(/Cliente Outro Tenant/i)).toHaveCount(0);
    await expect(page.getByText(/Gest[aã]o M[aá]xima/i)).toHaveCount(0);

    expect(network.signInRequests).toHaveLength(1);
    expect(network.appointmentReadRequests.some((url) => url.includes(`barbershop_id=eq.${BARBERSHOP_ID}`))).toBeTruthy();
    expect(network.appointmentReadRequests.some((url) => url.includes(`barber_id=eq.${BARBER_ID}`))).toBeTruthy();
  });

  test('barber creates a manual appointment with barbershopId and barberId from the authenticated session', async ({ page }) => {
    const network = await installBarberSupabaseMocks(page);

    await signInAsBarber(page);
    await openNewAppointmentModal(page);
    await fillBarberAppointmentModal(page, 'Cliente Novo');
    await page.getByRole('button', { name: /Salvar agendamento/i }).click();

    await expect(page.getByText(/Agendamento criado!/i).first()).toBeVisible();
    await expect(page.getByText(/Cliente Novo/i)).toBeVisible();

    expect(network.appointmentCreateRequests).toHaveLength(1);
    const [{ body }] = network.appointmentCreateRequests;
    const payload = body as Record<string, unknown>;

    expect(payload).toMatchObject({
      barbershop_id: BARBERSHOP_ID,
      barber_id: BARBER_ID,
      barber_name: BARBER_DISPLAY_NAME,
      service_id: SERVICE_ID,
      service_type: 'Corte',
      client_name: 'Cliente Novo'
    });
    expect(JSON.stringify(payload)).not.toContain('Gestao Maxima');
  });

  test('barber input tampering does not override the session barber ownership', async ({ page }) => {
    const network = await installBarberSupabaseMocks(page);

    await signInAsBarber(page);
    await openNewAppointmentModal(page);
    await fillBarberAppointmentModal(page, 'Cliente Forcado');

    await page.evaluate(() => {
      const select = document.querySelector<HTMLSelectElement>('#appointment-barber');
      if (!select) throw new Error('Barber select not found');

      const fakeOption = document.createElement('option');
      fakeOption.value = 'Barber Hack';
      fakeOption.textContent = 'Barber Hack';
      select.append(fakeOption);
      select.value = 'Barber Hack';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.getByRole('button', { name: /Salvar agendamento/i }).click();
    await expect(page.getByText(/Agendamento criado!/i).first()).toBeVisible();

    expect(network.appointmentCreateRequests).toHaveLength(1);
    const [{ body }] = network.appointmentCreateRequests;
    const payload = body as Record<string, unknown>;

    expect(payload).toMatchObject({
      barbershop_id: BARBERSHOP_ID,
      barber_id: BARBER_ID,
      barber_name: BARBER_DISPLAY_NAME
    });
    expect(payload.barber_id).not.toBe('barber-id-from-modal');
    expect(payload.barber_name).not.toBe('Barber Hack');
  });

  test.fixme('barber without barberId should receive the incomplete profile message', async ({ page }) => {
    await installBarberSupabaseMocks(page, {
      profile: {
        id: BARBER_USER_ID,
        display_name: BARBER_DISPLAY_NAME,
        role: 'barber',
        active: true,
        barbershop_id: BARBERSHOP_ID,
        barber_id: null
      }
    });

    await signInAsBarber(page);
    await expect(page.getByText(/Perfil de barbeiro incompleto/i)).toBeVisible();
  });

  test.fixme('barber without barbershopId should receive the incomplete profile message', async ({ page }) => {
    await installBarberSupabaseMocks(page, {
      profile: {
        id: BARBER_USER_ID,
        display_name: BARBER_DISPLAY_NAME,
        role: 'barber',
        active: true,
        barbershop_id: null,
        barber_id: BARBER_ID
      }
    });

    await signInAsBarber(page);
    await expect(page.getByText(/Perfil de barbeiro incompleto/i)).toBeVisible();
  });
});
