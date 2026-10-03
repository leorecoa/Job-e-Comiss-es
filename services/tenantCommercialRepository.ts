import { isSupabaseConfigured, shouldUseLocalFallback, supabase } from '../lib/supabase';
import { OperationalError } from '../utils/operationalError';

const statuses = ['unassigned', 'pending', 'trialing', 'active', 'paused', 'canceled'] as const;
export type TenantCommercialStatus = typeof statuses[number];
export type TenantCommercialState = {
  status: TenantCommercialStatus;
  planCode: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
};

const GENERIC_ERROR = 'Estado comercial indisponivel. Tente novamente.';
const FORBIDDEN = 'TENANT_COMMERCIAL_STATE_FORBIDDEN';
const nullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';

export const getTenantCommercialState = async (): Promise<TenantCommercialState> => {
  if (!isSupabaseConfigured || shouldUseLocalFallback || !supabase) {
    throw new OperationalError(GENERIC_ERROR);
  }
  try {
    const { data, error } = await supabase.rpc('get_tenant_commercial_state');
    if (error) throw error;
    const row: unknown = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error();
    const record = row as Record<string, unknown>;
    const { status, plan_code, trial_started_at, trial_ends_at, current_period_start, current_period_end } = record;
    if (typeof status !== 'string' || !statuses.includes(status as TenantCommercialStatus)
      || !nullableString(plan_code) || !nullableString(trial_started_at)
      || !nullableString(trial_ends_at) || !nullableString(current_period_start)
      || !nullableString(current_period_end)) throw new Error();
    if (status === 'unassigned' && [plan_code, trial_started_at, trial_ends_at, current_period_start, current_period_end]
      .some(value => value !== null)) throw new Error();
    return {
      status: status as TenantCommercialStatus,
      planCode: plan_code,
      trialStartedAt: trial_started_at,
      trialEndsAt: trial_ends_at,
      currentPeriodStart: current_period_start,
      currentPeriodEnd: current_period_end
    };
  } catch (error) {
    // P0001 carries the domain code in message; never propagate raw provider details.
    const forbidden = (error as { message?: unknown } | null)?.message === FORBIDDEN;
    throw new OperationalError(forbidden ? 'Sua sessao nao pode consultar o estado comercial.' : GENERIC_ERROR, {
      publicCode: forbidden ? FORBIDDEN : undefined
    });
  }
};
