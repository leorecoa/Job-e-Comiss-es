-- Authorized observation only: no provisioning, date transitions or enforcement.
create function public.get_tenant_commercial_state()
returns table (
  status text,
  plan_code text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz
)
language plpgsql stable security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'TENANT_COMMERCIAL_STATE_FORBIDDEN';
  end if;

  select p.barbershop_id into v_tenant_id
  from public.profiles as p
  join public.barbershops as b on b.id = p.barbershop_id
  where p.id = v_user_id and p.active is true and p.role = 'owner';

  if not found or v_tenant_id is null then
    raise exception using errcode = 'P0001', message = 'TENANT_COMMERCIAL_STATE_FORBIDDEN';
  end if;

  return query
  select case when s.barbershop_id is null then 'unassigned'::text else s.status end,
    s.plan_code, s.trial_started_at, s.trial_ends_at,
    s.current_period_started_at as current_period_start,
    s.current_period_ends_at as current_period_end
  from (values (v_tenant_id)) as tenant(id)
  left join public.tenant_subscriptions as s on s.barbershop_id = tenant.id;
end;
$$;

revoke all on function public.get_tenant_commercial_state()
  from public, anon, authenticated, service_role;
grant execute on function public.get_tenant_commercial_state() to authenticated;

comment on function public.get_tenant_commercial_state() is
  'Active owner only; tenant derived from auth.uid()/profile. Missing subscription is unassigned, never an access decision. Persisted statuses and instants only; no writes or legacy planType/isPro authority.';

-- Read-only rollout checks. Table/column ACLs and policies remain those of 035.
select
  has_function_privilege('authenticated', 'public.get_tenant_commercial_state()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_tenant_commercial_state()', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.get_tenant_commercial_state()', 'EXECUTE')
  and not exists (
    select 1 from pg_catalog.pg_proc as p
    cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) as acl
    where p.oid = 'public.get_tenant_commercial_state()'::regprocedure
      and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
  ) as commercial_reader_acl_valid;
