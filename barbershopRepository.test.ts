import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn()
}));

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: true,
  isProductionWithoutSupabase: false,
  shouldUseLocalFallback: false,
  assertOperationalSupabase: vi.fn(),
  supabase: supabaseMock
}));

import {
  createBarbershopForCurrentOwner,
  updateCurrentBarbershopBranding,
  getBarbershopPublicBookingPath,
  normalizeBarbershopSlug
} from './services/barbershopRepository';
import { DEFAULT_BARBERSHOP_BUSINESS_HOURS, DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES } from './scheduling';

describe('barbershop onboarding repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes the onboarding slug into a public-friendly path', () => {
    expect(normalizeBarbershopSlug(' Barbearia Sao Joao Premium! ')).toBe('barbearia-sao-joao-premium');
    expect(getBarbershopPublicBookingPath('barbearia-sao-joao-premium')).toBe('/book/barbearia-sao-joao-premium');
  });

  it('maps an unauthenticated RPC response to a friendly error', async () => {
    supabaseMock.rpc.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'OWNER_ONBOARDING_AUTH_REQUIRED' }
      })
    });

    await expect(
      createBarbershopForCurrentOwner({
        name: 'Barbearia Premium',
        slug: 'barbearia-premium'
      })
    ).rejects.toThrow('Entre novamente para criar sua barbearia.');
  });

  it('maps a duplicate slug RPC response without querying tables directly', async () => {
    supabaseMock.rpc.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'OWNER_ONBOARDING_SLUG_TAKEN' }
      })
    });

    await expect(
      createBarbershopForCurrentOwner({
        name: 'Barbearia Premium',
        slug: 'barbearia-premium'
      })
    ).rejects.toThrow('Este slug ja esta em uso. Escolha outro.');
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('creates and links through the transactional RPC only', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'shop-1',
        name: 'Barbearia Premium',
        slug: 'barbearia-sao-joao',
        phone: '558500000000',
        address: 'Rua Central',
        logo_url: null,
        cover_image_url: null,
        description: 'Agenda premium',
        instagram_url: null,
        whatsapp: '5585999999999',
        primary_color: null,
        secondary_color: null,
        business_hours: DEFAULT_BARBERSHOP_BUSINESS_HOURS,
        slot_step_minutes: DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES,
        active: true
      },
      error: null
    });
    supabaseMock.rpc.mockReturnValue({ single });

    const created = await createBarbershopForCurrentOwner({
      name: '  Barbearia Premium  ',
      slug: ' Barbearia Sao Joao ',
      phone: ' 558500000000 ',
      address: ' Rua Central ',
      whatsapp: ' 5585999999999 ',
      description: ' Agenda premium '
    });

    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_owner_barbershop', {
      p_name: 'Barbearia Premium',
      p_slug: 'barbearia-sao-joao',
      p_phone: '558500000000',
      p_address: 'Rua Central',
      p_whatsapp: '5585999999999',
      p_description: 'Agenda premium',
      p_business_hours: DEFAULT_BARBERSHOP_BUSINESS_HOURS,
      p_slot_step_minutes: DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES
    });
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(created).toMatchObject({
      id: 'shop-1',
      name: 'Barbearia Premium',
      slug: 'barbearia-sao-joao',
      whatsapp: '5585999999999',
      description: 'Agenda premium',
      businessHours: DEFAULT_BARBERSHOP_BUSINESS_HOURS,
      slotStepMinutes: DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES,
      active: true
    });
  });

  it('updates business hours only for the requested barbershop', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'shop-1',
        name: 'Barbearia Premium',
        slug: 'barbearia-premium',
        phone: null,
        address: null,
        logo_url: null,
        cover_image_url: null,
        description: null,
        instagram_url: null,
        whatsapp: null,
        primary_color: '#111111',
        secondary_color: '#eeeeee',
        business_hours: {
          ...DEFAULT_BARBERSHOP_BUSINESS_HOURS,
          monday: { active: true, open: '09:00', close: '18:00' }
        },
        slot_step_minutes: 20,
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

    supabaseMock.from.mockImplementation(() => ({
      update
    }));

    const updated = await updateCurrentBarbershopBranding('shop-1', {
      name: 'Barbearia Premium',
      primaryColor: '#111111',
      secondaryColor: '#eeeeee',
      businessHours: {
        ...DEFAULT_BARBERSHOP_BUSINESS_HOURS,
        monday: { active: true, open: '09:00', close: '18:00' }
      },
      slotStepMinutes: 20
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Barbearia Premium',
      business_hours: expect.objectContaining({
        monday: { active: true, open: '09:00', close: '18:00' }
      }),
      slot_step_minutes: 20
    }));
    expect(query.eq).toHaveBeenCalledWith('id', 'shop-1');
    expect(updated.slotStepMinutes).toBe(20);
    expect(updated.businessHours?.monday).toEqual({
      active: true,
      open: '09:00',
      close: '18:00'
    });
  });
});
