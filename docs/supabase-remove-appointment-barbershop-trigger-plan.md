# Supabase Appointment Barbershop Trigger Removal Plan

## Status

This is a documentation-only plan for safely removing the temporary appointment `barbershop_id` fallback trigger from Supabase.

Do not execute this document as a migration. Do not apply the SQL without a separate manual review and controlled production window.

This plan has since been applied manually in Supabase and validated in production. See `docs/supabase-appointment-barbershop-trigger-removal-applied.md`.

## Temporary Trigger

The temporary trigger still exists in Supabase:

```txt
trigger_name: set_default_appointment_barbershop_id
event: INSERT
table: appointments
action: EXECUTE FUNCTION set_default_appointment_barbershop_id()
```

The function also still exists:

```txt
schema: public
routine_name: set_default_appointment_barbershop_id
type: FUNCTION
```

## Why It Was Created

The trigger was created during the tenant migration as a safety fallback.

Its purpose was to automatically fill `appointments.barbershop_id` for older rows or legacy insert flows that did not yet resolve and send a barbershop explicitly.

That fallback helped keep public booking stable while the project moved through:

- tenant columns and backfill
- tenant-aware frontend and repositories
- public booking by slug
- tenant-aware RLS
- public appointment entity ID hardening
- `barbershop_id NOT NULL`

## Why It Can Be Removed Now

The fallback is no longer part of the desired multi-tenant contract.

It can now be removed because:

- `appointments.barbershop_id` is already `NOT NULL`
- the frontend/repository sends `barbershopId`
- `appointments_public_insert_scheduled` requires `barbershop_id`
- public appointment creation requires `barber_id` and `service_id`
- public inserts validate that barber and service belong to the same active `barbershop_id`
- `/book/gestao-maxima` has been validated
- `/book/barbearia-fake-rls` has been validated
- owner and barber logins have been validated after `NOT NULL`

Keeping the fallback could mask future bugs. In a multi-tenant architecture, the database should not infer a default barbershop for new appointment inserts.

## Preconditions

Confirm all of these before removal:

- `barbershop_id NOT NULL` is applied on `public.appointments`
- `barbershop_id NOT NULL` is applied on `public.profiles`
- `barbershop_id NOT NULL` is applied on `public.barbers`
- `barbershop_id NOT NULL` is applied on `public.services`
- `appointments_public_insert_scheduled` requires `barbershop_id`
- `appointments_public_insert_scheduled` requires `barber_id`
- `appointments_public_insert_scheduled` requires `service_id`
- frontend/repository requires `barbershopId`
- frontend/repository requires `barberId`
- frontend/repository requires `serviceId`
- `/book/gestao-maxima` creates appointments with `barbershop_id`
- `/book/barbearia-fake-rls` creates appointments with `barbershop_id`
- `/book/barbearia-inexistente` remains blocked
- owner login works
- barber login works

Reference records:

- `docs/supabase-tenant-rls-applied.md`
- `docs/supabase-tenant-isolation-validation.md`
- `docs/public-appointment-entity-id-hardening.md`
- `docs/supabase-barbershop-id-not-null-applied.md`

## Pre-Removal Diagnostics

Run this before removing the trigger and function.

```sql
select
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name = 'set_default_appointment_barbershop_id';

select
  routine_schema,
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'set_default_appointment_barbershop_id';
```

Expected result before removal:

- one trigger row for `set_default_appointment_barbershop_id`
- one function row for `public.set_default_appointment_barbershop_id`

Also confirm recent public appointments have explicit tenant and entity IDs:

```sql
select
  id,
  client_name,
  barbershop_id,
  barber_id,
  service_id,
  status,
  created_at
from public.appointments
where created_at >= now() - interval '7 days'
order by created_at desc
limit 20;
```

Expected result:

- `barbershop_id` is present
- `barber_id` is present
- `service_id` is present
- public appointments use `status = 'scheduled'`

## Planned Removal SQL

Apply only after the diagnostics and preconditions pass.

```sql
begin;

drop trigger if exists set_default_appointment_barbershop_id
on public.appointments;

drop function if exists public.set_default_appointment_barbershop_id();

notify pgrst, 'reload schema';

commit;
```

## Rollback SQL

Use this only as an emergency operational rollback if a production insert flow unexpectedly still depends on the fallback.

This rollback recreates a conservative fallback to the active `gestao-maxima` barbershop, matching the legacy migration intent. It should be removed again after the failing flow is fixed.

```sql
begin;

create or replace function public.set_default_appointment_barbershop_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_barbershop_id uuid;
begin
  if new.barbershop_id is not null then
    return new;
  end if;

  select b.id
    into default_barbershop_id
  from public.barbershops b
  where b.slug = 'gestao-maxima'
    and b.active = true
  limit 1;

  if default_barbershop_id is null then
    raise exception 'Default barbershop gestao-maxima was not found or is inactive';
  end if;

  new.barbershop_id := default_barbershop_id;
  return new;
end;
$$;

drop trigger if exists set_default_appointment_barbershop_id
on public.appointments;

create trigger set_default_appointment_barbershop_id
before insert on public.appointments
for each row
execute function public.set_default_appointment_barbershop_id();

notify pgrst, 'reload schema';

commit;
```

## Post-Removal Validation

After removal, validate:

- `/book/gestao-maxima` creates an appointment with `barbershop_id`
- `/book/barbearia-fake-rls` creates an appointment with `barbershop_id`
- `/book/barbearia-inexistente` remains blocked
- owner login still reads appointments
- barber login still reads only own appointments
- new appointments include `barbershop_id`, `barber_id`, and `service_id`

Use a confirmation query after creating test appointments:

```sql
select
  client_name,
  client_phone,
  barbershop_id,
  barber_id,
  service_id,
  barber_name,
  service_type,
  status,
  created_at
from public.appointments
order by created_at desc
limit 20;
```

Expected result:

- new public appointments have `barbershop_id`
- new public appointments have `barber_id`
- new public appointments have `service_id`
- no new row relies on automatic default barbershop assignment

Confirm the trigger and function are gone:

```sql
select
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name = 'set_default_appointment_barbershop_id';

select
  routine_schema,
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'set_default_appointment_barbershop_id';
```

Expected result after removal:

- no trigger row
- no function row

## Risks

- A hidden legacy insert flow may still omit `barbershop_id`.
- A manual Supabase insert without `barbershop_id` will fail because `barbershop_id` is `NOT NULL`.
- If a client-side regression omits `barbershopId`, the insert should fail instead of silently falling back.
- If rollback is used, the fallback can again mask tenant-resolution bugs and should be treated as temporary.

These risks are acceptable only if the post-removal validation confirms current public and authenticated flows send explicit tenant IDs.

## Next Steps After Removal

1. Record the applied removal in a separate documentation PR.
2. Keep the fake second barbershop validation scenario available.
3. Repeat public booking checks after any future RLS or repository change.
4. Treat any missing `barbershop_id` insert failure as a code or operational bug, not as a reason to restore permanent fallback behavior.
