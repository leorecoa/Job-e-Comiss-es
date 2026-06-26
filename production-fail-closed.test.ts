import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Appointment, DEFAULT_SETTINGS } from './types';

const { productionError } = vi.hoisted(() => ({
  productionError: 'Configuracao do banco indisponivel. O sistema nao pode operar em producao sem Supabase configurado.'
}));

vi.mock('./lib/supabase', () => ({
  PRODUCTION_SUPABASE_UNAVAILABLE_MESSAGE: productionError,
  isSupabaseConfigured: false,
  isProductionWithoutSupabase: true,
  shouldUseLocalFallback: false,
  assertOperationalSupabase: vi.fn(() => {
    throw new Error(productionError);
  }),
  supabase: null
}));

import { getInitialAppSettings, getInitialUserProfile, getOperationalBlockingMessage } from './App';
import { createAppointment } from './services/appointmentRepository';
import { createBarber } from './services/barberRepository';
import { updateCurrentBarbershopBranding } from './services/barbershopRepository';
import { createService } from './services/serviceRepository';

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'appointment-1',
  barbershopId: 'shop-1',
  barberId: 'barber-1',
  serviceId: 'service-1',
  clientName: 'Cliente',
  clientPhone: '85999990000',
  barberName: 'Leo',
  serviceType: 'Corte',
  serviceValue: 50,
  startAt: '2026-06-26T14:00:00.000Z',
  endAt: '2026-06-26T14:30:00.000Z',
  status: 'scheduled',
  createdAt: '2026-06-25T10:00:00.000Z',
  updatedAt: '2026-06-25T10:00:00.000Z',
  ...overrides
});

const storage = {
  getItem: vi.fn((key: string) => {
    if (key === 'barbearia_profile') {
      return JSON.stringify({
        ownerName: 'Leo',
        shopName: 'Tenant Local'
      });
    }

    if (key === 'barbearia_settings') {
      return JSON.stringify({
        ...DEFAULT_SETTINGS,
        shopName: 'Tenant Local',
        barbers: [{ id: 'local-barber', name: 'Local Barber' }],
        services: [{ id: 'local-service', name: 'Local Service', price: 30, durationMinutes: 30 }]
      });
    }

    return null;
  })
};

describe('production fail-closed without Supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not bootstrap the operational tenant from localStorage in production', () => {
    expect(getInitialUserProfile(storage, false)).toBeNull();
    expect(getInitialAppSettings(storage, false)).toMatchObject({
      shopName: 'Sua barbearia',
      barbers: [],
      services: []
    });
  });

  it('blocks public booking creation when production is missing Supabase', async () => {
    await expect(createAppointment(makeAppointment(), [])).rejects.toThrow(productionError);
  });

  it('blocks owner barber creation when production is missing Supabase', async () => {
    await expect(createBarber({
      name: 'Leo',
      barbershopId: 'shop-1'
    })).rejects.toThrow(productionError);
  });

  it('blocks owner service creation when production is missing Supabase', async () => {
    await expect(createService({
      name: 'Corte',
      price: 50,
      durationMinutes: 30,
      barbershopId: 'shop-1'
    })).rejects.toThrow(productionError);
  });

  it('blocks barbershop editing when production is missing Supabase', async () => {
    await expect(updateCurrentBarbershopBranding('shop-1', {
      name: 'Tenant Seguro'
    })).rejects.toThrow(productionError);
  });

  it('exposes the operational blocking message for the UI', () => {
    expect(getOperationalBlockingMessage(true)).toBe(productionError);
    expect(getOperationalBlockingMessage(false)).toBeNull();
  });
});
