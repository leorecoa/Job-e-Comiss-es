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
    expect(canAccessInternalPanel({
      userId: 'user-1',
      email: 'owner@example.com',
      displayName: 'Owner',
      role: 'owner'
    }, true)).toBe(true);
    expect(canAccessInternalPanel({
      userId: 'user-2',
      email: 'barber@example.com',
      displayName: 'Barber',
      role: 'barber'
    }, true)).toBe(true);
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
      role: 'barber'
    });
  });
});
