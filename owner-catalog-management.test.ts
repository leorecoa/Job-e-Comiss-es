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
          { id: 'barber-leo', name: 'Leo', barbershop_id: 'shop-leo', active: true },
          { id: 'barber-inactive', name: 'Leo Inativo', barbershop_id: 'shop-leo', active: false }
        ],
        error: null
      })
    });

    const select = vi.fn().mockReturnValue(query);
    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== 'barbers') throw new Error(`Unexpected table ${table}`);
      return { select };
    });

    const barbers = await listBarbers('shop-leo', { includeInactive: true });

    expect(select).toHaveBeenCalledWith('id,name,barbershop_id,active');
    expect(query.eq).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith('barbershop_id', 'shop-leo');
    expect(barbers).toEqual([
      { id: 'barber-leo', name: 'Leo', barbershopId: 'shop-leo', active: true },
      { id: 'barber-inactive', name: 'Leo Inativo', barbershopId: 'shop-leo', active: false }
    ]);
  });

  it('owner creates a barber with the correct barbershop_id', async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockReturnValue({
          returns: vi.fn().mockResolvedValue({
            data: { id: 'barber-leo', name: 'Leo', barbershop_id: 'shop-leo', active: true },
            error: null
          })
        })
      })
    });

    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== 'barbers') throw new Error(`Unexpected table ${table}`);
      return { insert };
    });

    const barber = await createBarber({ name: 'Leo', barbershopId: 'shop-leo' });

    expect(insert).toHaveBeenCalledWith({
      name: 'Leo',
      barbershop_id: 'shop-leo',
      active: true
    });
    expect(barber.barbershopId).toBe('shop-leo');
  });

  it('owner deactivates a barber without deleting history', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'barber-leo', name: 'Leo', barbershop_id: 'shop-leo', active: false },
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

    const barber = await updateBarber('barber-leo', { active: false }, 'shop-leo');

    expect(update).toHaveBeenCalledWith({ active: false });
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'barber-leo');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'barbershop_id', 'shop-leo');
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

    const services = await listServices('shop-leo', { includeInactive: true });

    expect(select).toHaveBeenCalledWith('id,name,barbershop_id,price,duration_minutes,commission_rate,active');
    expect(query.eq).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith('barbershop_id', 'shop-leo');
    expect(services[0]).toMatchObject({
      id: 'service-leo',
      name: 'Corte Leo',
      barbershopId: 'shop-leo'
    });
  });

  it('owner creates a service with the correct barbershop_id', async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'service-leo',
            name: 'Corte Leo',
            barbershop_id: 'shop-leo',
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
      id: 'service-leo',
      name: 'Corte Leo',
      price: 70,
      durationMinutes: 45,
      commissionRate: 40,
      barbershopId: 'shop-leo'
    });

    expect(insert).toHaveBeenCalledWith({
      id: 'service-leo',
      name: 'Corte Leo',
      barbershop_id: 'shop-leo',
      price: 70,
      duration_minutes: 45,
      commission_rate: 40,
      active: true
    });
    expect(service.barbershopId).toBe('shop-leo');
  });

  it('owner edits a service without leaking to another barbershop', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'service-leo',
        name: 'Corte Premium',
        barbershop_id: 'shop-leo',
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

    const service = await updateService('service-leo', {
      name: 'Corte Premium',
      price: 80,
      durationMinutes: 50,
      commissionRate: 45
    }, 'shop-leo');

    expect(update).toHaveBeenCalledWith({
      name: 'Corte Premium',
      price: 80,
      duration_minutes: 50,
      commission_rate: 45
    });
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'service-leo');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'barbershop_id', 'shop-leo');
    expect(service).toMatchObject({
      id: 'service-leo',
      name: 'Corte Premium',
      price: 80,
      durationMinutes: 50,
      commissionRate: 45
    });
  });

  it('public booking for a new barbershop shows the catalog after owner registration', () => {
    const snapshot = getOwnerCatalogPublicSnapshot(
      [
        { id: 'barber-leo', name: 'Leo', barbershopId: 'shop-leo', active: true },
        { id: 'barber-gm', name: 'Gestao Maxima Barber', barbershopId: 'shop-gm', active: true }
      ],
      [
        { id: 'service-leo', name: 'Corte Leo', price: 70, durationMinutes: 45, commissionRate: 40, barbershopId: 'shop-leo', active: true },
        { id: 'service-gm', name: 'Corte GM', price: 50, durationMinutes: 30, commissionRate: 35, barbershopId: 'shop-gm', active: true }
      ]
    );

    const scoped = getPublicBookingScopedSettings({
      ...DEFAULT_SETTINGS,
      barbers: snapshot.barbers,
      services: snapshot.services
    }, {
      id: 'shop-leo',
      name: 'Leo do Leo',
      slug: 'leo-do-leo',
      active: true
    });

    expect(scoped.barbers).toEqual([
      { id: 'barber-leo', name: 'Leo', barbershopId: 'shop-leo', active: true }
    ]);
    expect(scoped.services).toEqual([
      { id: 'service-leo', name: 'Corte Leo', price: 70, durationMinutes: 45, commissionRate: 40, barbershopId: 'shop-leo', active: true }
    ]);
  });

  it('does not leak catalog between Gestao Maxima and leo-do-leo', () => {
    const snapshot = getOwnerCatalogPublicSnapshot(
      [
        { id: 'barber-leo', name: 'Leo', barbershopId: 'shop-leo', active: true },
        { id: 'barber-gm', name: 'Gestao Maxima Barber', barbershopId: 'shop-gm', active: true }
      ],
      [
        { id: 'service-leo', name: 'Corte Leo', price: 70, durationMinutes: 45, commissionRate: 40, barbershopId: 'shop-leo', active: true },
        { id: 'service-gm', name: 'Corte GM', price: 50, durationMinutes: 30, commissionRate: 35, barbershopId: 'shop-gm', active: true }
      ]
    );

    const gestaoMaxima = getPublicBookingScopedSettings({
      ...DEFAULT_SETTINGS,
      barbers: snapshot.barbers,
      services: snapshot.services
    }, {
      id: 'shop-gm',
      name: 'Gestao Maxima',
      slug: 'gestao-maxima',
      active: true
    });

    const leoDoLeo = getPublicBookingScopedSettings({
      ...DEFAULT_SETTINGS,
      barbers: snapshot.barbers,
      services: snapshot.services
    }, {
      id: 'shop-leo',
      name: 'Leo do Leo',
      slug: 'leo-do-leo',
      active: true
    });

    expect(gestaoMaxima.barbers.map((barber) => barber.id)).toEqual(['barber-gm']);
    expect(leoDoLeo.barbers.map((barber) => barber.id)).toEqual(['barber-leo']);
    expect(gestaoMaxima.services.map((service) => service.id)).toEqual(['service-gm']);
    expect(leoDoLeo.services.map((service) => service.id)).toEqual(['service-leo']);
  });
});
