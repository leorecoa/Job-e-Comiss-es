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

import { createAppointment, createPublicAppointment, listInternalAppointments, listPublicAppointmentSlots } from '../../services/appointmentRepository';
import { listBarbers } from '../../services/barberRepository';
import { listServices } from '../../services/serviceRepository';

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

const createOrderedServicesQuery = (result: {
  data: Array<{
    id: string;
    name: string;
    barbershop_id: string | null;
    price: number;
    duration_minutes: number;
    commission_rate: number | null;
    active: boolean;
  }>;
  error: null;
}) => {
  const query = {
    eq: vi.fn(),
    order: vi.fn()
  };
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue(result);
  return query;
};

const createTenantLookupQuery = (result: {
  data: { id: string; barbershop_id: string | null } | null;
  error: null;
}) => {
  const query = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result)
  };
  query.eq.mockReturnValue(query);
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

const mockTenantValidatedInsert = () => {
  const insert = vi.fn().mockResolvedValue({ error: null });

  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'barbers') {
      const query = createTenantLookupQuery({
        data: { id: 'barber-leo', barbershop_id: 'shop-leo' },
        error: null
      });
      return { select: vi.fn().mockReturnValue(query) };
    }

    if (table === 'services') {
      const query = createTenantLookupQuery({
        data: { id: 'service-leo', barbershop_id: 'shop-leo' },
        error: null
      });
      return { select: vi.fn().mockReturnValue(query) };
    }

    if (table === 'appointments') {
      return { insert };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return { insert };
};

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

  it('filters public services by active status and barbershop_id', async () => {
    const query = createOrderedServicesQuery({
      data: [
        {
          id: 'service-leo',
          name: 'Corte Leo',
          barbershop_id: 'shop-leo',
          price: 70,
          duration_minutes: 45,
          commission_rate: 40,
          active: true
        }
      ],
      error: null
    });
    const select = vi.fn().mockReturnValue(query);

    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== 'services') throw new Error(`Unexpected table ${table}`);
      return { select };
    });

    const services = await listServices('shop-leo');

    expect(supabaseMock.from).toHaveBeenCalledWith('services');
    expect(select).toHaveBeenCalledWith('id,name,barbershop_id,price,duration_minutes,commission_rate,active');
    expect(query.eq).toHaveBeenNthCalledWith(1, 'barbershop_id', 'shop-leo');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'active', true);
    expect(services).toEqual([
      {
        id: 'service-leo',
        name: 'Corte Leo',
        barbershopId: 'shop-leo',
        price: 70,
        durationMinutes: 45,
        commissionRate: 40,
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

  it('rejects public slot lookup with an empty slug before the proxy', async () => {
    await expect(listPublicAppointmentSlots('   ')).rejects.toThrow('Barbearia nao encontrada ou indisponivel.');

    expect(fetch).not.toHaveBeenCalled();
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('public booking create flow does not perform SELECT on appointments', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'created-appointment-id' }), { status: 201 }));

    await expect(createPublicAppointment(makeAppointment(), [])).resolves.toMatchObject({
      id: 'created-appointment-id',
      barbershopId: 'shop-leo'
    });

    expect(fetch).toHaveBeenCalledWith('/api/public-booking/create', expect.objectContaining({ method: 'POST' }));
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('create_public_appointment', expect.anything());
    expect(supabaseMock.from).not.toHaveBeenCalledWith('public_appointment_slots');
    expect(supabaseMock.from).not.toHaveBeenCalledWith('appointments');
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

  it('creates the appointment with the current barbershop_id after validating barber and service tenant ownership', async () => {
    const insertSelect = vi.fn();
    const insertSingle = vi.fn();
    const { insert } = mockTenantValidatedInsert();

    const appointment = makeAppointment();
    const created = await createAppointment(appointment, []);

    expect(insert).toHaveBeenCalledWith({
      barbershop_id: 'shop-leo',
      client_name: 'Cliente Leo',
      client_phone: '85999990000',
      commission_rate: null,
      barber_id: 'barber-leo',
      barber_name: 'Leo',
      service_id: 'service-leo',
      service_type: 'Corte Leo',
      service_value: 70,
      start_at: '2026-06-22T15:00:00.000Z',
      end_at: '2026-06-22T15:45:00.000Z',
      status: 'scheduled',
      notes: null,
      financial_record_id: null
    }, {
      defaultToNull: true
    });
    expect(insertSelect).not.toHaveBeenCalled();
    expect(insertSingle).not.toHaveBeenCalled();
    expect(created.barbershopId).toBe('shop-leo');
  });

  it.each(['scheduled', 'confirmed', 'completed'] as const)(
    'blocks duplicate appointments for status %s using barbershop_id + barber_id + start_at',
    async (status) => {
      const existing = makeAppointment({
        id: `existing-${status}`,
        status,
        startAt: '2026-06-22T15:00:00.000Z',
        endAt: '2026-06-22T15:45:00.000Z'
      });

      await expect(
        createAppointment(makeAppointment(), [existing])
      ).rejects.toThrow(PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE);

      expect(supabaseMock.from).not.toHaveBeenCalledWith('appointments');
    }
  );

  it('allows a new appointment when the previous one is cancelled', async () => {
    const { insert } = mockTenantValidatedInsert();

    await expect(
      createAppointment(makeAppointment(), [
        makeAppointment({
          id: 'existing-cancelled',
          status: 'cancelled'
        })
      ])
    ).resolves.toMatchObject({
      id: 'appointment-1',
      barbershopId: 'shop-leo'
    });

    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('allows a new appointment when the previous one is no_show', async () => {
    const { insert } = mockTenantValidatedInsert();

    await expect(
      createAppointment(makeAppointment(), [
        makeAppointment({
          id: 'existing-no-show',
          status: 'no_show'
        })
      ])
    ).resolves.toMatchObject({
      id: 'appointment-1',
      barbershopId: 'shop-leo'
    });

    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('uses barber_id instead of barber_name to detect conflicts', async () => {
    const { insert } = mockTenantValidatedInsert();

    await expect(
      createAppointment(makeAppointment({
        barberId: 'barber-leo-2',
        barberName: 'Leo'
      }), [
        makeAppointment({
          id: 'existing-same-name',
          barberId: 'barber-leo',
          barberName: 'Leo'
        })
      ])
    ).resolves.toMatchObject({
      barberId: 'barber-leo-2'
    });

    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('does not leak conflicts from another tenant with the same barber_id and start_at', async () => {
    const { insert } = mockTenantValidatedInsert();

    await expect(
      createAppointment(makeAppointment(), [
        makeAppointment({
          id: 'existing-other-tenant',
          barbershopId: 'shop-gm',
          barberId: 'barber-leo'
        })
      ])
    ).resolves.toMatchObject({
      barbershopId: 'shop-leo'
    });

    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('maps a unique index race condition to the public booking conflict message', async () => {
    const insert = vi.fn().mockResolvedValue({
      error: {
        code: '23505',
        details: 'Key (barbershop_id, barber_id, start_at) conflicts with index appointments_unique_active_barbershop_barber_start.'
      }
    });

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'barbers') {
        const query = createTenantLookupQuery({
          data: { id: 'barber-leo', barbershop_id: 'shop-leo' },
          error: null
        });
        return { select: vi.fn().mockReturnValue(query) };
      }

      if (table === 'services') {
        const query = createTenantLookupQuery({
          data: { id: 'service-leo', barbershop_id: 'shop-leo' },
          error: null
        });
        return { select: vi.fn().mockReturnValue(query) };
      }

      if (table === 'appointments') {
        return { insert };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    await expect(createAppointment(makeAppointment(), [])).rejects.toThrow(
      PUBLIC_BOOKING_APPOINTMENT_CONFLICT_MESSAGE
    );
  });

  it('rejects a public appointment with an empty client name before Supabase', async () => {
    await expect(
      createAppointment(makeAppointment({
        clientName: '   '
      }), [])
    ).rejects.toThrow('Informe seu nome.');

    expect(supabaseMock.from).not.toHaveBeenCalledWith('appointments');
  });

  it('rejects a public appointment with an invalid phone before Supabase', async () => {
    await expect(
      createAppointment(makeAppointment({
        clientPhone: '1234'
      }), [])
    ).rejects.toThrow('O WhatsApp deve ter 10 ou 11 digitos.');

    expect(supabaseMock.from).not.toHaveBeenCalledWith('appointments');
  });

  it('rejects a public appointment with an invalid date range before Supabase', async () => {
    await expect(
      createAppointment(makeAppointment({
        startAt: '2026-06-22T15:45:00.000Z',
        endAt: '2026-06-22T15:00:00.000Z'
      }), [])
    ).rejects.toThrow('O horario final precisa ser maior que o horario inicial.');

    expect(supabaseMock.from).not.toHaveBeenCalledWith('appointments');
  });

  it('rejects a public appointment when the barber belongs to another barbershop', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'barbers') {
        const query = createTenantLookupQuery({
          data: { id: 'barber-gm', barbershop_id: 'shop-gm' },
          error: null
        });
        return { select: vi.fn().mockReturnValue(query) };
      }

      if (table === 'services') {
        const query = createTenantLookupQuery({
          data: { id: 'service-leo', barbershop_id: 'shop-leo' },
          error: null
        });
        return { select: vi.fn().mockReturnValue(query) };
      }

      if (table === 'appointments') {
        return { insert: vi.fn() };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    await expect(
      createAppointment(makeAppointment({ barberId: 'barber-gm', barberName: 'Barber GM' }), [])
    ).rejects.toThrow('Barbeiro invalido para esta barbearia.');
  });

  it('rejects a public appointment when the service belongs to another barbershop', async () => {
    const appointmentsInsert = vi.fn();

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'barbers') {
        const query = createTenantLookupQuery({
          data: { id: 'barber-leo', barbershop_id: 'shop-leo' },
          error: null
        });
        return { select: vi.fn().mockReturnValue(query) };
      }

      if (table === 'services') {
        const query = createTenantLookupQuery({
          data: { id: 'service-gm', barbershop_id: 'shop-gm' },
          error: null
        });
        return { select: vi.fn().mockReturnValue(query) };
      }

      if (table === 'appointments') {
        return { insert: appointmentsInsert };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    await expect(
      createAppointment(makeAppointment({
        serviceId: 'service-gm',
        serviceType: 'Servico GM'
      }), [])
    ).rejects.toThrow('Servico invalido para esta barbearia.');

    expect(appointmentsInsert).not.toHaveBeenCalled();
  });

  it('rejects a public appointment when the barber is inactive', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'barbers') {
        const query = createTenantLookupQuery({
          data: null,
          error: null
        });
        return { select: vi.fn().mockReturnValue(query) };
      }

      if (table === 'services') {
        const query = createTenantLookupQuery({
          data: { id: 'service-leo', barbershop_id: 'shop-leo' },
          error: null
        });
        return { select: vi.fn().mockReturnValue(query) };
      }

      if (table === 'appointments') {
        return { insert: vi.fn() };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    await expect(
      createAppointment(makeAppointment(), [])
    ).rejects.toThrow('Barbeiro invalido para esta barbearia.');
  });

  it('rejects a public appointment when the service is inactive', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'barbers') {
        const query = createTenantLookupQuery({
          data: { id: 'barber-leo', barbershop_id: 'shop-leo' },
          error: null
        });
        return { select: vi.fn().mockReturnValue(query) };
      }

      if (table === 'services') {
        const query = createTenantLookupQuery({
          data: null,
          error: null
        });
        return { select: vi.fn().mockReturnValue(query) };
      }

      if (table === 'appointments') {
        return { insert: vi.fn() };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    await expect(
      createAppointment(makeAppointment(), [])
    ).rejects.toThrow('Servico invalido para esta barbearia.');
  });
});
