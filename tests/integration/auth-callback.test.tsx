import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AuthCallbackScreen,
  getAuthCallbackDestination,
  hasAuthCallbackError
} from '../../components/AuthCallbackScreen';
import type { AuthSession } from '../../services/authRepository';
import { SUPABASE_AUTH_OPTIONS } from '../../lib/supabase';

const ownerSession = (barbershopId?: string): AuthSession => ({
  userId: 'owner-id',
  email: 'owner@example.test',
  role: 'owner',
  displayName: 'Owner',
  barbershopId
});

describe('owner email confirmation callback', () => {
  it('keeps the confirmed implicit auth contract', () => {
    expect(SUPABASE_AUTH_OPTIONS).toEqual({
      flowType: 'implicit',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true
    });
  });

  it('routes an owner without barbershop to onboarding', () => {
    expect(getAuthCallbackDestination(ownerSession())).toBe('/onboarding');
  });

  it('routes a configured owner to the dashboard', () => {
    expect(getAuthCallbackDestination(ownerSession('barbershop-id'))).toBe('/');
  });

  it('does not accept an external redirect parameter', () => {
    const destination = getAuthCallbackDestination(ownerSession());
    expect(destination).not.toContain('evil.example');
    expect(destination).not.toBe('/auth/callback');
    expect(hasAuthCallbackError('?redirect=https://evil.example', '')).toBe(false);
  });

  it('recognizes an invalid callback without exposing its raw error', () => {
    expect(hasAuthCallbackError('?error=access_denied&error_description=sensitive', '')).toBe(true);
    const html = renderToStaticMarkup(<AuthCallbackScreen loading={false} session={null} />);
    expect(html).toContain('Nao foi possivel confirmar seu email');
    expect(html).not.toContain('access_denied');
    expect(html).not.toContain('sensitive');
  });

  it('shows a processing state without tokens or codes', () => {
    const html = renderToStaticMarkup(<AuthCallbackScreen loading session={null} />);
    expect(html).toContain('Confirmando seu email');
    expect(html).not.toMatch(/access_token|refresh_token|authorization code/i);
  });
});
