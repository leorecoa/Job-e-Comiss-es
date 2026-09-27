import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), online: true, local: false, report: vi.fn() }));
vi.mock('../../lib/supabase', () => ({
  get isSupabaseConfigured() { return mocks.online; },
  get shouldUseLocalFallback() { return mocks.local; },
  supabase: { rpc: mocks.rpc, from: mocks.from }
}));
vi.mock('../../utils/observability', () => ({ reportUnexpectedError: mocks.report }));
import { getTeamInvitationErrorMessage, issueTeamInvitation, revokeTeamInvitation } from '../../services/teamInvitationRepository';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const row = { invitation_id: id, token: 'a'.repeat(64), expires_at: '2030-10-01T10:00:00+00:00' };
describe('team invitation repository', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.online = true; mocks.local = false; });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('issues with only barber and normalized email; returns only validated fields', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ ...row, token_hash: 'must not escape', barbershop_id: id }], error: null });
    expect(await issueTeamInvitation(id, '  BARBER@Example.test ')).toEqual({ invitationId: id, token: row.token, expiresAt: row.expires_at });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('issue_team_invitation', { p_barber_id: id, p_recipient_email: 'barber@example.test' });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([
    null, [], [row, row], row,
    [{ ...row, token: 'a'.repeat(63) }], [{ ...row, token: 'A'.repeat(64) }],
    [{ ...row, invitation_id: 'bad' }], [{ ...row, invitation_id: null }],
    [{ ...row, expires_at: 'bad' }], [{ ...row, expires_at: '2030-02-30T10:00:00Z' }],
    [{ ...row, expires_at: '2030-10-01' }]
  ])('rejects invalid or ambiguous result %#', async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(issueTeamInvitation(id, 'barber@example.test')).rejects.toThrow('Não foi possível concluir esta ação com o convite.');
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it('revokes using only invitation id, accepts void', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(revokeTeamInvitation(id)).resolves.toBeUndefined();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('revoke_team_invitation', { p_invitation_id: id });
  });
  it.each([
    ['AUTH_REQUIRED', 'Entre novamente para continuar.'],
    ['TEAM_INVITATION_FORBIDDEN', 'Você não pode gerenciar convites nesta sessão.'],
    ['TEAM_INVITATION_INPUT_INVALID', 'Confira o profissional e o e-mail informado.'],
    ['TEAM_INVITATION_UNAVAILABLE', 'Não foi possível concluir esta ação com o convite.']
  ])('maps P0001 domain message %s without raw details', async (code, message) => {
    mocks.rpc.mockResolvedValue({ error: { code: 'P0001', message: code, details: row.token, hint: 'private SQL' } });
    for (const operation of [() => issueTeamInvitation(id, 'barber@example.test'), () => revokeTeamInvitation(id)]) {
      const error = await operation().catch((error) => error);
      expect(error).toMatchObject({ message, publicCode: code });
      expect(getTeamInvitationErrorMessage(error)).toBe(message);
      expect(error).not.toHaveProperty('details');
      expect(error).not.toHaveProperty('hint');
      expect(JSON.stringify(error)).not.toContain(row.token);
    }
  });
  it('sanitizes network rejection without retry, storage, logging or reporting', async () => {
    const storage = { setItem: vi.fn(), getItem: vi.fn() };
    vi.stubGlobal('localStorage', storage); vi.stubGlobal('sessionStorage', storage);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.rpc.mockRejectedValue(new Error(`network payload ${row.token}`));
    const error = await issueTeamInvitation(id, 'barber@example.test').catch((error) => error);
    expect(error.message).toBe('Não foi possível concluir esta ação com o convite.');
    expect(JSON.stringify(error)).not.toContain(row.token);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled(); expect(storage.getItem).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled(); expect(errorLog).not.toHaveBeenCalled(); expect(mocks.report).not.toHaveBeenCalled();
    expect(getTeamInvitationErrorMessage(new Error(row.token))).not.toContain(row.token);
  });
  it('does not persist or log successful issuance', async () => {
    const storage = { setItem: vi.fn() };
    vi.stubGlobal('localStorage', storage); vi.stubGlobal('sessionStorage', storage);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({ data: [row], error: null });
    await issueTeamInvitation(id, 'barber@example.test');
    expect(storage.setItem).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled(); expect(mocks.report).not.toHaveBeenCalled();
  });
  it.each([true, false])('fails closed without online mode (configured=%s)', async (online) => {
    mocks.online = online; mocks.local = true;
    await expect(issueTeamInvitation(id, 'barber@example.test')).rejects.toThrow('Convites disponíveis apenas no ambiente online.');
    await expect(revokeTeamInvitation(id)).rejects.toThrow('Convites disponíveis apenas no ambiente online.');
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it('rejects invalid inputs before RPC', async () => {
    await expect(issueTeamInvitation('bad', 'barber@example.test')).rejects.toThrow('Confira');
    await expect(issueTeamInvitation(id, 'invalid')).rejects.toThrow('Confira');
    await expect(revokeTeamInvitation('bad')).rejects.toThrow('Confira');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
