import { describe, expect, it } from 'vitest';
import { getInternalAuthView, isOwnerOnboardingPath } from './App';
import type { AuthSession } from './services/authRepository';

const ownerSession = (barbershopId?: string): AuthSession => ({
  userId: 'owner-id',
  email: 'owner@example.test',
  role: 'owner',
  displayName: 'Owner',
  barbershopId
});

const barberSession = (barbershopId?: string, barberId?: string): AuthSession => ({
  userId: 'barber-id',
  email: 'barber@example.test',
  role: 'barber',
  displayName: 'Barber',
  barbershopId,
  barberId
});

describe('internal auth routing', () => {
  it('renders loading before evaluating the session', () => {
    expect(getInternalAuthView(true, null, true)).toBe('loading');
  });

  it('renders AuthScreen when the session is null', () => {
    expect(getInternalAuthView(false, null, true)).toBe('auth');
  });

  it('routes a newly confirmed owner to onboarding instead of AuthScreen', () => {
    expect(getInternalAuthView(false, ownerSession(), true)).toBe('owner-onboarding');
  });

  it('renders the owner dashboard when the tenant link exists', () => {
    expect(getInternalAuthView(false, ownerSession('barbershop-id'), true)).toBe('owner-dashboard');
  });

  it('renders BarberDashboard for a complete barber session', () => {
    expect(getInternalAuthView(false, barberSession('barbershop-id', 'barber-id'), true)).toBe('barber-dashboard');
  });

  it('keeps an incomplete barber in BarberDashboard for its existing blocked state', () => {
    expect(getInternalAuthView(false, barberSession('barbershop-id'), true)).toBe('barber-dashboard');
  });

  it('preserves onboarding after refresh on /onboarding', () => {
    expect(isOwnerOnboardingPath('/onboarding')).toBe(true);
    expect(getInternalAuthView(false, ownerSession(), true)).toBe('owner-onboarding');
  });

  it('does not return a newly confirmed owner to login after sign-in resolves', () => {
    expect(getInternalAuthView(false, ownerSession(), true)).not.toBe('auth');
  });
});
