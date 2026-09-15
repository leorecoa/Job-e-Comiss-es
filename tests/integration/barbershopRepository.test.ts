import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  localFallback: false,
  from: vi.fn(),
  rpc: vi.fn()
}));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  isProductionWithoutSupabase: false,
  get shouldUseLocalFallback() { return supabaseMock.localFallback; },
  assertOperationalSupabase: vi.fn(),
  supabase: supabaseMock
}));

import {
  createBarbershopForCurrentOwner,
  updateCurrentBarbershopBranding,
  updateBarbershopFinancialTimezone,
  updateBarbershopOperationalTimezone,
  getBarbershopById,
  getBarbershopBySlug,
  getBarbershopPublicBookingPath,
  normalizeBarbershopSlug
} from '../../services/barbershopRepository';
import { DEFAULT_BARBERSHOP_BUSINESS_HOURS, DEFAULT_BARBERSHOP_SLOT_STEP_MINUTES } from '../../scheduling';

describe('barbershop onboarding repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.localFallback = false;
  });

  it('normalizes the onboarding slug into a public-friendly path', () => {
    expect(normalizeBarbershopSlug(' Barbearia Sao Joao Premium! ')).toBe('barbearia-sao-joao-premium');
    expect(getBarbershopPublicBookingPath('barbearia-sao-joao-premium')).toBe('/book/barbearia-sao-joao-premium');
  });

  it('preserves local demo without creating a local operational timezone store', async () => {
    supabaseMock.localFallback = true;
    const storage = { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    try {
      expect(await getBarbershopById('local-barbershop')).toMatchObject({ id: 'local-barbershop', slotStepMinutes: 30, active: true });
      await expect(updateBarbershopOperationalTimezone('local-barbershop', 'America/Recife')).rejects.toThrow();
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(supabaseMock.from).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      supabaseMock.localFallback = false;
    }
  });

  it('creates through the compatible overload only with confirmed operational timezone', async () => {
    supabaseMock.rpc.mockReturnValue({ single: vi.fn().mockResolvedValue({ data: {
      id: 'shop-1', name: 'Shop', slug: 'shop', active: true, operational_timezone: 'America/New_York', financial_timezone: null
    }, error: null }) });
    const created = await createBarbershopForCurrentOwner({ name: 'Shop', slug: 'shop', operationalTimezone: 'America/New_York' });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_owner_barbershop', expect.objectContaining({ p_operational_timezone: 'America/New_York', p_financial_timezone: null }));
    expect(created.operationalTimezone).toBe('America/New_York');
    expect(created.financialTimezone).toBeNull();
  });

  it.each(['America/Recife', 'America/New_York'])('updates only operational timezone to %s', async timezone => {
    const query = { eq: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: {
      id: 'shop-1', name: 'Shop', slug: 'shop', active: true, operational_timezone: timezone, financial_timezone: 'UTC'
    }, error: null }) };
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    const update = vi.fn().mockReturnValue(query);
    supabaseMock.from.mockReturnValue({ update });
    const saved = await updateBarbershopOperationalTimezone('shop-1', timezone);
    expect(update).toHaveBeenCalledWith({ operational_timezone: timezone });
    expect(query.eq).toHaveBeenCalledWith('id', 'shop-1');
    expect(saved.operationalTimezone).toBe(timezone);
    expect(saved.financialTimezone).toBe('UTC');
  });

  it('rejects invalid operational timezone before persistence', async () => {
    await expect(updateBarbershopOperationalTimezone('shop-1', 'Not/AZone')).rejects.toThrow();
    await expect(createBarbershopForCurrentOwner({ name: 'Shop', slug: 'shop', operationalTimezone: 'Not/AZone' })).rejects.toThrow();
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it.each([null, 'America/New_York'])('reads operational timezone %s without writes and exposes it for public presentation', async operationalTimezone => {
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: {
      id: 'shop-1', name: 'Shop', slug: 'shop', active: true, operational_timezone: operationalTimezone
    }, error: null }) };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    supabaseMock.from.mockReturnValue(query);
    expect((await getBarbershopById('shop-1'))?.operationalTimezone).toBe(operationalTimezone);
    expect(query.select).toHaveBeenLastCalledWith(expect.stringContaining('operational_timezone'));
    await getBarbershopBySlug('shop');
    expect(query.select).toHaveBeenLastCalledWith(expect.stringContaining('operational_timezone'));
    expect(query.select).toHaveBeenLastCalledWith(expect.not.stringContaining('financial_timezone'));
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('passes only a confirmed timezone to the nine-argument onboarding overload', async () => {
    supabaseMock.rpc.mockReturnValue({ single: vi.fn().mockResolvedValue({ data: {
      id: 'shop-1', name: 'Shop', slug: 'shop', active: true, financial_timezone: 'America/Recife'
    }, error: null }) });
    const created = await createBarbershopForCurrentOwner({ name: 'Shop', slug: 'shop', financialTimezone: 'America/Recife' });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_owner_barbershop', expect.objectContaining({ p_financial_timezone: 'America/Recife' }));
    expect(created.financialTimezone).toBe('America/Recife');
  });

  it('updates only financial_timezone within the requested tenant', async () => {
    const query = { eq: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: {
      id: 'shop-1', name: 'Shop', slug: 'shop', active: true, financial_timezone: 'America/New_York'
    }, error: null }) };
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    const update = vi.fn().mockReturnValue(query);
    supabaseMock.from.mockReturnValue({ update });
    const saved = await updateBarbershopFinancialTimezone('shop-1', 'America/New_York');
    expect(update).toHaveBeenCalledWith({ financial_timezone: 'America/New_York' });
    expect(query.eq).toHaveBeenCalledWith('id', 'shop-1');
    expect(saved.financialTimezone).toBe('America/New_York');
  });

  it('rejects invalid timezone before any persistence', async () => {
    await expect(updateBarbershopFinancialTimezone('shop-1', 'Not/AZone')).rejects.toThrow();
    await expect(createBarbershopForCurrentOwner({ name: 'Shop', slug: 'shop', financialTimezone: 'Not/AZone' })).rejects.toThrow();
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it.each([null, 'America/Recife'])('reads stored timezone %s without writing and excludes it from public selects', async financialTimezone => {
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: {
      id: 'shop-1', name: 'Shop', slug: 'shop', active: true, financial_timezone: financialTimezone
    }, error: null }) };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    supabaseMock.from.mockReturnValue(query);
    expect((await getBarbershopById('shop-1'))?.financialTimezone).toBe(financialTimezone);
    expect(query.select).toHaveBeenLastCalledWith(expect.stringContaining('financial_timezone'));
    await getBarbershopBySlug('shop');
    expect(query.select).toHaveBeenLastCalledWith(expect.not.stringContaining('financial_timezone'));
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
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
