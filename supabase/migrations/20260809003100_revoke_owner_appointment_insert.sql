-- Apply only after the owner frontend uses create_owner_appointment (030).
-- Review/test locally; remote rollout is manual. Older clients must refresh.
-- Rollback, if required, needs a separately reviewed migration; do not restore
-- direct writes as an automatic fallback.
revoke insert on table public.appointments from authenticated;

drop policy if exists appointments_owner_insert_own_barbershop
  on public.appointments;

-- Read-only rollout validation: every denied/absent result must be true.
select
  role_name,
  not has_table_privilege(role_name, 'public.appointments', 'INSERT') as insert_denied,
  not has_any_column_privilege(role_name, 'public.appointments', 'INSERT') as column_insert_denied,
  not has_table_privilege(role_name, 'public.appointments', 'SELECT') as select_denied,
  not has_table_privilege(role_name, 'public.appointments', 'UPDATE') as update_denied,
  not has_table_privilege(role_name, 'public.appointments', 'DELETE') as delete_denied
from unnest(array['anon', 'authenticated']) as roles(role_name);

select not exists (
  select 1 from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'appointments'
    and cmd in ('INSERT', 'ALL')
) as direct_insert_policies_absent;
