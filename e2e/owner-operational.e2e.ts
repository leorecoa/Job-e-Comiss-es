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
  financial_timezone?: string | null;
  operational_timezone?: string | null;
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
  completedAt?: string;
  onboardingRpcResponse?: MockRpcResponse;
  availability?: (body: Record<string, unknown>) => Promise<MockRpcResponse>;
  failAgendaAfterCreate?: boolean;
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
    { ...ownerBarbershop },
    { ...otherBarbershop }
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
  const availabilityRequests: Record<string, unknown>[] = [];
  const appointmentInsertRequests: Record<string, unknown>[] = [];
  const rpcRequests: CapturedRequest[] = [];
  const completionRequests: CapturedRequest[] = [];
  const appointmentUpdateRequests: CapturedRequest[] = [];
  const onboardingRequests: CapturedRequest[] = [];
  const financialTimezoneRequests: CapturedRequest[] = [];
  const operationalTimezoneRequests: CapturedRequest[] = [];

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
      if (request.method() === 'PATCH') {
        const body = parseRequestBody(route) as Record<string, unknown>;
        if ('financial_timezone' in body) {
          financialTimezoneRequests.push({ method: request.method(), url: request.url(), body });
          if (profile.role !== 'owner' || !profile.active || id !== profile.barbershop_id) {
            await fulfillJson(route, 403, { message: 'Forbidden' });
            return;
          }
          rows.forEach(shop => { shop.financial_timezone = String(body.financial_timezone); });
        }
        if ('operational_timezone' in body) {
          operationalTimezoneRequests.push({ method: request.method(), url: request.url(), body });
          if (profile.role !== 'owner' || !profile.active || id !== profile.barbershop_id) {
            await fulfillJson(route, 403, { message: 'Forbidden' });
            return;
          }
          rows.forEach(shop => { shop.operational_timezone = String(body.operational_timezone); });
        }
      }
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
      if (request.method() === 'POST') {
        const body = parseRequestBody(route) as Record<string, unknown>;
        appointmentInsertRequests.push(body);
        appointments.push({ ...body, id: '60000000-0000-4000-8000-000000000099', created_at: String(body.start_at), updated_at: String(body.start_at) } as MockAppointment);
        await fulfillJson(route, 201, null);
        return;
      }
      appointmentReadRequests.push(request.url());
      await fulfillJson(route, 403, { message: 'Direct appointment reads are forbidden.' });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/get_owner_availability') {
      const body = parseRequestBody(route) as Record<string, unknown>;
      availabilityRequests.push(body);
      const response = scenario.availability ? await scenario.availability(body) : { status: 200, body: [] };
      await fulfillJson(route, response.status, response.body);
      return;
    }

    if (url.pathname === '/rest/v1/rpc/get_internal_appointments') {
      if (scenario.failAgendaAfterCreate && appointmentInsertRequests.length) {
        await fulfillJson(route, 503, { message: 'Unavailable' });
        return;
      }
      const rows = appointments
        .filter((appointment) => appointment.barbershop_id === profile.barbershop_id)
        .map((appointment) => ({ ...appointment, viewer_role: 'owner' }));
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
          completed_at: scenario.completedAt ?? new Date().toISOString(),
          created_at: new Date().toISOString()
        });
      }
      await fulfillJson(route, 200, [{ appointment_id: appointment.id, financial_record_id: financialId }]);
      return;
    }

    if (url.pathname === '/rest/v1/rpc/update_owner_appointment') {
      const body = parseRequestBody(route) as Record<string, unknown>;
      appointmentUpdateRequests.push({ method: request.method(), url: request.url(), body });
      const appointment = appointments.find((item) => item.id === body.p_appointment_id);
      if (!appointment) {
        await fulfillJson(route, 404, { message: 'OWNER_APPOINTMENT_NOT_FOUND' });
        return;
      }

      appointment.client_name = String(body.p_client_name);
      appointment.start_at = String(body.p_start_at);
      appointment.end_at = String(body.p_end_at);
      appointment.updated_at = new Date().toISOString();
      await fulfillJson(route, 200, [{ ...appointment, viewer_role: 'owner' }]);
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

    if (url.pathname === '/rest/v1/rpc/create_owner_barbershop') {
      const body = parseRequestBody(route) as Record<string, unknown>;
      onboardingRequests.push({ method: request.method(), url: request.url(), body });

      if (scenario.onboardingRpcResponse) {
        await fulfillJson(route, scenario.onboardingRpcResponse.status, scenario.onboardingRpcResponse.body);
        return;
      }

      const created: MockBarbershop = {
        id: '01300000-0000-4000-8000-000000000010',
        financial_timezone: (body.p_financial_timezone as string | undefined) ?? null,
        operational_timezone: (body.p_operational_timezone as string | undefined) ?? null,
        name: String(body.p_name),
        slug: String(body.p_slug),
        phone: body.p_phone as string | null,
        address: body.p_address as string | null,
        logo_url: null,
        cover_image_url: null,
        description: body.p_description as string | null,
        instagram_url: null,
        whatsapp: body.p_whatsapp as string | null,
        primary_color: null,
        secondary_color: null,
        business_hours: body.p_business_hours as MockBarbershop['business_hours'],
        slot_step_minutes: Number(body.p_slot_step_minutes),
        active: true
      };
      profile.barbershop_id = created.id;
      barbershops.push(created);
      await fulfillJson(route, 200, [created]);
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
    availabilityRequests,
    appointmentInsertRequests,
    rpcRequests,
    completionRequests,
    appointmentUpdateRequests,
    onboardingRequests,
    financialTimezoneRequests,
    operationalTimezoneRequests
  };
};

const signInAsOwner = async (page: Page, initialUrl = '/') => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hasSeenTour', 'true');
  });
  await page.goto(initialUrl);
  await expect(page.getByRole('heading', { name: /Painel interno/i })).toBeVisible();
  await page.locator('label').filter({ hasText: 'Email' }).locator('xpath=following-sibling::input').fill(OWNER_EMAIL);
  await page.locator('label').filter({ hasText: 'Senha' }).locator('xpath=following-sibling::input').fill(OWNER_PASSWORD);
  await page.locator('form button[type="submit"]').click();
};

const openOwnerManagement = async (page: Page) => {
  await page.getByRole('navigation', { name: 'Secoes do painel', exact: true })
    .getByRole('button', { name: 'Gestão' })
    .click();
};

test.describe('owner operational dashboard e2e', () => {
  test('owner availability opens with the selected agenda barber ID, even for homonyms', async ({ page }) => {
    const barberB = '252b5551-b8e7-4693-ab07-d0bbfde6ec06';
    const slot = { start_at: '2030-10-01T09:00:00-03:00', end_at: '2030-10-01T09:30:00-03:00' };
    const network = await installOwnerSupabaseMocks(page, {
      barbershops: [{ ...ownerBarbershop, operational_timezone: 'America/Recife' }],
      barbers: [OWNER_BARBER_ID, barberB].map(id => ({ id, name: 'Mesmo nome', barbershop_id: OWNER_BARBERSHOP_ID, active: true })),
      appointments: [],
      availability: async () => ({ status: 200, body: [slot] })
    });
    await signInAsOwner(page);
    await page.locator('#schedule-barber').selectOption(barberB);
    await page.getByLabel('Data da agenda').fill('2030-10-01');
    await page.getByRole('button', { name: 'Agendar', exact: true }).last().click();
    await expect(page.locator('#appointment-barber')).toHaveValue(barberB);
    await page.getByRole('button', { name: '09:00 – 09:30', exact: true }).click();
    expect(network.availabilityRequests.every(body => body.p_barber_id === barberB)).toBe(true);
    await page.locator('#appointment-client-name').fill('Barbeiro B');
    await page.locator('#appointment-client-phone').fill('81999990000');
    await page.getByRole('button', { name: 'Salvar agendamento' }).click();
    await expect.poll(() => network.appointmentInsertRequests.length).toBe(1);
    expect(network.appointmentInsertRequests[0]).toMatchObject({ barber_id: barberB, ...slot });
  });

  test.describe('initial operational day', () => {
    test.use({ timezoneId: 'UTC' });
    for (const manualBeforeLoad of [false, true]) {
      test(`timezone arrival respects explicit selection: ${manualBeforeLoad}`, async ({ page }) => {
        await page.clock.setFixedTime(new Date('2030-10-01T01:00:00Z'));
        await installOwnerSupabaseMocks(page);
        let release!: () => void;
        const wait = new Promise<void>(resolve => { release = resolve; });
        await page.route(`${SUPABASE_URL}/rest/v1/barbershops*`, async route => {
          if (route.request().method() !== 'GET') {
            await route.fallback();
            return;
          }
          await wait;
          await fulfillJson(route, 200, { ...ownerBarbershop, operational_timezone: 'America/Recife' });
        });
        await signInAsOwner(page);
        const date = page.getByLabel('Data da agenda');
        await expect(date).toHaveValue('');
        if (manualBeforeLoad) await date.fill('2030-09-25');
        release();
        await expect(page.getByText('Fuso operacional não configurado.', { exact: false })).toHaveCount(0);
        await expect(date).toHaveValue(manualBeforeLoad ? '2030-09-25' : '2030-09-30');
        await date.fill('2030-09-24');
        await openOwnerManagement(page);
        await page.getByLabel('Timezone operacional IANA', { exact: true }).fill('UTC');
        await page.getByRole('button', { name: 'Confirmar timezone operacional', exact: true }).click();
        await expect(page.getByText('Timezone operacional atual: UTC')).toBeVisible();
        await page.getByRole('navigation', { name: 'Secoes do painel', exact: true }).getByRole('button', { name: 'Agenda', exact: true }).click();
        await expect(date).toHaveValue('2030-09-24');
      });
    }
  });

  test('owner textual edit preserves fractional historical timestamps without pretending they are availability slots', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2030-10-01T15:00:00Z'));
    const appointment = {
      ...makeAppointmentRow({ id: '60000000-0000-4000-8000-000000000055', clientName: 'Precisao textual', barberId: OWNER_BARBER_ID, barberName: 'Leo Barber', barbershopId: OWNER_BARBERSHOP_ID, date: '2030-10-01', time: '09:00' }),
      start_at: '2030-10-01T09:00:12.123456-03:00', end_at: '2030-10-01T09:30:12.123456-03:00'
    };
    const network = await installOwnerSupabaseMocks(page, { appointments: [appointment], barbershops: [{ ...ownerBarbershop, operational_timezone: 'America/Recife' }] });
    await signInAsOwner(page);
    await page.locator('article').filter({ hasText: 'Precisao textual' }).getByRole('button', { name: 'Editar', exact: true }).click();
    await page.locator('#appointment-notes').fill('Somente texto');
    await page.getByRole('button', { name: 'Salvar agendamento' }).click();
    await expect.poll(() => network.appointmentUpdateRequests.length).toBe(1);
    expect(network.appointmentUpdateRequests[0].body).toMatchObject({ p_start_at: appointment.start_at, p_end_at: appointment.end_at });
    expect(network.availabilityRequests).toEqual([]);
  });

  test('owner availability creates exact slots and reschedules through the authenticated reader', async ({ page }) => {
    const slot = { start_at: '2030-10-01T09:00:00-03:00', end_at: '2030-10-01T10:00:00-03:00' };
    let created = false;
    const network = await installOwnerSupabaseMocks(page, {
      barbershops: [{ ...ownerBarbershop, operational_timezone: 'America/Recife' }],
      services: [{ id: OWNER_SERVICE_ID, name: 'Corte Leo', barbershop_id: OWNER_BARBERSHOP_ID, price: 60, duration_minutes: 60, commission_rate: 50, active: true }],
      availability: async body => ({ status: 200, body: created && !body.p_appointment_id ? [] : [slot] })
    });
    await signInAsOwner(page);
    await page.getByRole('button', { name: 'Agendar', exact: true }).last().click();
    await page.locator('#appointment-date').fill('2030-10-01');
    await page.locator('#appointment-client-name').fill('Cliente Availability');
    await page.locator('#appointment-client-phone').fill('81999990000');
    await expect(page.locator('#appointment-duration')).toHaveAttribute('readonly', '');
    await expect(page.locator('#appointment-duration')).toHaveValue('60');
    await page.getByRole('button', { name: '09:00 – 10:00', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar agendamento' }).click();
    await expect.poll(() => network.appointmentInsertRequests.length).toBe(1);
    created = true;
    expect(network.appointmentInsertRequests[0]).toMatchObject(slot);
    expect(network.availabilityRequests.at(-1)).toEqual({ p_service_id: OWNER_SERVICE_ID, p_barber_id: OWNER_BARBER_ID, p_local_date: '2030-10-01', p_appointment_id: null });
    await expect(page.getByText('Agendamento criado!')).toBeVisible();
    await page.locator('article').filter({ hasText: 'Cliente Availability' }).getByRole('button', { name: 'Editar', exact: true }).click();
    const count = network.availabilityRequests.length;
    await page.locator('#appointment-client-name').fill('Texto preservado');
    await page.getByRole('button', { name: 'Salvar agendamento' }).click();
    await expect.poll(() => network.appointmentUpdateRequests.length).toBe(1);
    expect(network.appointmentUpdateRequests[0].body).toMatchObject({ p_start_at: slot.start_at, p_end_at: slot.end_at });
    expect(network.availabilityRequests).toHaveLength(count);
    await page.locator('article').filter({ hasText: 'Texto preservado' }).getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByRole('button', { name: 'Reagendar', exact: true }).click();
    await page.getByRole('button', { name: '09:00 – 10:00', exact: true }).click();
    expect(network.availabilityRequests.at(-1)?.p_appointment_id).toBe('60000000-0000-4000-8000-000000000099');
    await expect(page.getByRole('button', { name: '10:00 – 11:00', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Salvar agendamento' }).click();
    await expect.poll(() => network.appointmentUpdateRequests.length).toBe(2);
    expect(network.appointmentUpdateRequests[1].body).toMatchObject({ p_start_at: slot.start_at, p_end_at: slot.end_at });
    expect(network.appointmentReadRequests).toEqual([]);
    await expect(page.getByRole('heading', { name: 'Editar agendamento' })).toHaveCount(0);
    const beforeNew = network.availabilityRequests.length;
    await page.getByRole('button', { name: 'Agendar', exact: true }).last().click();
    await expect(page.getByText('Nenhum horário disponível nesta data.')).toBeVisible();
    expect(network.availabilityRequests.length).toBeGreaterThan(beforeNew);
    await expect(page.getByRole('button', { name: '09:00 – 10:00', exact: true })).toHaveCount(0);
  });

  test('owner availability does not claim insert failed when agenda reload fails', async ({ page }) => {
    const network = await installOwnerSupabaseMocks(page, {
      failAgendaAfterCreate: true,
      barbershops: [{ ...ownerBarbershop, operational_timezone: 'America/Recife' }],
      availability: async () => ({ status: 200, body: [{ start_at: '2030-10-01T09:00:00-03:00', end_at: '2030-10-01T09:30:00-03:00' }] })
    });
    await signInAsOwner(page);
    await page.getByRole('button', { name: 'Agendar', exact: true }).last().click();
    await page.locator('#appointment-client-name').fill('Sem ID temporário');
    await page.locator('#appointment-client-phone').fill('81999990000');
    await page.getByRole('button', { name: '09:00 – 09:30', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar agendamento' }).click();
    await expect(page.getByText('Agendamento criado. Atualize a página para recarregar a agenda.')).toBeVisible();
    expect(network.appointmentInsertRequests).toHaveLength(1);
    await expect(page.locator('article').filter({ hasText: 'Sem ID temporário' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Novo agendamento' })).toHaveCount(0);
  });

  test('owner availability invalidates dimensions by ID and ignores stale responses for homonyms', async ({ page }) => {
    const barber2 = '252b5551-b8e7-4693-ab07-d0bbfde6ec06';
    const service2 = '8b8a04ef-fd1d-40c9-98e1-c052345cf4b9';
    let release!: () => void;
    let delayed = false;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const network = await installOwnerSupabaseMocks(page, {
      barbershops: [{ ...ownerBarbershop, operational_timezone: 'America/Recife' }],
      barbers: [OWNER_BARBER_ID, barber2].map(id => ({ id, name: 'Mesmo nome', barbershop_id: OWNER_BARBERSHOP_ID, active: true })),
      services: [OWNER_SERVICE_ID, service2].map(id => ({ id, name: 'Mesmo serviço', price: 60, duration_minutes: 30, commission_rate: 50, active: true, barbershop_id: OWNER_BARBERSHOP_ID })),
      availability: async body => {
        if (body.p_service_id === service2 && !delayed) { delayed = true; await wait; }
        return { status: 200, body: [{ start_at: `${body.p_local_date}T${body.p_service_id === service2 ? '11' : '09'}:00:00-03:00`, end_at: `${body.p_local_date}T${body.p_service_id === service2 ? '11' : '09'}:30:00-03:00` }] };
      }
    });
    await signInAsOwner(page);
    await page.getByRole('button', { name: 'Agendar', exact: true }).last().click();
    const save = page.getByRole('button', { name: 'Salvar agendamento' });
    await page.getByRole('button', { name: '09:00 – 09:30', exact: true }).click();
    await expect(save).toBeEnabled();
    await page.locator('#appointment-service').selectOption(service2);
    await expect(save).toBeDisabled();
    await expect.poll(() => delayed).toBe(true);
    await page.locator('#appointment-service').selectOption(OWNER_SERVICE_ID);
    await page.getByRole('button', { name: '09:00 – 09:30', exact: true }).click();
    const staleResponse = page.waitForResponse(response => response.url().endsWith('/rpc/get_owner_availability') && response.request().postDataJSON()?.p_service_id === service2);
    release();
    await staleResponse;
    await expect(page.getByRole('button', { name: '11:00 – 11:30', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '09:00 – 09:30', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#appointment-barber').selectOption(barber2);
    await expect(save).toBeDisabled();
    await page.getByRole('button', { name: '09:00 – 09:30', exact: true }).click();
    await page.locator('#appointment-date').fill('2030-10-02');
    await expect(save).toBeDisabled();
    await page.getByRole('button', { name: '09:00 – 09:30', exact: true }).click();
    await page.locator('#appointment-client-name').fill('IDs distintos');
    await page.locator('#appointment-client-phone').fill('81999990000');
    await save.click();
    await expect.poll(() => network.appointmentInsertRequests.length).toBe(1);
    expect(network.appointmentInsertRequests[0]).toMatchObject({ barber_id: barber2, service_id: OWNER_SERVICE_ID, start_at: '2030-10-02T09:00:00-03:00', end_at: '2030-10-02T09:30:00-03:00' });
  });

  for (const state of ['empty', 'error', 'timezone'] as const) {
    test(`owner availability ${state} never invents local slots`, async ({ page }) => {
      await installOwnerSupabaseMocks(page, {
        barbershops: [{ ...ownerBarbershop, operational_timezone: state === 'timezone' ? null : 'America/Recife' }],
        availability: async () => state === 'empty' ? { status: 200, body: [] } : { status: 400, body: { message: 'PUBLIC_AVAILABILITY_INVALID_SERVICE' } }
      });
      await signInAsOwner(page);
      await page.getByRole('button', { name: 'Agendar', exact: true }).last().click();
      await expect(page.getByText(state === 'empty' ? 'Nenhum horário disponível nesta data.' : state === 'timezone' ? 'Configure o fuso operacional da barbearia antes de agendar.' : 'Não foi possível consultar os horários. Verifique o serviço, o barbeiro e a configuração da agenda.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Salvar agendamento' })).toBeDisabled();
      await expect(page.locator('#appointment-time')).toHaveCount(0);
    });
  }

  test('owner availability protects completed history in Agenda', async ({ page }) => {
    const appointment = makeAppointmentRow({ id: 'history', clientName: 'Histórico', barberId: OWNER_BARBER_ID, barberName: 'Leo Barber', barbershopId: OWNER_BARBERSHOP_ID, date: getTodayString(), time: '09:00' });
    const network = await installOwnerSupabaseMocks(page, { appointments: [{ ...appointment, status: 'completed' }] });
    await signInAsOwner(page);
    await page.locator('article').filter({ hasText: 'Histórico' }).getByRole('button', { name: 'Ver detalhes' }).click();
    await expect(page.getByRole('heading', { name: 'Detalhes do agendamento' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reagendar', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salvar agendamento' })).toHaveCount(0);
    expect(network.availabilityRequests).toEqual([]);
  });
  for (const browserZone of ['UTC', 'America/Recife', 'America/New_York']) {
    test.describe(`financial calendar in ${browserZone}`, () => {
      test.use({ timezoneId: browserZone });
      test('uses tenant calendar for history, presets and CSV without changing agenda', async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-10-01T02:45:00Z'));
        const appointments = ['Included', 'Excluded'].map((name, index) => {
          const appointment = makeAppointmentRow({ id: `zone-${index}`, clientName: name,
            barberId: OWNER_BARBER_ID, barberName: 'Leo Barber', barbershopId: OWNER_BARBERSHOP_ID, date: '2026-09-29', time: '10:00' });
          appointment.status = 'completed';
          appointment.financial_record_id = `finance-${index}`;
          return appointment;
        });
        const financialRecords: MockFinancialRecord[] = appointments.map((a, index) => ({
          id: a.financial_record_id!, appointment_id: a.id, barbershop_id: a.barbershop_id,
          barber_id: a.barber_id, service_id: a.service_id, service_type: a.service_type,
          service_value: 60, commission_rate: 50, commission_value: 30,
          completed_at: index === 0 ? '2026-10-01T02:30:00Z' : '2026-10-01T03:30:00Z',
          created_at: '2026-10-01T03:30:00Z'
        }));
        await installOwnerSupabaseMocks(page, { appointments, financialRecords,
          barbershops: [{ ...ownerBarbershop, financial_timezone: 'America/Recife' }] });
        await signInAsOwner(page);
        await expect(page.getByLabel('Data financeira', { exact: true })).toHaveValue('2026-09-30');
        const operational = await page.getByLabel('Data operacional', { exact: true }).inputValue();
        await page.getByLabel('Data financeira', { exact: true }).fill('2026-09-29');
        await expect(page.getByLabel('Data operacional', { exact: true })).toHaveValue(operational);
        await page.getByRole('button', { name: 'Clientes', exact: true }).click();
        await page.getByLabel('Data de conclusão', { exact: true }).fill('2026-09-30');
        await expect(page.getByRole('cell', { name: /^Included/ })).toBeVisible();
        await expect(page.getByRole('cell', { name: /^Excluded/ })).toHaveCount(0);
        await expect(page.locator('#tour-stats')).toContainText('R$ 60,00');
        await page.getByTitle('Exportar Dados (PDF/Excel)').click();
        await page.getByRole('button', { name: 'Hoje', exact: true }).click();
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Gerar Excel' }).click();
        const stream = await (await download).createReadStream();
        let csv = '';
        for await (const chunk of stream!) csv += chunk.toString();
        expect(csv).toContain('Included');
        expect(csv).not.toContain('Excluded');
        expect(csv).toContain('30/09/2026;23:30');
        const pdfDownload = page.waitForEvent('download');
        await page.getByTitle('Baixar Relatório do Dia (PDF)').click();
        const pdfStream = await (await pdfDownload).createReadStream();
        let pdf = '';
        for await (const chunk of pdfStream!) pdf += chunk.toString('latin1');
        expect(pdf).toContain('Included');
        expect(pdf).not.toContain('Excluded');
        expect(pdf).toContain('30/09/2026 23:30');
        await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
        await expect(page.locator('input[type="month"]')).toHaveValue('2026-09');
        await expect(page.getByText('30/09/2026', { exact: true })).toBeVisible();
        await page.reload();
        await page.getByRole('button', { name: 'Clientes', exact: true }).click();
        await expect(page.getByLabel('Data de conclusão', { exact: true })).toHaveValue('2026-09-30');
        await expect(page.getByRole('cell', { name: /^Included/ })).toBeVisible();
        await expect(page.getByRole('cell', { name: /^Excluded/ })).toHaveCount(0);
      });
    });
  }
  test.describe('operational timezone configuration', () => {
    test.use({ timezoneId: 'America/New_York' });

    for (const confirmed of [false, true]) {
      test(`onboarding sends operational timezone only when confirmed=${confirmed}`, async ({ page }) => {
        const network = await installOwnerSupabaseMocks(page, { profile: {
          id: OWNER_USER_ID, display_name: OWNER_DISPLAY_NAME, role: 'owner', active: true, barbershop_id: null, barber_id: null
        }, barbershops: [] });
        await signInAsOwner(page);
        await expect(page.getByLabel('Timezone operacional IANA (opcional)')).toHaveValue('America/New_York');
        expect(network.onboardingRequests).toHaveLength(0);
        await page.getByLabel('Nome da barbearia').fill('Operational Shop');
        if (confirmed) await page.getByLabel('Confirmo a timezone operacional da barbearia').check();
        await page.getByRole('button', { name: 'Criar barbearia', exact: true }).click();
        await page.waitForURL(url => url.pathname === '/');
        await expect(page.getByRole('heading', { name: 'Agenda do dia' })).toBeVisible();
        const payload = network.onboardingRequests[0].body;
        if (confirmed) expect(payload).toMatchObject({ p_operational_timezone: 'America/New_York', p_financial_timezone: null });
        else expect(payload).not.toHaveProperty('p_operational_timezone');
        await openOwnerManagement(page);
        await expect(page.getByText(confirmed ? 'Timezone operacional atual: America/New_York' : 'Não configurado', { exact: true })).toBeVisible();
        expect(network.operationalTimezoneRequests).toHaveLength(0);
        expect(network.financialTimezoneRequests).toHaveLength(0);
      });
    }

    test('explicit settings save and subsequent edit survive reload independently of finance', async ({ page }) => {
      const duplicateKeys: string[] = [];
      page.on('console', message => {
        if (message.type() === 'error' && message.text().includes('same key')) duplicateKeys.push(message.text());
      });
      const network = await installOwnerSupabaseMocks(page, { barbershops: [{ ...ownerBarbershop, financial_timezone: 'UTC' }] });
      await signInAsOwner(page, '/#management-public-presence');
      await expect(page.getByText('Não configurado', { exact: true })).toBeVisible();
      const input = page.getByLabel('Timezone operacional IANA', { exact: true });
      await expect(input).toHaveValue('America/New_York');
      expect(network.operationalTimezoneRequests).toHaveLength(0);
      await input.fill('Not/AZone');
      await page.getByRole('button', { name: 'Confirmar timezone operacional', exact: true }).click();
      await expect(page.getByText('Informe uma timezone operacional IANA válida.')).toBeVisible();
      expect(network.operationalTimezoneRequests).toHaveLength(0);
      for (const timezone of ['America/Recife', 'America/New_York']) {
        await input.fill(timezone);
        await page.getByRole('button', { name: 'Confirmar timezone operacional', exact: true }).click();
        await expect(page.getByText(`Timezone operacional atual: ${timezone}`)).toBeVisible();
        await page.reload();
        await expect(input).toHaveValue(timezone);
        await expect(page.getByText('Timezone atual: UTC', { exact: true })).toBeVisible();
      }
      expect(network.operationalTimezoneRequests.map(request => request.body)).toEqual([
        { operational_timezone: 'America/Recife' }, { operational_timezone: 'America/New_York' }
      ]);
      expect(network.financialTimezoneRequests).toHaveLength(0);
      expect(duplicateKeys).toEqual([]);
    });
  });

  test.describe('financial timezone configuration', () => {
    test.use({ timezoneId: 'America/New_York' });

    for (const confirmed of [false, true]) {
      test(`onboarding persists timezone only when confirmed=${confirmed}`, async ({ page }) => {
        const failedRequests: string[] = [];
        page.on('requestfailed', request => failedRequests.push(`${new URL(request.url()).pathname}: ${request.failure()?.errorText}`));
        const network = await installOwnerSupabaseMocks(page, { profile: {
          id: OWNER_USER_ID, display_name: OWNER_DISPLAY_NAME, role: 'owner', active: true, barbershop_id: null, barber_id: null
        }, barbershops: [] });
        await signInAsOwner(page);
        await expect(page.getByLabel('Timezone financeira IANA (opcional)')).toHaveValue('America/New_York');
        expect(network.onboardingRequests).toHaveLength(0);
        await page.getByLabel('Nome da barbearia').fill('Timezone Shop');
        if (confirmed) await page.getByLabel('Confirmo a timezone financeira da barbearia').check();
        const financialLoaded = page.waitForResponse(response => response.url().includes('/rest/v1/financial_records'));
        await page.getByRole('button', { name: 'Criar barbearia', exact: true }).click();
        await page.waitForURL(url => url.pathname === '/');
        await expect(page.getByRole('heading', { name: 'Agenda do dia' })).toBeVisible();
        await (await financialLoaded).finished();
        if (confirmed) expect(network.onboardingRequests[0].body).toHaveProperty('p_financial_timezone', 'America/New_York');
        else expect(network.onboardingRequests[0].body).not.toHaveProperty('p_financial_timezone');
        await openOwnerManagement(page);
        await expect(page.getByText(confirmed ? 'Timezone atual: America/New_York' : 'Timezone financeira não configurada', { exact: true })).toBeVisible();
        expect(network.financialTimezoneRequests).toHaveLength(0);
        // The existing onboarding redirect cancels in-flight requests from the old page.
        expect(failedRequests.filter(failure => !failure.endsWith(': net::ERR_ABORTED'))).toEqual([]);
      });
    }

    test('existing null requires confirmation and saved timezone survives reload and login', async ({ page }) => {
      const network = await installOwnerSupabaseMocks(page);
      await signInAsOwner(page, '/#management-public-presence');
      await expect(page.getByText('Timezone financeira não configurada', { exact: true })).toBeVisible();
      const input = page.getByLabel('Timezone IANA', { exact: true });
      await expect(input).toHaveValue('America/New_York');
      expect(network.financialTimezoneRequests).toHaveLength(0);
      await input.fill('Not/AZone');
      await page.getByRole('button', { name: 'Confirmar e salvar timezone' }).click();
      await expect(page.getByText('Informe uma timezone IANA válida.')).toBeVisible();
      expect(network.financialTimezoneRequests).toHaveLength(0);
      await input.fill('America/Recife');
      await page.getByRole('button', { name: 'Confirmar e salvar timezone' }).click();
      await expect(page.getByText('Timezone atual: America/Recife')).toBeVisible();
      expect(network.financialTimezoneRequests[0].body).toEqual({ financial_timezone: 'America/Recife' });
      await page.reload();
      await expect(input).toHaveValue('America/Recife');
      expect(network.financialTimezoneRequests).toHaveLength(1);
      await input.fill('America/Sao_Paulo');
      await page.getByRole('button', { name: 'Confirmar e salvar timezone' }).click();
      await expect(page.getByText('Timezone atual: America/Sao_Paulo')).toBeVisible();
      await page.route(`${SUPABASE_URL}/auth/v1/logout*`, route => route.fulfill({ status: 204, headers: CORS_HEADERS }));
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: 'Sair', exact: true }).click();
      await expect(page.getByRole('heading', { name: /Painel interno/i })).toBeVisible();
      await signInAsOwner(page, '/#management-public-presence');
      await expect(input).toHaveValue('America/Sao_Paulo');
      expect(network.financialTimezoneRequests).toHaveLength(2);
    });
  });

  test.describe('canonical financial completion time', () => {
    test.use({ timezoneId: 'UTC' });

    for (const [startDay, completedDay] of [['2026-09-15', '2026-09-16'], ['2026-09-30', '2026-10-01']]) {
      test(`preserves completion date and totals across reload: ${startDay} to ${completedDay}`, async ({ page }) => {
        const completedAt = `${completedDay}T00:10:00.000Z`;
        await page.clock.setFixedTime(new Date(completedAt));
        const appointment = makeAppointmentRow({
          id: 'appointment-boundary', clientName: 'Cliente Fronteira', barberId: OWNER_BARBER_ID,
          barberName: 'Leo Barber', barbershopId: OWNER_BARBERSHOP_ID, date: startDay, time: '23:30'
        });
        appointment.start_at = `${startDay}T23:30:00.000Z`;
        appointment.end_at = `${completedDay}T00:00:00.000Z`;
        const network = await installOwnerSupabaseMocks(page, { appointments: [appointment], completedAt });
        await signInAsOwner(page);
        await page.getByLabel('Data operacional', { exact: true }).fill(startDay);
        await page.getByRole('button', { name: 'Concluir', exact: true }).click();
        await expect(page.getByText('Agendamento concluido e financeiro lancado!')).toBeVisible();
        await page.getByRole('button', { name: 'Clientes', exact: true }).click();

        const assertCanonicalHistory = async () => {
          const date = page.getByLabel('Data de conclusão', { exact: true });
          await date.fill(startDay);
          await expect(page.getByRole('cell', { name: /Cliente Fronteira/ })).toHaveCount(0);
          await date.fill(completedDay);
          const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: /Cliente Fronteira/ }) });
          await expect(row).toBeVisible();
          await expect(row).toContainText('00:10');
          await expect(row).toContainText('R$ 60,00');
          await expect(page.locator('#tour-stats')).toContainText('R$ 60,00');
          await expect(page.locator('#tour-stats')).toContainText('R$ 30,00');
        };

        await assertCanonicalHistory();
        await page.reload();
        await page.getByRole('button', { name: 'Clientes', exact: true }).click();
        await assertCanonicalHistory();
        expect(appointment.start_at).toBe(`${startDay}T23:30:00.000Z`);
        expect(network.completionRequests).toHaveLength(1);
        expect(network.appointmentUpdateRequests).toHaveLength(0);
      });
    }

    for (const status of [200, 500]) {
      test(`does not invent finance when the post-completion read is unavailable (${status})`, async ({ page }) => {
        const completedAt = '2026-10-01T10:10:00.000Z';
        await page.clock.setFixedTime(new Date(completedAt));
        const appointment = makeAppointmentRow({
          id: 'appointment-read-failure', clientName: 'Cliente Leitura', barberId: OWNER_BARBER_ID,
          barberName: 'Leo Barber', barbershopId: OWNER_BARBERSHOP_ID, date: '2026-10-01', time: '06:00'
        });
        const financialRecords: MockFinancialRecord[] = [];
        const network = await installOwnerSupabaseMocks(page, { appointments: [appointment], financialRecords, completedAt });
        await signInAsOwner(page);
        await expect(page.getByRole('button', { name: 'Concluir', exact: true })).toBeVisible();
        const financialUrl = `${SUPABASE_URL}/rest/v1/financial_records*`;
        await page.route(financialUrl, route => fulfillJson(route, status, status === 200 ? [] : { message: 'Read unavailable' }));
        await page.getByRole('button', { name: 'Concluir', exact: true }).click();
        await expect(page.getByText('Atendimento concluido, mas nao foi possivel atualizar o financeiro. Atualize a pagina.')).toBeVisible();
        expect(appointment.status).toBe('completed');
        expect(financialRecords).toHaveLength(1);
        expect(financialRecords[0].completed_at).toBe(completedAt);
        await page.getByRole('button', { name: 'Clientes', exact: true }).click();
        await expect(page.getByRole('cell', { name: /Cliente Leitura/ })).toHaveCount(0);
        await expect(page.locator('#tour-stats')).not.toContainText('R$ 60,00');
        await page.unroute(financialUrl);
        await page.reload();
        await page.getByRole('button', { name: 'Clientes', exact: true }).click();
        const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: /Cliente Leitura/ }) });
        await expect(row).toContainText('10:10');
        expect(network.completionRequests).toHaveLength(1);
        expect(financialRecords).toHaveLength(1);
      });
    }
  });

  test('new owner completes onboarding atomically and reaches dashboard without reload', async ({ page }) => {
    const network = await installOwnerSupabaseMocks(page, {
      profile: {
        id: OWNER_USER_ID,
        display_name: OWNER_DISPLAY_NAME,
        role: 'owner',
        active: true,
        barbershop_id: null,
        barber_id: null
      },
      barbershops: []
    });

    await signInAsOwner(page);
    await expect(page.getByRole('heading', { name: 'Crie sua barbearia' })).toBeVisible();
    await page.getByLabel('Nome da barbearia').fill('Barbearia Atomic');
    await page.getByLabel('Slug').fill('barbearia-atomic');
    await page.getByLabel('Telefone').fill('81999999999');
    await page.getByLabel('WhatsApp').fill('81999999999');
    await page.getByRole('button', { name: 'Criar barbearia' }).click();

    await expect(page.getByRole('heading', { name: 'Agenda do dia' })).toBeVisible();
    expect(network.onboardingRequests).toHaveLength(1);
    expect(network.onboardingRequests[0].body).toMatchObject({
      p_name: 'Barbearia Atomic',
      p_slug: 'barbearia-atomic'
    });
  });

  test('failed owner onboarding shows friendly error and creates no phantom tenant', async ({ page }) => {
    const network = await installOwnerSupabaseMocks(page, {
      profile: {
        id: OWNER_USER_ID,
        display_name: OWNER_DISPLAY_NAME,
        role: 'owner',
        active: true,
        barbershop_id: null,
        barber_id: null
      },
      barbershops: [],
      onboardingRpcResponse: {
        status: 400,
        body: { message: 'OWNER_ONBOARDING_SLUG_TAKEN' }
      }
    });

    await signInAsOwner(page);
    await page.getByLabel('Nome da barbearia').fill('Duplicate Shop');
    await page.getByLabel('Slug').fill('duplicate-shop');
    await page.getByRole('button', { name: 'Criar barbearia' }).click();

    await expect(page.getByText('Este slug ja esta em uso. Escolha outro.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Crie sua barbearia' })).toBeVisible();
    expect(network.onboardingRequests).toHaveLength(1);
  });

  test('financial completion persists after reload and remote failure creates no phantom record', async ({ page, browser }) => {
    const network = await installOwnerSupabaseMocks(page);
    await signInAsOwner(page);

    await page.getByRole('button', { name: 'Concluir' }).first().click();
    await expect(page.getByText('Agendamento concluido e financeiro lancado!')).toBeVisible();
    expect(network.completionRequests).toHaveLength(1);

    await page.getByRole('button', { name: 'Clientes' }).click();
    await expect(page.getByText('Data de conclusão', { exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Cliente Leo/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Excluir atendimento de Cliente Leo' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Ver detalhes atendimento de Cliente Leo' }).click();
    await expect(page.getByRole('heading', { name: 'Detalhes do agendamento' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Cliente', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Salvar agendamento' })).toHaveCount(0);
    await page.getByText(/Os dados ficam somente para consulta/).locator('..').evaluate((form) => (
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    ));
    expect(network.appointmentUpdateRequests).toHaveLength(0);
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
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

  test('linked client uses the modern appointment update flow', async ({ page }) => {
    const today = getTodayString();
    const linkedAppointment = makeAppointmentRow({
      id: 'appointment-linked-client',
      clientName: 'Cliente Editavel',
      barberId: OWNER_BARBER_ID,
      barberName: 'Leo Barber',
      barbershopId: OWNER_BARBERSHOP_ID,
      date: today,
      time: '11:00'
    });
    const network = await installOwnerSupabaseMocks(page, {
      appointments: [linkedAppointment],
      financialRecords: [{
        id: 'financial-linked-client',
        appointment_id: linkedAppointment.id,
        barbershop_id: OWNER_BARBERSHOP_ID,
        barber_id: OWNER_BARBER_ID,
        service_id: OWNER_SERVICE_ID,
        service_type: 'Corte Leo',
        service_value: 60,
        commission_rate: 50,
        commission_value: 30,
        completed_at: linkedAppointment.start_at,
        created_at: linkedAppointment.created_at
      }]
    });

    await signInAsOwner(page);
    await page.getByRole('button', { name: 'Clientes' }).click();
    await page.getByRole('button', { name: 'Editar atendimento de Cliente Editavel' }).click();

    await expect(page.getByRole('heading', { name: 'Editar agendamento' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Cliente', exact: true })).toHaveValue('Cliente Editavel');
    await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('Cliente Atualizado');
    await page.getByRole('button', { name: 'Salvar agendamento' }).click();

    await expect.poll(() => network.appointmentUpdateRequests.length).toBe(1);
    expect(network.appointmentUpdateRequests[0].body).toMatchObject({
      p_appointment_id: linkedAppointment.id,
      p_client_name: 'Cliente Atualizado'
    });
    await expect(page.getByText('Agendamento atualizado!')).toBeVisible();
  });

  test('owner sees only own tenant data, operational checklist, and public booking link', async ({ page }) => {
    const network = await installOwnerSupabaseMocks(page);

    await signInAsOwner(page);

    await expect(page.getByText('leo do leo', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Prontidão operacional/i, includeHidden: true })).toBeHidden();
    await expect(page.getByRole('heading', { name: /Catálogo operacional/i, includeHidden: true })).toBeHidden();
    await openOwnerManagement(page);
    await expect(page.getByRole('heading', { name: /Prontidão operacional/i })).toBeVisible();
    await expect(page.getByText(/Booking pronto para receber agendamentos\./i)).toBeVisible();
    await expect(page.getByText('/book/leo-do-leo')).toBeVisible();
    await expect(page.getByRole('link', { name: /Abrir link/i })).toHaveAttribute('href', '/book/leo-do-leo');

    await expect(page.getByRole('heading', { name: /Catálogo operacional/i })).toBeVisible();
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
    expect(network.appointmentReadRequests).toHaveLength(0);
  });

  test('remote owner cannot create an ephemeral vale', async ({ page }) => {
    await installOwnerSupabaseMocks(page);
    await signInAsOwner(page);

    const valeButton = page.getByRole('button', { name: 'Vale', exact: true });
    await expect(valeButton).toBeDisabled();
    await page.getByRole('navigation', { name: 'Secoes do painel', exact: true })
      .getByRole('button', { name: 'Vales' })
      .click();

    await expect(page.getByRole('status', { name: 'Vales indisponiveis no ambiente online' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Registrar Vale' })).toHaveCount(0);
  });

  test('remote settings do not expose local backup or restore actions', async ({ page }) => {
    await installOwnerSupabaseMocks(page);
    await signInAsOwner(page);
    await page.locator('#tour-settings-btn').click();

    await expect(page.getByText('Backup e restauração locais estão disponíveis apenas no modo local de demonstração.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Baixar Backup' })).toHaveCount(0);
    await expect(page.getByText('Restaurar Dados')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salvar Alterações' })).toBeVisible();
  });

  test('owner management workspace is responsive and returns to the agenda', async ({ page }) => {
    await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installOwnerSupabaseMocks(page);
    await signInAsOwner(page);
    await openOwnerManagement(page);
    await expect(page).toHaveURL(/#management-public-presence$/);

    await expect(page.getByRole('heading', { name: 'Gestão da barbearia' })).toBeVisible();
    await expect(page.getByText('Prévia pública')).toBeVisible();
    await expect(page.getByText('Capa da barbearia')).toBeVisible();
    await expect(page.locator('.ui-branding-preview[class~="bg-gray-950/80"]')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Grupos da gestão' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Configurações da barbearia/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Vincular barbeiro à equipe/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Catálogo operacional/i })).toBeVisible();
    await page.getByLabel('Nome da barbearia').fill('Nome em edicao nao salvo');

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
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
      await expect(page.getByRole('link', { name: 'Presença pública' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Salvar aparência/i })).toBeVisible();

      const contrast = await page.evaluate(() => {
        const parseRgb = (value: string): [number, number, number] => {
          const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
          if (!channels || channels.length !== 3) throw new Error(`Unsupported color: ${value}`);
          return channels as [number, number, number];
        };
        const luminance = (value: string) => {
          const channels = parseRgb(value).map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
          });
          return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
        };
        const ratio = (foreground: string, background: string) => {
          const light = Math.max(luminance(foreground), luminance(background));
          const dark = Math.min(luminance(foreground), luminance(background));
          return (light + 0.05) / (dark + 0.05);
        };
        const root = document.querySelector<HTMLElement>('.ui-branding-settings');
        const heading = root?.querySelector<HTMLElement>('h2');
        const label = root?.querySelector<HTMLElement>('.ui-branding-label');
        const input = root?.querySelector<HTMLInputElement>('.ui-input[type="text"]');
        const button = root?.querySelector<HTMLButtonElement>('button[type="submit"]');
        const preview = root?.querySelector<HTMLElement>('.ui-branding-preview-card');
        const previewHeading = preview?.querySelector<HTMLElement>('h3');
        const previewDescription = preview?.querySelector<HTMLElement>('p');
        if (!root || !heading || !label || !input || !button || !preview || !previewHeading || !previewDescription) {
          throw new Error('Branding controls not found');
        }

        const surface = getComputedStyle(root).backgroundColor;
        const inputStyle = getComputedStyle(input);
        const buttonStyle = getComputedStyle(button);
        return {
          heading: ratio(getComputedStyle(heading).color, surface),
          label: ratio(getComputedStyle(label).color, surface),
          input: ratio(inputStyle.color, inputStyle.backgroundColor),
          placeholder: ratio(getComputedStyle(input, '::placeholder').color, inputStyle.backgroundColor),
          button: ratio(buttonStyle.color, buttonStyle.backgroundColor),
          previewHeading: ratio(getComputedStyle(previewHeading).color, getComputedStyle(preview).backgroundColor),
          previewDescription: ratio(getComputedStyle(previewDescription).color, getComputedStyle(preview).backgroundColor)
        };
      });

      expect(contrast.heading).toBeGreaterThanOrEqual(4.5);
      expect(contrast.label).toBeGreaterThanOrEqual(4.5);
      expect(contrast.input).toBeGreaterThanOrEqual(4.5);
      expect(contrast.placeholder).toBeGreaterThanOrEqual(4.5);
      expect(contrast.button).toBeGreaterThanOrEqual(4.5);
      expect(contrast.previewHeading).toBeGreaterThanOrEqual(4.5);
      expect(contrast.previewDescription).toBeGreaterThanOrEqual(4.5);
    }

    await page.setViewportSize({ width: 390, height: 844 });

    await page.getByRole('button', { name: 'Abrir navegacao' }).click();
    const mobileNavigation = page.getByRole('complementary', { name: 'Navegacao mobile' });
    await mobileNavigation.getByRole('button', { name: 'Agenda' }).click();
    await expect(page.getByRole('heading', { name: 'Agenda do dia' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gestão da barbearia', includeHidden: true })).toBeHidden();

    await page.setViewportSize({ width: 195, height: 422 });
    await page.getByRole('button', { name: 'Abrir navegacao' }).click();
    await page.getByRole('complementary', { name: 'Navegacao mobile' }).getByRole('button', { name: 'Gestão' }).click();
    await expect(page.getByLabel('Nome da barbearia')).toHaveValue('Nome em edicao nao salvo');
    const zoomDimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(zoomDimensions.scrollWidth).toBeLessThanOrEqual(zoomDimensions.clientWidth + 1);
  });

  test('owner restores management hashes on refresh and browser history', async ({ page }) => {
    await installOwnerSupabaseMocks(page);
    await signInAsOwner(page, '/#management-team');

    await expect(page.locator('a[href="#management-team"]')).toHaveAttribute('aria-current', 'page');
    await page.reload();
    await expect(page.locator('a[href="#management-team"]')).toHaveAttribute('aria-current', 'page');

    await page.locator('a[href="#management-catalog"]').click();
    await expect(page).toHaveURL(/#management-catalog$/);
    await page.reload();
    await expect(page.locator('a[href="#management-catalog"]')).toHaveAttribute('aria-current', 'page');

    await page.goBack();
    await expect(page.locator('a[href="#management-team"]')).toHaveAttribute('aria-current', 'page');
    await page.goForward();
    await expect(page.locator('a[href="#management-catalog"]')).toHaveAttribute('aria-current', 'page');

    await page.goto('/#management-unknown');
    await expect(page.getByRole('heading', { name: 'Agenda do dia' })).toBeVisible();
    await expect(page.locator('#management-team')).toBeHidden();
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
    await desktopNavigation.getByRole('button', { name: 'Relatórios' }).click();
    await expect(page.getByRole('heading', { name: 'Relatórios', exact: true })).toBeVisible();

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
      await expect(page.getByRole('heading', { name: 'Relatórios', exact: true })).toBeVisible();
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
    await page.clock.setFixedTime(new Date('2030-10-01T01:00:00Z'));
    await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) => route.abort());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installOwnerSupabaseMocks(page, {
      barbershops: [{ ...ownerBarbershop, operational_timezone: 'America/Recife' }],
      appointments: [makeAppointmentRow({
        id: 'appointment-owner-tenant',
        clientName: 'Cliente Leo',
        barberId: OWNER_BARBER_ID,
        barberName: 'Leo Barber',
        barbershopId: OWNER_BARBERSHOP_ID,
        date: '2030-09-30',
        time: '09:00'
      })]
    });
    await signInAsOwner(page);

    await expect(page.getByRole('heading', { name: 'Agenda do dia' })).toBeVisible();
    const initialDate = await page.getByLabel('Data da agenda').inputValue();
    expect(initialDate).toBe('2030-09-30');
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

    const team = page.locator('#management-team');
    await expect(team.getByRole('heading', { name: /Vincular barbeiro à equipe/i })).toBeVisible();
    await expect(page.getByText(/O barbeiro cria uma conta usando o e-mail dele/i)).toBeVisible();
    await expect(page.getByText(OWNER_BARBER_ID)).toHaveCount(0);
    await expect(team.getByLabel('E-mail usado no login')).toHaveCount(1);
    await expect(team.getByLabel('Profissional correspondente')).toHaveCount(1);
    await team.getByRole('button', { name: /Vincular usuário/i }).click();
    await expect(team.getByRole('alert')).toContainText('Informe o e-mail usado pelo barbeiro no login.');
    await team.getByLabel('E-mail usado no login').fill('  BARBER@EXAMPLE.COM  ');
    await team.getByRole('button', { name: /Vincular usuário/i }).click();
    await expect(team.getByRole('alert')).toContainText('Escolha o profissional correspondente.');
    await team.getByLabel('Profissional correspondente').selectOption(OWNER_BARBER_ID);
    const linkButton = team.getByRole('button', { name: /Vincular usuário/i });
    await expect(linkButton).toBeEnabled();
    await linkButton.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });

    await expect.poll(() => network.rpcRequests.length).toBe(1);
    await expect(page.getByText(/Conta vinculada ao profissional Leo Barber/i)).toBeVisible();
    await expect(page.getByText(/E-mail usado: barber@example\.com/i)).toBeVisible();
    await expect(page.getByText(/sair e entrar novamente/i)).toBeVisible();
    await expect(team.getByLabel('E-mail usado no login')).toHaveValue('');
    await expect(team.getByLabel('Profissional correspondente')).toHaveValue('');
    await expect(team.getByLabel('Profissional correspondente').locator(`option[value="${OWNER_BARBER_ID}"]`)).toHaveCount(0);
    await expect(team.getByText('Vinculado', { exact: true })).toBeVisible();

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

      await page.getByLabel('E-mail usado no login').fill('barber@example.com');
      await page.getByLabel('Profissional correspondente').selectOption(OWNER_BARBER_ID);
      const linkButton = page.getByRole('button', { name: /Vincular usuário/i });
      await expect(linkButton).toBeEnabled();
      await linkButton.evaluate((button: HTMLButtonElement) => button.click());

      await expect.poll(() => network.rpcRequests.length).toBe(1);
      await expect(page.getByText(message)).toBeVisible();
      await expect(page.getByLabel('E-mail usado no login')).toHaveValue('barber@example.com');
      await expect(page.getByLabel('Profissional correspondente')).toHaveValue(OWNER_BARBER_ID);
    });
  }
});
