-- Administrative current-state replacement only; no HTTP or client authority.
create function private.set_tenant_subscription(
  p_barbershop_id uuid,
  p_plan_code text,
  p_status text,
  p_trial_started_at timestamptz,
  p_trial_ends_at timestamptz,
  p_current_period_started_at timestamptz,
  p_current_period_ends_at timestamptz
)
returns void
language plpgsql volatile security invoker
set search_path = pg_catalog
as $$
begin
  if not exists (select 1 from public.barbershops where id = p_barbershop_id) then
    raise exception using errcode = 'P0001', message = 'TENANT_SUBSCRIPTION_TENANT_NOT_FOUND';
  end if;
  if not exists (select 1 from public.commercial_plans where code = p_plan_code) then
    raise exception using errcode = 'P0001', message = 'TENANT_SUBSCRIPTION_PLAN_NOT_FOUND';
  end if;
  if p_status is null or p_status not in ('pending', 'trialing', 'active', 'paused', 'canceled') then
    raise exception using errcode = 'P0001', message = 'TENANT_SUBSCRIPTION_INVALID_STATUS';
  end if;

  -- The 035 constraints validate all temporal pairs; its trigger owns updated_at.
  -- The unique tenant key serializes competing upserts (last write wins).
  insert into public.tenant_subscriptions (
    barbershop_id, plan_code, status, trial_started_at, trial_ends_at,
    current_period_started_at, current_period_ends_at
  ) values (
    p_barbershop_id, p_plan_code, p_status, p_trial_started_at, p_trial_ends_at,
    p_current_period_started_at, p_current_period_ends_at
  )
  on conflict (barbershop_id) do update set
    plan_code = excluded.plan_code,
    status = excluded.status,
    trial_started_at = excluded.trial_started_at,
    trial_ends_at = excluded.trial_ends_at,
    current_period_started_at = excluded.current_period_started_at,
    current_period_ends_at = excluded.current_period_ends_at;
end;
$$;

revoke execute on function private.set_tenant_subscription(uuid, text, text, timestamptz, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;

comment on function private.set_tenant_subscription(uuid, text, text, timestamptz, timestamptz, timestamptz, timestamptz) is
  'Trusted database administration only, using invoker privileges. Explicit full replacement with last-write-wins; NULL clears optional pairs. No billing, gating, history, provisioning or client authority.';
