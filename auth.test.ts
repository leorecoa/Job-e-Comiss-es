
import { describe, expect, it } from 'vitest';
import { canAccessInternalPanel, mapAuthSession, normalizeRole } from './services/authRepository';

describe('auth role helpers', () => {
  it('normalizes unknown roles to owner', () => {
    expect(normalizeRole('owner')).toBe('owner');
    expect(normalizeRole('barber')).toBe('barber');
    expect(normalizeRole('client')).toBe('owner');
  });

  it('allows local fallback without Supabase session', () => {
    expect(canAccessInternalPanel(null, false)).toBe(true);
  });

  it('requires an owner or barber session when Supabase is configured', () => {
    expect(canAccessInternalPanel(null, true)).toBe(false);

    expect(
      canAccessInternalPanel(
        {
          userId: 'user-1',
          email: 'owner@example.com',
          displayName: 'Owner',
          role: 'owner',
          barbershopId: 'shop-1'
        },
        true
      )
    ).toBe(true);

    expect(
      canAccessInternalPanel(
        {
          userId: 'user-2',
          email: 'barber@example.com',
          displayName: 'Barber',
          role: 'barber',
          barbershopId: 'shop-1',
          barberId: 'barber-1'
        },
        true
      )
    ).toBe(true);

    expect(
      canAccessInternalPanel(
        {
          userId: 'user-3',
          email: 'owner-missing@example.com',
          displayName: 'Owner Missing Shop',
          role: 'owner'
        },
        true
      )
    ).toBe(false);

    expect(
      canAccessInternalPanel(
        {
          userId: 'user-4',
          email: 'barber-missing@example.com',
          displayName: 'Barber Missing Ids',
          role: 'barber',
          barbershopId: 'shop-1'
        },
        true
      )
    ).toBe(false);
  });

  it('maps Supabase session metadata into an app auth session', () => {
    const session = mapAuthSession({
      user: {
        id: 'user-1',
        email: 'leo@example.com',
        user_metadata: {
          display_name: 'Leo',
          role: 'barber'
        }
      }
    } as any);

    expect(session).toEqual({
      userId: 'user-1',
      email: 'leo@example.com',
      displayName: 'Leo',
      role: 'barber',
      barbershopId: undefined,
      barberId: undefined
    });
  });

  it('prefers database profile role over user metadata role', () => {
    const session = mapAuthSession(
      {
        user: {
          id: 'user-1',
          email: 'leo@example.com',
          user_metadata: {
            display_name: 'Leo Metadata',
            role: 'owner'
          }
        }
      } as any,
      {
        id: 'user-1',
        display_name: 'Leo Profile',
        role: 'barber',
        barbershop_id: 'shop-1',
        barber_id: null
      }
    );

    expect(session).toEqual({
      userId: 'user-1',
      email: 'leo@example.com',
      displayName: 'Leo Profile',
      role: 'barber',
      barbershopId: 'shop-1',
      barberId: undefined
    });
  });

  it('maps barber_id from database profile into auth session barberId', () => {
    const session = mapAuthSession(
      {
        user: {
          id: 'user-2',
          email: 'gabriel@example.com',
          user_metadata: {
            display_name: 'Gabriel Metadata',
            role: 'owner'
          }
        }
      } as any,
      {
        id: 'user-2',
        display_name: 'Gabriel',
        role: 'barber',
        barbershop_id: null,
        barber_id: 'barber-1'
      }
    );

    expect(session).toEqual({
      userId: 'user-2',
      email: 'gabriel@example.com',
      displayName: 'Gabriel',
      role: 'barber',
      barbershopId: undefined,
      barberId: 'barber-1'
    });
  });
});

