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
    expect(html).toContain('Gerar convite');
    expect(html).not.toContain('Vincular usuário');
    expect(html).not.toContain('Convite gerado');
    expect(html).not.toContain('/convite#token=');
  });
  it('disables the local feature instead of inventing a token', () => {
    runtime.online = false;
    const html = render();
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Gerar convite/);
    expect(html).toContain('Convites disponíveis apenas no ambiente online.');
    expect(html).not.toContain('/convite#token=');
  });
  it('keeps the entry visible outside the active subsection without mounting the form or token', () => {
    const html = render('owner', false);
    expect(html).toContain('Gerar convite');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('id="invite-email"');
    expect(html).not.toContain('/convite#token=');
    expect(html).toContain('Profissionais da equipe');
  });
  it('does not expose either operation to barber UI', () => { expect(render('barber')).toBe(''); });
});
