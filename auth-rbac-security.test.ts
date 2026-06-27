import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.hoisted(() => vi.fn());
const supabaseFromMock = vi.hoisted(() => vi.fn());

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: getUserMock
    },
    from: supabaseFromMock
  }
}));

import { canAccessInternalPanel, getProfile, mapAuthSession } from './services/authRepository';

describe('auth RBAC security contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('user without a valid session cannot operate the internal panel', () => {
    expect(canAccessInternalPanel(null, true)).toBe(false);
  });

  it('getProfile returns null when there is no authenticated user', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null
    });

    await expect(getProfile('user-1')).resolves.toBeNull();
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });

  it('getProfile returns null when the authenticated user does not match the requested profile', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'another-user'
        }
      },
      error: null
    });

    await expect(getProfile('user-1')).resolves.toBeNull();
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });

  it('owner without barbershop_id does not operate the internal panel', () => {
    const authSession = mapAuthSession({
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        user_metadata: { role: 'owner', display_name: 'Leo' }
      }
    } as any, {
      id: 'owner-1',
      display_name: 'Leo',
      role: 'owner',
      active: true,
      barbershop_id: null,
      barber_id: null
    });

    expect(authSession).not.toBeNull();
    expect(canAccessInternalPanel(authSession, true)).toBe(false);
  });

  it('barber without coherent profile identifiers does not operate the internal panel', () => {
    const authSession = mapAuthSession({
      user: {
        id: 'barber-1',
        email: 'barber@example.com',
        user_metadata: { role: 'barber', display_name: 'Gabriel' }
      }
    } as any, {
      id: 'barber-1',
      display_name: 'Gabriel',
      role: 'barber',
      active: true,
      barbershop_id: 'shop-leo',
      barber_id: null
    });

    expect(authSession).not.toBeNull();
    expect(canAccessInternalPanel(authSession, true)).toBe(false);
  });

  it('frontend role manipulation without a coherent profile does not grant internal access', () => {
    const authSession = mapAuthSession({
      user: {
        id: 'fake-owner',
        email: 'fake@example.com',
        user_metadata: { role: 'owner', display_name: 'Fake Owner' }
      }
    } as any, null);

    expect(authSession).not.toBeNull();
    expect(canAccessInternalPanel(authSession, true)).toBe(false);
  });
});
