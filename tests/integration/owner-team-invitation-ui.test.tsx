import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => ({ online: true }));
vi.mock('../../lib/supabase', () => ({
  get isSupabaseConfigured() { return runtime.online; },
  get shouldUseLocalFallback() { return !runtime.online; },
  supabase: { rpc: vi.fn() }, assertOperationalSupabase: vi.fn()
}));
import { OwnerBarberProfileLinking } from '../../components/OwnerBarberProfileLinking';
const render = (role: 'owner' | 'barber' = 'owner', active = true) => renderToStaticMarkup(
  <OwnerBarberProfileLinking role={role} barbers={[]} invitationContext="owner:tenant" invitationActive={active} />
);
describe('owner invitation entry', () => {
  beforeEach(() => { runtime.online = true; });
  it('offers invitations without the manual linking bridge', () => {
    const html = render();
    expect(html).toContain('Convidar acesso');
    expect(html).not.toContain('Vincular usuário');
    expect(html).not.toContain('Convite gerado');
    expect(html).not.toContain('/convite#token=');
  });
  it('disables the local feature instead of inventing a token', () => {
    runtime.online = false;
    const html = render();
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Convidar acesso/);
    expect(html).toContain('Convites disponíveis apenas no ambiente online.');
    expect(html).not.toContain('/convite#token=');
  });
  it('does not mount invitation state when management context is hidden', () => {
    expect(render('owner', false)).not.toContain('Convidar acesso');
    expect(render('owner', false)).toContain('Profissionais da equipe');
  });
  it('does not expose either operation to barber UI', () => { expect(render('barber')).toBe(''); });
});
