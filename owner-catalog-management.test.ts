import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn()
}));

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: supabaseMock
}));

import { DEFAULT_SETTINGS } from './types';
import { getPublicBookingScopedSettings } from './components/PublicBookingPage';
import { getOwnerCatalogPublicSnapshot } from './components/OwnerCatalogManager';
import { createBarber, listBarbers, updateBarber } from './services/barberRepository';
import { createService, listServices, updateService } from './services/serviceRepository';
import { resolveOwnerScopedBarbershopId } from './utils';

const OWNER_BARBERSHOP_UUID = '0aaf2f1b-6e5d-4a4a-a90d-fd2008d397ce';
const OTHER_BARBERSHOP_UUID = 'd5129497-1ec8-43f0-8c56-5f0789557f33';
const BARBER_UUID = '49591f96-fcff-4cc1-b0bf-17d2932251c6';
const INACTIVE_BARBER_UUID = 'aeb04ac0-c638-4022-a66d-272be42e9372';
const OTHER_BARBER_UUID = '8829efdb-857c-4a3f-9c10-b03e5f3cf6b3';
const SERVICE_UUID = '4cbf9f97-598a-4574-8c72-95c94ec0aba5';
const OTHER_SERVICE_UUID = 'b771bb68-323c-4860-9d28-97ba8a1b7968';
const INVALID_LOCAL_ID = '57hs3s9tt';

describe('owner catalog management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('owner sees only barbers from the current barbershop', async () => {
    const query = {
      eq: vi.fn(),
      order: vi.fn()
    };
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue({
      returns: vi.fn().mockResolvedValue({
        data: [
          { id: BARBER_UUID, name: 'Leo', barbershop_id: OWNER_BARBERSHOP_UUID, active: true },
          { id: INACTIVE_BARBER_UUID, name: 'Leo Inativo', barbershop_id: OWNER_BARBERSHOP_UUID, active: false }
        ],
        error: null
      })
    });

    const select = vi.fn().mockReturnValue(query);
    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== 'barbers') throw new Error(`Unexpected table ${table}`);
      return { select };
    });

    const barbers = await listBarbers(OWNER_BARBERSHOP_UUID, { includeInactive: true });

    expect(select).toHaveBeenCalledWith('id,name,barbershop_id,active');
    expect(query.eq).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith('barbershop_id', OWNER_BARBERSHOP_UUID);
    expect(barbers).toEqual([
      { id: BARBER_UUID, name: 'Leo', barbershopId: OWNER_BARBERSHOP_UUID, active: true },
      { id: INACTIVE_BARBER_UUID, name: 'Leo Inativo', barbershopId: OWNER_BARBERSHOP_UUID, active: false }
    ]);
  });

  it('owner creates a barber with the correct barbershop_id', async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockReturnValue({
          returns: vi.fn().mockResolvedValue({
            data: { id: BARBER_UUID, name: 'Leo', barbershop_id: OWNER_BARBERSHOP_UUID, active: true },
            error: null
          })
        })
      })
    });

    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== 'barbers') throw new Error(`Unexpected table ${table}`);
      return { insert };
    });

    const barber = await createBarber({ name: 'Leo', barbershopId: OWNER_BARBERSHOP_UUID });

    expect(insert).toHaveBeenCalledWith({
      name: 'Leo',
      barbershop_id: OWNER_BARBERSHOP_UUID,
      active: true
    });
    expect(barber.barbershopId).toBe(OWNER_BARBERSHOP_UUID);
  });

  it('owner deactivates a barber without deleting history', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: BARBER_UUID, name: 'Leo', barbershop_id: OWNER_BARBERSHOP_UUID, active: false },
      error: null
    });
    const query = {
      eq: vi.fn(),
      select: vi.fn().mockReturnValue({
        single
      })
    };
    query.eq.mockReturnValue(query);
    const update = vi.fn().mockReturnValue(query);

    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== 'barbers') throw new Error(`Unexpected table ${table}`);
      return { update };
    });

    const barber = await updateBarber(BARBER_UUID, { active: false }, OWNER_BARBERSHOP_UUID);

    expect(update).toHaveBeenCalledWith({ active: false });
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', BARBER_UUID);
    expect(query.eq).toHaveBeenNthCalledWith(2, 'barbershop_id', OWNER_BARBERSHOP_UUID);
    expect(barber.active).toBe(false);
  });

  it('owner sees only services from the current barbershop', async () => {
    const query = {
      eq: vi.fn(),
      order: vi.fn()
    };
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({
      data: [
        {
          id: SERVICE_UUID,
          name: 'Corte Leo',
          barbershop_id: OWNER_BARBERSHOP_UUID,
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

    const services = await listServices(OWNER_BARBERSHOP_UUID, { includeInactive: true });

    expect(select).toHaveBeenCalledWith('id,name,barbershop_id,price,duration_minutes,commission_rate,active');
    expect(query.eq).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith('barbershop_id', OWNER_BARBERSHOP_UUID);
    expect(services[0]).toMatchObject({
      id: SERVICE_UUID,
      name: 'Corte Leo',
      barbershopId: OWNER_BARBERSHOP_UUID
    });
  });

  it('owner creates a service with the correct barbershop_id', async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: SERVICE_UUID,
            name: 'Corte Leo',
            barbershop_id: OWNER_BARBERSHOP_UUID,
            price: 70,
            duration_minutes: 45,
            commission_rate: 40,
            active: true
          },
          error: null
        })
      })
    });

    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== 'services') throw new Error(`Unexpected table ${table}`);
      return { insert };
    });

    const service = await createService({
      name: 'Corte Leo',
      price: 70,
      durationMinutes: 45,
      commissionRate: 40,
      barbershopId: OWNER_BARBERSHOP_UUID
    });

    expect(insert).toHaveBeenCalledWith({
      name: 'Corte Leo',
      barbershop_id: OWNER_BARBERSHOP_UUID,
      price: 70,
      duration_minutes: 45,
      commission_rate: 40,
      active: true
    });
    expect(service.barbershopId).toBe(OWNER_BARBERSHOP_UUID);
  });

  it('owner edits a service without leaking to another barbershop', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: SERVICE_UUID,
        name: 'Corte Premium',
        barbershop_id: OWNER_BARBERSHOP_UUID,
        price: 80,
        duration_minutes: 50,
        commission_rate: 45,
        active: true
      },
      error: null
    });
    const query = {
      eq: vi.fn(),
      select: vi.fn().mockReturnValue({
        single
      })
    };
    query.eq.mockReturnValue(query);
    const update = vi.fn().mockReturnValue(query);

    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== 'services') throw new Error(`Unexpected table ${table}`);
      return { update };
    });

    const service = await updateService(SERVICE_UUID, {
      name: 'Corte Premium',
      price: 80,
      durationMinutes: 50,
      commissionRate: 45
    }, OWNER_BARBERSHOP_UUID);

    expect(update).toHaveBeenCalledWith({
      name: 'Corte Premium',
      price: 80,
      duration_minutes: 50,
      commission_rate: 45
    });
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', SERVICE_UUID);
    expect(query.eq).toHaveBeenNthCalledWith(2, 'barbershop_id', OWNER_BARBERSHOP_UUID);
    expect(service).toMatchObject({
      id: SERVICE_UUID,
      name: 'Corte Premium',
      price: 80,
      durationMinutes: 50,
      commissionRate: 45
    });
  });

  it('does not send a local fallback id to Supabase when creating a service', async () => {
    await expect(createService({
      name: 'Corte Leo',
      price: 70,
      durationMinutes: 45,
      commissionRate: 40,
      barbershopId: INVALID_LOCAL_ID
    })).rejects.toThrow('Sua conta nao possui uma barbearia valida para cadastrar servico.');

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('does not send a local fallback id to Supabase when creating a barber', async () => {
    await expect(createBarber({
      name: 'Leo',
      barbershopId: INVALID_LOCAL_ID
    })).rejects.toThrow('Sua conta nao possui uma barbearia valida para cadastrar barbeiro.');

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('resolves the real authenticated UUID for owner catalog actions', () => {
    expect(resolveOwnerScopedBarbershopId({
      authBarbershopId: OWNER_BARBERSHOP_UUID,
      fallbackBarbershopId: INVALID_LOCAL_ID,
      supabaseConfigured: true
    })).toBe(OWNER_BARBERSHOP_UUID);
  });

  it('blocks owner catalog actions when the authenticated profile has no valid UUID', () => {
    expect(resolveOwnerScopedBarbershopId({
      authBarbershopId: INVALID_LOCAL_ID,
      fallbackBarbershopId: 'local-barbershop',
      supabaseConfigured: true
    })).toBeUndefined();
  });

  it('public booking for a new barbershop shows the catalog after owner registration', () => {
    const snapshot = getOwnerCatalogPublicSnapshot(
      [
        { id: BARBER_UUID, name: 'Leo', barbershopId: OWNER_BARBERSHOP_UUID, active: true },
        { id: OTHER_BARBER_UUID, name: 'Gestao Maxima Barber', barbershopId: OTHER_BARBERSHOP_UUID, active: true }
      ],
      [
        { id: SERVICE_UUID, name: 'Corte Leo', price: 70, durationMinutes: 45, commissionRate: 40, barbershopId: OWNER_BARBERSHOP_UUID, active: true },
        { id: OTHER_SERVICE_UUID, name: 'Corte GM', price: 50, durationMinutes: 30, commissionRate: 35, barbershopId: OTHER_BARBERSHOP_UUID, active: true }
      ]
    );

    const scoped = getPublicBookingScopedSettings({
      ...DEFAULT_SETTINGS,
      barbers: snapshot.barbers,
      services: snapshot.services
    }, {
      id: OWNER_BARBERSHOP_UUID,
      name: 'Leo do Leo',
      slug: 'leo-do-leo',
      active: true
    });

    expect(scoped.barbers).toEqual([
      { id: BARBER_UUID, name: 'Leo', barbershopId: OWNER_BARBERSHOP_UUID, active: true }
    ]);
    expect(scoped.services).toEqual([
      { id: SERVICE_UUID, name: 'Corte Leo', price: 70, durationMinutes: 45, commissionRate: 40, barbershopId: OWNER_BARBERSHOP_UUID, active: true }
    ]);
  });

  it('does not leak catalog between Gestao Maxima and leo-do-leo', () => {
    const snapshot = getOwnerCatalogPublicSnapshot(
      [
        { id: BARBER_UUID, name: 'Leo', barbershopId: OWNER_BARBERSHOP_UUID, active: true },
        { id: OTHER_BARBER_UUID, name: 'Gestao Maxima Barber', barbershopId: OTHER_BARBERSHOP_UUID, active: true }
      ],
      [
        { id: SERVICE_UUID, name: 'Corte Leo', price: 70, durationMinutes: 45, commissionRate: 40, barbershopId: OWNER_BARBERSHOP_UUID, active: true },
        { id: OTHER_SERVICE_UUID, name: 'Corte GM', price: 50, durationMinutes: 30, commissionRate: 35, barbershopId: OTHER_BARBERSHOP_UUID, active: true }
      ]
    );

    const gestaoMaxima = getPublicBookingScopedSettings({
      ...DEFAULT_SETTINGS,
      barbers: snapshot.barbers,
      services: snapshot.services
    }, {
      id: OTHER_BARBERSHOP_UUID,
      name: 'Gestao Maxima',
      slug: 'gestao-maxima',
      active: true
    });

    const leoDoLeo = getPublicBookingScopedSettings({
      ...DEFAULT_SETTINGS,
      barbers: snapshot.barbers,
      services: snapshot.services
    }, {
      id: OWNER_BARBERSHOP_UUID,
      name: 'Leo do Leo',
      slug: 'leo-do-leo',
      active: true
    });

    expect(gestaoMaxima.barbers.map((barber) => barber.id)).toEqual([OTHER_BARBER_UUID]);
    expect(leoDoLeo.barbers.map((barber) => barber.id)).toEqual([BARBER_UUID]);
    expect(gestaoMaxima.services.map((service) => service.id)).toEqual([OTHER_SERVICE_UUID]);
    expect(leoDoLeo.services.map((service) => service.id)).toEqual([SERVICE_UUID]);
  });
});
