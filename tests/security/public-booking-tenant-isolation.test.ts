import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Appointment } from '../../types';
import {
  PUBLIC_BOOKING_ACTIVE_LIMIT_MESSAGE,
  PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE,
  PUBLIC_BOOKING_RATE_LIMIT_MESSAGE
} from '../../scheduling';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn()
}));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  isProductionWithoutSupabase: false,
  shouldUseLocalFallback: false,
  assertOperationalSupabase: vi.fn(),
  supabase: supabaseMock
}));

import { createAppointment, createPublicAppointment, listInternalAppointments, listPublicAppointmentSlots, listPublicAvailability } from '../../services/appointmentRepository';
import { listBarbers } from '../../services/barberRepository';
import { listPublicServices } from '../../services/serviceRepository';

const createOrderedBarbersQuery = (result: {
  data: Array<{ id: string; name: string; barbershop_id: string | null; active: boolean }>;
  error: null;
}) => {
  const query = {
    eq: vi.fn(),
    order: vi.fn()
  };
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue({
    returns: vi.fn().mockResolvedValue(result)
  });
  return query;
};


const createOrderedAppointmentsQuery = (result: {
  data: Array<{
    id: string;
    barbershop_id: string | null;
    client_name: string;
    client_phone: string;
    barber_id: string | null;
    barber_name: string;
    service_id: string | null;
    service_type: string;
    service_value: number;
    start_at: string;
    end_at: string;
    status: Appointment['status'];
    notes: string | null;
    financial_record_id: string | null;
    created_at: string;
    updated_at: string;
  }>;
  error: null;
}) => {
  const query = {
    eq: vi.fn(),
    order: vi.fn(),
    then: undefined as unknown as Promise<{ data: unknown[]; error: null }>['then']
  };
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.then = Promise.resolve(result).then.bind(Promise.resolve(result));
  return query;
};

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'appointment-1',
  barbershopId: 'shop-leo',
  barberId: 'barber-leo',
  serviceId: 'service-leo',
  clientName: 'Cliente Leo',
  clientPhone: '85999990000',
  barberName: 'Leo',
  serviceType: 'Corte Leo',
  serviceValue: 70,
  startAt: '2026-06-22T15:00:00.000Z',
  endAt: '2026-06-22T15:45:00.000Z',
  status: 'scheduled',
  createdAt: '2026-06-22T10:00:00.000Z',
  updatedAt: '2026-06-22T10:00:00.000Z',
  ...overrides
});


describe('public booking tenant isolation repositories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('filters public barbers by active status and barbershop_id', async () => {
    const query = createOrderedBarbersQuery({
      data: [
        { id: 'barber-leo', name: 'Leo', barbershop_id: 'shop-leo', active: true }
      ],
      error: null
    });
    const select = vi.fn().mockReturnValue(query);

    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== 'barbers') throw new Error(`Unexpected table ${table}`);
      return { select };
    });

    const barbers = await listBarbers('shop-leo');

    expect(supabaseMock.from).toHaveBeenCalledWith('barbers');
    expect(select).toHaveBeenCalledWith('id,name,barbershop_id,active');
    expect(query.eq).toHaveBeenNthCalledWith(1, 'barbershop_id', 'shop-leo');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'active', true);
    expect(barbers).toEqual([
      { id: 'barber-leo', name: 'Leo', barbershopId: 'shop-leo', active: true }
    ]);
  });

  it('loads public services from the slug-scoped proxy without direct table access', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      services: [{ id: 'service-leo', name: 'Corte Leo', price: 70, duration_minutes: 45 }]
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const services = await listPublicServices('shop-leo', 'tenant-leo');

    expect(fetch).toHaveBeenCalledWith('/api/public-booking/catalog?slug=shop-leo', {
      method: 'GET',
      headers: { accept: 'application/json' }
    });
    expect(supabaseMock.from).not.toHaveBeenCalledWith('services');
    expect(services).toEqual([
      {
        id: 'service-leo',
        name: 'Corte Leo',
        barbershopId: 'tenant-leo',
        price: 70,
        durationMinutes: 45,
        active: true
      }
    ]);
  });

  it('owner reads only appointments from the current barbershop_id', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          viewer_role: 'owner',
          id: 'appointment-leo',
          barbershop_id: 'shop-leo',
          client_name: 'Cliente Leo',
          client_phone: '85999990000',
          barber_id: 'barber-leo',
          barber_name: 'Leo',
          service_id: 'service-leo',
          service_type: 'Corte Leo',
          service_value: 70,
          start_at: '2026-06-22T15:00:00.000Z',
          end_at: '2026-06-22T15:45:00.000Z',
          status: 'scheduled',
          notes: null,
          financial_record_id: null,
          created_at: '2026-06-22T10:00:00.000Z',
          updated_at: '2026-06-22T10:00:00.000Z'
        }
      ],
      error: null
    });
    const appointments = await listInternalAppointments('shop-leo');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_internal_appointments');
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(appointments).toHaveLength(1);
    expect(appointments[0]?.barbershopId).toBe('shop-leo');
  });

  it('barber reads only appointments from the current barbershop_id and own barber_id', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          viewer_role: 'barber',
          id: 'appointment-gabriel',
          barbershop_id: 'shop-leo',
          client_name: 'Cliente Gabriel',
          client_phone: null,
          barber_id: 'barber-gabriel',
          barber_name: 'Gabriel',
          service_id: 'service-leo',
          service_type: 'Corte Leo',
          service_value: null,
          commission_rate: null,
          start_at: '2026-06-22T16:00:00.000Z',
          end_at: '2026-06-22T16:45:00.000Z',
          status: 'scheduled',
          notes: null,
          financial_record_id: null,
          created_at: null,
          updated_at: null
        }
      ],
      error: null
    });
    const appointments = await listInternalAppointments('shop-leo', 'barber-gabriel');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_internal_appointments');
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(appointments).toHaveLength(1);
    expect(appointments[0]?.barberId).toBe('barber-gabriel');
    expect(appointments[0]?.barbershopId).toBe('shop-leo');
    expect(appointments[0]).not.toHaveProperty('clientPhone');
    expect(appointments[0]).not.toHaveProperty('serviceValue');
  });

  it('public booking reads occupied slots through the same-origin proxy', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      slots: [
        {
          barber_id: 'barber-leo',
          barber_name: 'Leo',
          start_at: '2026-06-22T15:00:00.000Z',
          end_at: '2026-06-22T15:45:00.000Z',
          status: 'scheduled'
        }
      ]
    }), { status: 200 }));

    const slots = await listPublicAppointmentSlots('leo-do-leo', 'shop-leo');

    expect(fetch).toHaveBeenCalledWith('/api/public-booking/slots?slug=leo-do-leo', {
      method: 'GET',
      headers: { accept: 'application/json' }
    });
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('get_public_appointment_slots', expect.anything());
    expect(supabaseMock.from).not.toHaveBeenCalledWith('public_appointment_slots');
    expect(supabaseMock.from).not.toHaveBeenCalledWith('appointments');
    expect(slots).toHaveLength(1);
    expect(slots[0]?.barbershopId).toBe('shop-leo');
  });

  it('reads final slots without appointments or direct RPC and preserves offsets', async () => {
    const slot = { start_at: '2030-01-07T09:00:00-03:00', end_at: '2030-01-07T09:45:00-03:00' };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ slots: [slot] })));
    expect(await listPublicAvailability({ slug: 'shop-leo', serviceId: 'service', barberId: 'barber', localDate: '2030-01-07' })).toEqual([slot]);
    expect(fetch).toHaveBeenCalledWith('/api/public-booking/availability?slug=shop-leo&service_id=service&barber_id=barber&local_date=2030-01-07', expect.objectContaining({ method: 'GET' }));
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('rejects public slot lookup with an empty slug before the proxy', async () => {
    await expect(listPublicAppointmentSlots('   ')).rejects.toThrow('Barbearia nao encontrada ou indisponivel.');

    expect(fetch).not.toHaveBeenCalled();
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('public booking create flow does not perform SELECT on appointments', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'created-appointment-id' }), { status: 201 }));

    await expect(createPublicAppointment(makeAppointment(), [makeAppointment()])).resolves.toMatchObject({
      id: 'created-appointment-id',
      barbershopId: 'shop-leo'
    });

    expect(fetch).toHaveBeenCalledWith('/api/public-booking/create', expect.objectContaining({ method: 'POST' }));
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('create_public_appointment', expect.anything());
    expect(supabaseMock.from).not.toHaveBeenCalledWith('public_appointment_slots');
    expect(supabaseMock.from).not.toHaveBeenCalledWith('appointments');
  });

  it('does not fall back on availability errors and preserves empty success', async () => {
    const input = { slug: 'shop-leo', serviceId: 'service', barberId: 'barber', localDate: '2030-01-07' };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ slots: [] })));
    expect(await listPublicAvailability(input)).toEqual([]);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ code: 'PUBLIC_AVAILABILITY_TIMEZONE_REQUIRED', details: 'private' }), { status: 400 }));
    await expect(listPublicAvailability(input)).rejects.toThrow('precisa ser configurada');
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['PUBLIC_APPOINTMENT_INVALID_TENANT', 'Barbearia nao encontrada ou indisponivel.'],
    ['PUBLIC_APPOINTMENT_INVALID_BARBER', 'Barbeiro invalido para esta barbearia.'],
    ['PUBLIC_APPOINTMENT_INACTIVE_BARBER', 'Barbeiro indisponivel para agendamento.'],
    ['PUBLIC_APPOINTMENT_INVALID_SERVICE', 'Servico invalido para esta barbearia.'],
    ['PUBLIC_APPOINTMENT_INACTIVE_SERVICE', 'Servico indisponivel para agendamento.'],
    ['PUBLIC_APPOINTMENT_INVALID_INPUT', 'Confira os dados obrigatorios do agendamento.'],
    ['PUBLIC_APPOINTMENT_INVALID_TIME', 'Horario invalido para este servico.'],
    ['PUBLIC_APPOINTMENT_RATE_LIMITED', PUBLIC_BOOKING_RATE_LIMIT_MESSAGE],
    ['PUBLIC_APPOINTMENT_ACTIVE_LIMIT', PUBLIC_BOOKING_ACTIVE_LIMIT_MESSAGE]
  ])('maps tenant-scoped RPC error %s without direct appointment INSERT', async (rpcCode, expectedMessage) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ code: rpcCode }), { status: 400 }));

    await expect(createPublicAppointment(makeAppointment(), [])).rejects.toThrow(expectedMessage);

    expect(fetch).toHaveBeenCalledWith('/api/public-booking/create', expect.objectContaining({ method: 'POST' }));
    expect(supabaseMock.from).not.toHaveBeenCalledWith('appointments');
  });

  it('maps an RPC slot race to the friendly public conflict message', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ code: 'PUBLIC_APPOINTMENT_SLOT_CONFLICT' }), { status: 409 }));

    await expect(createPublicAppointment(makeAppointment(), [])).rejects.toThrow(
      PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE
    );
    expect(supabaseMock.from).not.toHaveBeenCalledWith('appointments');
  });

  it('preserves a WAF Retry-After hint without retrying the creation request', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ code: 'RATE_LIMITED' }), {
      status: 429,
      headers: { 'retry-after': '600' }
    }));

    const error = await createPublicAppointment(makeAppointment(), []).catch((caught) => caught) as Error & { retryAfter?: number };

    expect(error.message).toBe(PUBLIC_BOOKING_RATE_LIMIT_MESSAGE);
    expect(error.retryAfter).toBe(600);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  const persistedId = '60000000-0000-4000-8000-000000000099';
  const mockOwnerWriter = (response = { data: persistedId, error: null as null | { code: string; message: string } }) => {
    supabaseMock.from.mockImplementation(() => { throw new Error('Owner create must not access tables'); });
    supabaseMock.rpc.mockResolvedValue(response);
    const storage = { setItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    return storage;
  };

  it('uses only the six owner RPC arguments and returns a receipt, not a fabricated row', async () => {
    const storage = mockOwnerWriter();
    const appointment = makeAppointment({
      startAt: '2030-10-01T09:00:00.123456-03:00',
      endAt: '2030-10-01T10:00:00.123456-03:00',
      serviceValue: 999, commissionRate: 99, financialRecordId: 'spoofed', status: 'completed'
    });
    expect(await createAppointment(appointment, [])).toEqual({ mode: 'remote', id: persistedId });
    expect(supabaseMock.rpc).toHaveBeenCalledExactlyOnceWith('create_owner_appointment', {
      p_service_id: 'service-leo', p_barber_id: 'barber-leo',
      p_client_name: 'Cliente Leo', p_client_phone: '85999990000',
      p_start_at: appointment.startAt, p_notes: null
    });
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'] as const)(
    'defers remote conflict decisions for %s to the writer', async status => {
      mockOwnerWriter();
      await expect(createAppointment(makeAppointment(), [makeAppointment({ status })]))
        .resolves.toEqual({ mode: 'remote', id: persistedId });
      expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
      expect(supabaseMock.from).not.toHaveBeenCalled();
    }
  );

  it('uses selected service and barber IDs for homonyms, regardless of loaded tenant data', async () => {
    mockOwnerWriter();
    await createAppointment(makeAppointment({ barberId: 'barber-leo-2', serviceId: 'service-leo-2' }),
      [makeAppointment(), makeAppointment({ barbershopId: 'other-tenant' })]);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_owner_appointment', expect.objectContaining({
      p_barber_id: 'barber-leo-2', p_service_id: 'service-leo-2'
    }));
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it.each([null, '', 'not-a-uuid', {}, [persistedId], 42])('rejects malformed receipt %j without another write', async data => {
    const storage = mockOwnerWriter();
    supabaseMock.rpc.mockResolvedValue({ data, error: null });
    await expect(createAppointment(makeAppointment(), [])).rejects.toThrow('Atualize a agenda antes de tentar novamente.');
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    'OWNER_APPOINTMENT_INVALID_BARBER', 'OWNER_APPOINTMENT_INVALID_SERVICE',
    'OWNER_APPOINTMENT_CREATE_FORBIDDEN', 'APPOINTMENT_TIME_OFF_CONFLICT'
  ])('propagates server authorization/availability error %s without fallback', async message => {
    const error = { code: 'P0001', message };
    const storage = mockOwnerWriter({ data: persistedId, error });
    await expect(createAppointment(makeAppointment(), [])).rejects.toEqual(error);
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('maps the transactional conflict to the existing friendly message', async () => {
    mockOwnerWriter({ data: persistedId, error: { code: 'P0001', message: 'APPOINTMENT_ACTIVE_SLOT_CONFLICT' } });
    await expect(createAppointment(makeAppointment(), [])).rejects.toThrow(PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it.each([
    [{ clientName: '   ' }, 'Informe seu nome.'],
    [{ clientPhone: '1234' }, 'O WhatsApp deve ter 10 ou 11 digitos.'],
    [{ startAt: '2026-06-22T15:45:00.000Z', endAt: '2026-06-22T15:00:00.000Z' }, 'O horario final precisa ser maior que o horario inicial.']
  ] as const)('preserves input validation before contacting the writer: %j', async (overrides, message) => {
    mockOwnerWriter();
    await expect(createAppointment(makeAppointment(overrides), [])).rejects.toThrow(message);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
