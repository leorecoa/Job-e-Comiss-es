import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn()
}));

const authRepositoryMock = vi.hoisted(() => ({
  getUserProfileName: vi.fn(),
  upsertOwnerProfileForBarbershop: vi.fn()
}));

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: supabaseMock
}));

vi.mock('./services/authRepository', () => authRepositoryMock);

import {
  createBarbershopForCurrentOwner,
  getBarbershopPublicBookingPath,
  normalizeBarbershopSlug
} from './services/barbershopRepository';

describe('barbershop onboarding repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authRepositoryMock.getUserProfileName.mockReturnValue('Leo Owner');
  });

  it('normalizes the onboarding slug into a public-friendly path', () => {
    expect(normalizeBarbershopSlug(' Barbearia Sao Joao Premium! ')).toBe('barbearia-sao-joao-premium');
    expect(getBarbershopPublicBookingPath('barbearia-sao-joao-premium')).toBe('/book/barbearia-sao-joao-premium');
  });

  it('rejects onboarding without an authenticated user', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null
    });

    await expect(
      createBarbershopForCurrentOwner({
        name: 'Barbearia Premium',
        slug: 'barbearia-premium'
      })
    ).rejects.toThrow('Usuario nao autenticado para criar barbearia.');
  });

  it('surfaces a friendly duplicate slug error before insert', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'owner-1',
          email: 'owner@example.com',
          user_metadata: {
            display_name: 'Leo Owner'
          }
        }
      },
      error: null
    });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'existing-shop' },
      error: null
    });

    supabaseMock.from.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle
        }))
      })),
      insert: vi.fn()
    }));

    await expect(
      createBarbershopForCurrentOwner({
        name: 'Barbearia Premium',
        slug: 'barbearia-premium'
      })
    ).rejects.toThrow('Este slug ja esta em uso. Escolha outro.');
  });

  it('creates the barbershop and links the current owner profile', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'owner-1',
          email: 'owner@example.com',
          user_metadata: {
            display_name: 'Leo Owner'
          }
        }
      },
      error: null
    });

    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null
    });
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
        active: true
      },
      error: null
    });
    const insert = vi.fn((payload) => ({
      select: vi.fn(() => ({
        single: vi.fn(() => single())
      }))
    }));

    supabaseMock.from.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle
        }))
      })),
      insert
    }));

    authRepositoryMock.upsertOwnerProfileForBarbershop.mockResolvedValue({
      id: 'owner-1',
      display_name: 'Leo Owner',
      role: 'owner',
      active: true,
      barbershop_id: 'shop-1',
      barber_id: null
    });

    const created = await createBarbershopForCurrentOwner({
      name: '  Barbearia Premium  ',
      slug: ' Barbearia Sao Joao ',
      phone: ' 558500000000 ',
      address: ' Rua Central ',
      whatsapp: ' 5585999999999 ',
      description: ' Agenda premium '
    });

    expect(insert).toHaveBeenCalledWith({
      name: 'Barbearia Premium',
      slug: 'barbearia-sao-joao',
      phone: '558500000000',
      address: 'Rua Central',
      whatsapp: '5585999999999',
      description: 'Agenda premium',
      active: true
    });
    expect(authRepositoryMock.upsertOwnerProfileForBarbershop).toHaveBeenCalledWith('owner-1', 'Leo Owner', 'shop-1');
    expect(created).toMatchObject({
      id: 'shop-1',
      name: 'Barbearia Premium',
      slug: 'barbearia-sao-joao',
      whatsapp: '5585999999999',
      description: 'Agenda premium',
      active: true
    });
  });
});
