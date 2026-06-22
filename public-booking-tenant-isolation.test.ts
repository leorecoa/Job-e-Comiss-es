import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Appointment } from './types';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn()
}));

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: supabaseMock
}));

import { createAppointment } from './services/appointmentRepository';
import { listBarbers } from './services/barberRepository';
import { listServices } from './services/serviceRepository';

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
    expect(query.eq).toHaveBeenNthCalledWith(1, 'active', true);
    expect(query.eq).toHaveBeenNthCalledWith(2, 'barbershop_id', 'shop-leo');
    expect(barbers).toEqual([
      { id: 'barber-leo', name: 'Leo', barbershopId: 'shop-leo' }
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
    expect(query.eq).toHaveBeenNthCalledWith(1, 'active', true);
    expect(query.eq).toHaveBeenNthCalledWith(2, 'barbershop_id', 'shop-leo');
    expect(services).toEqual([
      {
        id: 'service-leo',
        name: 'Corte Leo',
        barbershopId: 'shop-leo',
        price: 70,
        durationMinutes: 45,
        commissionRate: 40
      }
    ]);
  });

  it('creates the appointment with the current barbershop_id after validating barber and service tenant ownership', async () => {
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

    const appointment = makeAppointment();
    const created = await createAppointment(appointment, []);

    expect(insert).toHaveBeenCalledWith({
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
      financial_record_id: null
    });
    expect(created.barbershopId).toBe('shop-leo');
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
});
