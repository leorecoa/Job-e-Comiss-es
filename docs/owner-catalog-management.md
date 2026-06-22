# Owner Catalog Management

## Objective

Allow each owner to place a newly created barbershop into operation without manual SQL.

After onboarding, the owner can manage the operational catalog from the internal panel:

- barbers
- services

## Scope

The owner panel now supports:

- listing barbers from the current `barbershop_id`
- creating barbers for the current `barbershop_id`
- editing barber name
- activating and deactivating barbers without deleting rows
- listing services from the current `barbershop_id`
- creating services for the current `barbershop_id`
- editing service name, price, duration, and commission
- activating and deactivating services without deleting rows

Public booking continues reading only active catalog rows.

## Data Rules

### Barbers

Every owner query must be scoped by:

```txt
barbershop_id = current owner barbershop
```

Public booking uses only:

```txt
active = true
```

### Services

Every owner query must be scoped by:

```txt
barbershop_id = current owner barbershop
```

Public booking uses only:

```txt
active = true
```

## Why Deactivate Instead Of Delete

Catalog rows are deactivated instead of deleted so historical appointments keep consistent references and reporting remains intact.

## Local Fallback

The localStorage fallback remains available for non-Supabase usage.

When local mode is active, catalog rows are still associated with the local fallback barbershop where possible and active/inactive state is preserved in local settings data.

## Expected Supabase Permissions

This repository change does not apply SQL automatically.

If the current Supabase RLS/policies already allow owners to insert and update their own barbers and services rows, no database change is required.

If owner writes are still blocked, the environment may need owner-scoped insert/update policies for:

- `public.barbers`
- `public.services`

## Example SQL If Owner Catalog Writes Are Still Blocked

Review carefully before applying. This is documentation only.

```sql
create policy "barbers_owner_insert_own_barbershop"
on public.barbers
for insert
to authenticated
with check (
  barbershop_id = private.current_user_barbershop_id()
);

create policy "barbers_owner_update_own_barbershop"
on public.barbers
for update
to authenticated
using (
  barbershop_id = private.current_user_barbershop_id()
)
with check (
  barbershop_id = private.current_user_barbershop_id()
);

create policy "services_owner_insert_own_barbershop"
on public.services
for insert
to authenticated
with check (
  barbershop_id = private.current_user_barbershop_id()
);

create policy "services_owner_update_own_barbershop"
on public.services
for update
to authenticated
using (
  barbershop_id = private.current_user_barbershop_id()
)
with check (
  barbershop_id = private.current_user_barbershop_id()
);

notify pgrst, 'reload schema';
```

## Acceptance Flow

1. Owner finishes onboarding.
2. Owner opens the internal panel.
3. Owner creates at least one barber.
4. Owner creates at least one service.
5. Owner opens `/book/:slug`.
6. Public booking shows only the active catalog for that same barbershop.

## Next Steps

1. Add explicit owner onboarding checklist after first login.
2. Add invite flow for barber accounts linked to catalog barbers.
3. Add owner-side validation for duplicate barber/service names inside the same barbershop.
