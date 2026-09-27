import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => ({ online: true }));
vi.mock('../../lib/supabase', () => ({
  get isSupabaseConfigured() { return runtime.online; },
  get shouldUseLocalFallback() { return !runtime.online; },
  supabase: null
}));
import { TeamInvitationScreen } from '../../components/TeamInvitationScreen';
import { AuthScreen } from '../../components/AuthScreen';

describe('invitation screen initial states', () => {
  beforeEach(() => { runtime.online = true; });
  it('does not render the bearer secret or claim validity before authentication', () => {
    const token = 'c'.repeat(64);
    const html = renderToStaticMarkup(<TeamInvitationScreen invitation={{ token }} onComplete={vi.fn()} />);
    expect(html).toContain('Validando sessão');
    expect(html).not.toContain(token);
    expect(html).not.toContain('Aceitar convite');
    expect(html).not.toContain('convite válido');
  });
  it('shows a missing link without an accept action', () => {
    const html = renderToStaticMarkup(<TeamInvitationScreen invitation={{ token: null }} onComplete={vi.fn()} />);
    expect(html).toContain('Link ausente ou inválido');
    expect(html).not.toContain('Aceitar convite');
  });
  it('fails closed offline without auth or acceptance actions', () => {
    runtime.online = false;
    const html = renderToStaticMarkup(<TeamInvitationScreen invitation={{ token: 'c'.repeat(64) }} onComplete={vi.fn()} />);
    expect(html).toContain('Convites disponíveis apenas no ambiente online.');
    expect(html).not.toContain('Aceitar convite');
    expect(html).not.toContain('auth-email');
  });
  it('can embed the existing auth form without a second main landmark', () => {
    const html = renderToStaticMarkup(<AuthScreen embedded signupRole="barber" onSignIn={vi.fn()} onSignUp={vi.fn()} />);
    expect(html).toContain('auth-email');
    expect(html).not.toContain('<main');
  });
});
