# Supabase Tenant RLS Applied

## Status

Tenant-aware RLS was applied manually in Supabase and validated in production.

This document records the production state. It is not an executable migration.

## Applied Scope

Tenant-aware RLS is now applied to:

- `public.appointments`
- `public.barbers`
- `public.services`
- `public.profiles`
- `public.barbershops`

The policies use `barbershop_id = private.current_user_barbershop_id()` for authenticated tenant isolation.

Owner access is scoped to the owner profile's own barbershop. Owner access is not global.

Barber access is scoped to the barber profile's own barbershop and, for appointments, to the profile's own `barber_id`.

## Removed Broad Policies

The manual Supabase application removed these broad policies:

```txt
appointments_authenticated_read
appointments_authenticated_insert
appointments_authenticated_update
appointments_authenticated_delete
barbers_owner_manage
services_owner_manage
profiles_owner_manage
profiles_owner_read_all
```

The hardened plan also accounts for public and self-profile policies that may exist in older environments:

```txt
appointments_public_insert_scheduled
barbers_public_read_active
services_public_read_active
profiles_insert_own_as_barber
profiles_select_own
barbershops_authenticated_read_own
barbershops_public_read_active
```

## Final Expected Policy State

### Barbershops

- `anon` can read active barbershops for public booking slug resolution.
- `authenticated` users can read only their own barbershop.

### Profiles

- Users can read their own profile.
- Owners can read and manage profiles only inside their own barbershop.
- Self-created profiles must be `role = 'barber'` and tied to a valid barbershop.
- Barbers cannot read or manage profiles from another barbershop.

### Barbers

- `anon` can read active barbers needed for public booking.
- `authenticated` users can read barbers only from their own barbershop.
- Owners can manage barbers only inside their own barbershop.
- Barbers cannot manage other barbers.

### Services

- `anon` can read active services needed for public booking.
- `authenticated` users can read services only from their own barbershop.
- Owners can manage services only inside their own barbershop.
- Barbers cannot manage services.

### Appointments

- `anon` can insert public appointments only with `status = 'scheduled'`.
- Public inserts require a non-null `barbershop_id`, required client/service/time fields, valid time range, and an active matching barbershop.
- Owners can read, insert, update, and delete appointments only inside their own barbershop.
- Barbers can read, insert, and update appointments only inside their own barbershop and own `barber_id`.
- Barbers cannot delete appointments.

## Public Slots View

`public.public_appointment_slots` remains the public read surface for booking availability.

The view exposes:

```txt
barbershop_id
barber_id
barber_name
start_at
end_at
status
```

It allows only `SELECT` for `anon` and `authenticated`.

It does not expose sensitive client data such as:

```txt
client_name
client_phone
notes
financial_record_id
```

Public booking must continue to use this view for availability instead of reading full `appointments` rows.

## Validated Production Flows

Validated successfully after manual RLS application:

- `/book`
- `/book/gestao-maxima`
- `/book/barbearia-inexistente` remains blocked
- owner login
- barber login
- owner dashboard
- barber dashboard
- public appointment creation
- public booking availability through `public.public_appointment_slots`

## Second Barbershop Validation

Tenant isolation was validated with a fake second barbershop in Supabase.

See `docs/supabase-tenant-isolation-validation.md` for the validation record, including test IDs and observed results.

The validation confirmed:

- Gestão Máxima owner dashboard did not show fake barbershop data.
- `/book/gestao-maxima` did not list fake barbers or services.
- `/book/barbearia-fake-rls` opened the fake barbershop and showed only fake barbershop data.
- `/book/barbearia-inexistente` remained blocked.
- Appointment counts remained isolated: Gestão Máxima with 24 appointments and Barbearia Fake RLS with 1 appointment.

## Public Appointment Entity IDs

The public appointment insert policy was later hardened to require `barbershop_id`, `barber_id`, and `service_id` for new public appointments.

See `docs/public-appointment-entity-id-hardening.md` for the applied-state record and production validation.

## Barbershop ID NOT NULL

`barbershop_id` was later set to `NOT NULL` on `profiles`, `barbers`, `services`, and `appointments`.

See `docs/supabase-barbershop-id-not-null-applied.md` for the applied-state record and production validation.

## Not Applied Yet

These hardening steps remain intentionally pending:

- A real second production barbershop was not created for business use.

The temporary trigger `set_default_appointment_barbershop_id` was later removed and validated in production. See `docs/supabase-appointment-barbershop-trigger-removal-applied.md`.

## Recommended Next Steps

1. Keep the fake second-barbershop validation scenario available before critical RLS changes.
2. Verify barber isolation across multiple barbers whenever barber policies change.
3. Harden public appointment `barber_id` and `service_id` checks further if production data requires stricter public booking constraints.
4. Clean fake validation data when it is no longer needed.
5. Evaluate multi-barbershop dashboards separately if needed.
