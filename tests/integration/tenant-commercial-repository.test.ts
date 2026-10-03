import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), online: true, local: false, client: true }));
vi.mock('../../lib/supabase', () => ({
  get isSupabaseConfigured() { return mocks.online; },
  get shouldUseLocalFallback() { return mocks.local; },
  get supabase() { return mocks.client ? { rpc: mocks.rpc, from: mocks.from } : null; }
}));
import { getTenantCommercialState } from '../../services/tenantCommercialRepository';
import { OperationalError } from '../../utils/operationalError';

const row = {
  status: 'unassigned', plan_code: null, trial_started_at: null, trial_ends_at: null,
  current_period_start: null, current_period_end: null
};
const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() };

describe('tenant commercial repository', () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.online = true; mocks.local = false; mocks.client = true;
    storage.getItem.mockReturnValue(JSON.stringify({ planType: 'admin_life', isPro: true }));
    vi.stubGlobal('localStorage', storage); vi.stubGlobal('sessionStorage', storage);
  });
  afterEach(() => {
    expect(mocks.from).not.toHaveBeenCalled();
    for (const method of Object.values(storage)) expect(method).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('reads with no selectors and maps explicit unassigned without legacy fallback', async () => {
    mocks.rpc.mockResolvedValue({ data: [row], error: null });
    expect(await getTenantCommercialState()).toEqual({
      status: 'unassigned', planCode: null, trialStartedAt: null, trialEndsAt: null,
      currentPeriodStart: null, currentPeriodEnd: null
    });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('get_tenant_commercial_state');
  });
  it.each(['pending', 'trialing', 'active', 'paused', 'canceled'])('preserves %s and literal past timestamps', async status => {
    const dates = {
      trial_started_at: '2000-01-01T00:00:00.123456+03:00', trial_ends_at: '2000-01-15T00:00:00+03:00',
      current_period_start: '2000-02-01T00:00:00Z', current_period_end: '2000-03-01T00:00:00Z'
    };
    mocks.rpc.mockResolvedValue({ data: [{ ...row, ...dates, status, plan_code: 'fixture', internal: 'not exposed' }], error: null });
    expect(await getTenantCommercialState()).toEqual({
      status, planCode: 'fixture', trialStartedAt: dates.trial_started_at, trialEndsAt: dates.trial_ends_at,
      currentPeriodStart: dates.current_period_start, currentPeriodEnd: dates.current_period_end
    });
  });
  it('accepts nullable fields without inventing defaults', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ ...row, status: 'pending' }], error: null });
    expect(await getTenantCommercialState()).toEqual({ status: 'pending', planCode: null,
      trialStartedAt: null, trialEndsAt: null, currentPeriodStart: null, currentPeriodEnd: null });
  });
  it.each([null, undefined, [], [row, row], row, [null], [[]], ['bad'], [123],
    [{ ...row, status: 'expired' }], [{ ...row, status: null }],
    [{ ...row, plan_code: 'inconsistent_unassigned' }]])('rejects invalid result %# instead of unassigned', async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(getTenantCommercialState()).rejects.toBeInstanceOf(OperationalError);
  });
  it.each(Object.keys(row))('rejects missing and incorrectly typed %s', async field => {
    for (const value of [undefined, 42, {}, false]) {
      mocks.rpc.mockResolvedValue({ data: [{ ...row, [field]: value }], error: null });
      await expect(getTenantCommercialState()).rejects.toBeInstanceOf(OperationalError);
    }
  });
  it('preserves only the known authorization code from the P0001 message', async () => {
    mocks.rpc.mockResolvedValue({ data: [row], error: {
      code: 'P0001', message: 'TENANT_COMMERCIAL_STATE_FORBIDDEN', details: 'private details', hint: 'private SQL'
    } });
    const error = await getTenantCommercialState().catch(error => error);
    expect(error).toBeInstanceOf(OperationalError);
    expect(error).toMatchObject({ publicCode: 'TENANT_COMMERCIAL_STATE_FORBIDDEN', message: 'Sua sessao nao pode consultar o estado comercial.' });
    expect(error).not.toHaveProperty('details'); expect(error).not.toHaveProperty('hint');
  });
  it.each(['response', 'rejection'])('sanitizes %s failures without success or fallback', async mode => {
    const raw = { message: 'private payload', details: 'private SQL', hint: 'private hint' };
    if (mode === 'response') mocks.rpc.mockResolvedValue({ data: [row], error: raw });
    else mocks.rpc.mockRejectedValue(new Error(raw.message));
    const error = await getTenantCommercialState().catch(error => error);
    expect(error).toBeInstanceOf(OperationalError);
    expect(error.message).toBe('Estado comercial indisponivel. Tente novamente.');
    expect(error.publicCode).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain('private');
    expect(error).not.toHaveProperty('cause');
  });
  it.each(['online', 'local', 'client'] as const)('rejects unavailable %s without RPC or local state', async flag => {
    mocks[flag] = flag === 'local';
    await expect(getTenantCommercialState()).rejects.toBeInstanceOf(OperationalError);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
