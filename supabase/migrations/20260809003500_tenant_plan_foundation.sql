-- Commercial state only: no billing, provisioning or operational enforcement.
-- Existing and new tenants remain unassigned until an explicit server-side decision.
create table public.commercial_plans (
  code text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_plans_code_valid check (
    char_length(code) between 1 and 64 and code ~ '^[a-z][a-z0-9_]*$'
  ),
  constraint commercial_plans_name_valid check (
    name = btrim(name) and char_length(name) between 1 and 120
  ),
  constraint commercial_plans_timestamps_valid check (
    isfinite(created_at) and isfinite(updated_at) and updated_at >= created_at
  )
);

-- One current-state row per tenant, including when canceled. Not a history ledger.
create table public.tenant_subscriptions (
  barbershop_id uuid primary key references public.barbershops(id) on delete restrict,
  plan_code text not null references public.commercial_plans(code) on update restrict on delete restrict,
  status text not null,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_started_at timestamptz,
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_subscriptions_status_valid check (
    status in ('pending', 'trialing', 'active', 'paused', 'canceled')
  ),
  constraint tenant_subscriptions_trial_valid check (
    (trial_started_at is null and trial_ends_at is null)
    or (trial_started_at is not null and trial_ends_at is not null
      and isfinite(trial_started_at) and isfinite(trial_ends_at)
      and trial_ends_at > trial_started_at)
  ),
  constraint tenant_subscriptions_trialing_requires_trial check (
    status <> 'trialing' or (trial_started_at is not null and trial_ends_at is not null)
  ),
  constraint tenant_subscriptions_period_valid check (
    (current_period_started_at is null and current_period_ends_at is null)
    or (current_period_started_at is not null and current_period_ends_at is not null
      and isfinite(current_period_started_at) and isfinite(current_period_ends_at)
      and current_period_ends_at > current_period_started_at)
  ),
  constraint tenant_subscriptions_timestamps_valid check (
    isfinite(created_at) and isfinite(updated_at) and updated_at >= created_at
  )
);

create trigger commercial_plans_set_updated_at before update on public.commercial_plans
for each row execute function public.set_updated_at();
create trigger tenant_subscriptions_set_updated_at before update on public.tenant_subscriptions
for each row execute function public.set_updated_at();

alter table public.commercial_plans enable row level security;
alter table public.tenant_subscriptions enable row level security;
-- No consumers in PR A. Neutralize default privileges, including service_role.
revoke all on table public.commercial_plans, public.tenant_subscriptions
  from public, anon, authenticated, service_role;

comment on table public.commercial_plans is
  'Server-managed plan identities. No seeded pricing, provider data or entitlements. Never derive authorization from frontend planType/isPro.';
comment on table public.tenant_subscriptions is
  'One commercial current-state record per tenant. Missing row means unassigned, not denied access. No operational enforcement in 035.';
comment on column public.tenant_subscriptions.plan_code is
  'Stable plan reference for a future server-side entitlement resolver; no client authority.';
comment on column public.tenant_subscriptions.status is
  'pending: not activated; trialing: explicit trial window; active: active relationship; paused: suspended commercial state; canceled: ended relationship. No feature gating yet.';
comment on column public.tenant_subscriptions.trial_ends_at is
  'Exclusive endpoint. No automatic expiry transition or fixed trial length in this foundation.';
comment on column public.tenant_subscriptions.current_period_ends_at is
  'Exclusive endpoint of an optional explicit cycle. No assumed monthly recurrence, payment or timezone.';

-- Read-only rollout verification; all results must be true.
select role_name, table_name,
  not has_table_privilege(role_name, table_name, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as table_access_denied,
  not has_any_column_privilege(role_name, table_name, 'SELECT,INSERT,UPDATE,REFERENCES') as column_access_denied
from unnest(array['anon', 'authenticated', 'service_role']) as roles(role_name)
cross join unnest(array['public.commercial_plans', 'public.tenant_subscriptions']) as tables(table_name);
