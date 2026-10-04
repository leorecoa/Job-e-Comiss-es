-- Observational only. No operational writer calls this function.
create function private.resolve_tenant_entitlements(p_barbershop_id uuid)
returns table (
  commercial_status text,
  commercial_condition text,
  can_create_internal_appointment boolean,
  can_accept_public_booking boolean,
  reason text,
  evaluated_at timestamptz
)
language plpgsql volatile security invoker
set search_path = pg_catalog
as $$
declare
  v_state record;
begin
  if p_barbershop_id is null then
    raise exception using errcode = 'P0001', message = 'COMMERCIAL_ENTITLEMENT_TENANT_REQUIRED';
  end if;

  -- One snapshot distinguishes a missing subscription from a broken plan reference.
  select s.barbershop_id as subscription_tenant, s.status, s.plan_code,
    s.trial_started_at, s.trial_ends_at, p.code as matched_plan_code
  into v_state
  from public.barbershops as b
  left join public.tenant_subscriptions as s on s.barbershop_id = b.id
  left join public.commercial_plans as p on p.code = s.plan_code
  where b.id = p_barbershop_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'COMMERCIAL_ENTITLEMENT_TENANT_NOT_FOUND';
  end if;

  evaluated_at := pg_catalog.clock_timestamp();
  commercial_status := v_state.status;
  if v_state.subscription_tenant is null then
    commercial_condition := 'unassigned';
  else
    if v_state.matched_plan_code is null
      or pg_catalog.char_length(v_state.plan_code) not between 1 and 64
      or v_state.plan_code !~ '^[a-z][a-z0-9_]*$' then
      raise exception using errcode = 'P0001', message = 'COMMERCIAL_ENTITLEMENT_PLAN_INVALID';
    end if;
    if v_state.status is null or v_state.status not in ('pending', 'trialing', 'active', 'paused', 'canceled') then
      raise exception using errcode = 'P0001', message = 'COMMERCIAL_ENTITLEMENT_STATUS_INVALID';
    end if;
    if (v_state.trial_started_at is null) <> (v_state.trial_ends_at is null)
      or (v_state.status = 'trialing' and v_state.trial_started_at is null)
      or (v_state.trial_started_at is not null and (
        not pg_catalog.isfinite(v_state.trial_started_at)
        or not pg_catalog.isfinite(v_state.trial_ends_at)
        or v_state.trial_started_at >= v_state.trial_ends_at
      )) then
      raise exception using errcode = 'P0001', message = 'COMMERCIAL_ENTITLEMENT_TRIAL_INVALID';
    end if;

    commercial_condition := v_state.status;
    if v_state.status = 'trialing' then
      if evaluated_at < v_state.trial_started_at then
        commercial_condition := 'trial_not_started';
      elsif evaluated_at >= v_state.trial_ends_at then
        commercial_condition := 'trial_expired';
      else
        commercial_condition := 'trial_valid';
      end if;
    end if;
  end if;

  can_create_internal_appointment := commercial_condition in ('unassigned', 'trial_valid', 'active');
  can_accept_public_booking := can_create_internal_appointment;
  reason := case commercial_condition
    when 'unassigned' then 'UNASSIGNED_COMPATIBILITY'
    when 'pending' then 'COMMERCIAL_PENDING'
    when 'trial_valid' then 'TRIAL_VALID'
    when 'trial_not_started' then 'TRIAL_NOT_STARTED'
    when 'trial_expired' then 'TRIAL_EXPIRED'
    when 'active' then 'COMMERCIAL_ACTIVE'
    when 'paused' then 'COMMERCIAL_PAUSED'
    when 'canceled' then 'COMMERCIAL_CANCELED'
  end;
  return next;
end;
$$;

revoke execute on function private.resolve_tenant_entitlements(uuid)
  from public, anon, authenticated, service_role;

comment on function private.resolve_tenant_entitlements(uuid) is
  'Administrative observation only: commercial booleans neither authorize nor block operations. Invoker privileges, trusted tenant input, one database clock instant; no state mutations or operational integration. Not a transactional enforcement boundary.';
