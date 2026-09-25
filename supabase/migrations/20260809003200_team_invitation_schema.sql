-- Schema only. Validate locally before manual remote rollout:
-- supabase test db --local supabase/tests
-- Stop on duplicate profile links; never repair user data automatically.
-- Keep the preflight and unique index in the same migration transaction.
lock table public.profiles in share row exclusive mode;
do $preflight$
begin
  if exists (
    select 1 from public.profiles
    where barber_id is not null
    group by barber_id having count(*) > 1
  ) then
    raise exception 'PROFILE_BARBER_CARDINALITY_PREFLIGHT_FAILED';
  end if;
end
$preflight$;

create unique index profiles_barber_id_unique
  on public.profiles (barber_id) where barber_id is not null;

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete restrict,
  barber_id uuid not null,
  recipient_email text not null,
  token_hash bytea not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete restrict,
  revoked_at timestamptz,
  constraint team_invitations_barber_tenant_fkey
    foreign key (barber_id, barbershop_id)
    references public.barbers(id, barbershop_id) on delete restrict,
  constraint team_invitations_recipient_email_valid check (
    recipient_email = lower(btrim(recipient_email))
    and char_length(recipient_email) between 3 and 254
    and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  constraint team_invitations_token_hash_key unique (token_hash),
  constraint team_invitations_token_hash_valid check (octet_length(token_hash) = 32),
  constraint team_invitations_expiry_valid check (
    isfinite(created_at) and isfinite(expires_at)
    and expires_at > created_at
    and expires_at = created_at + interval '48 hours'
  ),
  constraint team_invitations_acceptance_valid check (
    (accepted_at is null and accepted_by is null)
    or (accepted_at is not null and accepted_by is not null
      and isfinite(accepted_at) and accepted_at >= created_at and accepted_at < expires_at)
  ),
  constraint team_invitations_revocation_valid check (
    revoked_at is null or (isfinite(revoked_at) and revoked_at >= created_at)
  ),
  constraint team_invitations_terminal_state_valid check (
    accepted_at is null or revoked_at is null
  )
);

alter table public.team_invitations enable row level security;
-- No reader/writer exists yet, including for the proxy: neutralize default ACLs.
revoke all on table public.team_invitations from public, anon, authenticated, service_role;

comment on table public.team_invitations is
  'Private team invitation state. PR B must validate owner/session tenant, verified recipient email, expiration and atomically consume under locks. No browser access.';
comment on column public.team_invitations.token_hash is
  'SHA-256 digest only (32 bytes). PR B generates a cryptographically random bearer token; never persist or log the raw token. Never return this hash to the browser.';

-- link_barber_profile_by_email remains an unchanged TEMPORARY compatibility bridge.
-- Cutover must revoke/remove it once the invitation workflow is functional.
-- Single-use/irreversible transitions and reissue revocation belong to PR B's
-- controlled transaction, not to client updates or these row-state checks.
-- Rollback needs separate review; do not drop invitation history automatically.

-- Read-only rollout validation: denied results must be true for every role.
select role_name,
  not has_table_privilege(role_name, 'public.team_invitations', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as table_access_denied,
  not has_any_column_privilege(role_name, 'public.team_invitations', 'SELECT,INSERT,UPDATE,REFERENCES') as column_access_denied
from unnest(array['anon', 'authenticated', 'service_role']) as roles(role_name);
