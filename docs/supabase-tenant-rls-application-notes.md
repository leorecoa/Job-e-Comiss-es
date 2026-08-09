# Supabase Tenant RLS Application Notes

## Status

`docs/supabase-tenant-rls-plan.sql` is a reviewable plan, not an automatic migration.

The tenant-aware RLS plan was applied manually in Supabase and validated in production.

See `docs/supabase-tenant-rls-applied.md` for the applied-state record.

See `docs/supabase-tenant-isolation-validation.md` for the second fake barbershop validation record.

See `docs/public-appointment-entity-id-hardening.md` for the applied public insert hardening that requires `barbershop_id`, `barber_id`, and `service_id`.

See `docs/supabase-barbershop-id-not-null-applied.md` for the applied `barbershop_id NOT NULL` record.

See `docs/supabase-appointment-barbershop-trigger-removal-applied.md` for the applied temporary trigger removal record.

Keep these notes as a checklist for future re-application, rollback review, or second-barbershop validation.

For new environments, apply the plan first in a controlled Supabase environment with production-like data.

For this historical RLS step, `NOT NULL` and trigger removal were intentionally separate follow-up actions. Both have since been applied and validated.

## Preconditions

Confirm these helpers exist before applying the policy plan:

```sql
private.current_user_role()
private.current_user_barber_id()
private.current_user_barbershop_id()
```

Confirm these tables already have `barbershop_id` populated:

```txt
profiles
barbers
services
appointments
```

Confirm `public.get_public_appointment_slots(uuid)` returns only tenant-scoped occupied slots. The legacy public slots view is not part of the current interface.

## Existing Broad Policies

The current production Supabase state previously included broad role-based policies that did not consistently enforce `barbershop_id`.

The hardened plan removes those policies explicitly by name before recreating tenant-aware policies:

```txt
appointments_authenticated_delete
appointments_authenticated_insert
appointments_authenticated_read
appointments_authenticated_update
appointments_public_insert_scheduled
barbers_owner_manage
barbers_public_read_active
services_owner_manage
services_public_read_active
profiles_insert_own_as_barber
profiles_owner_manage
profiles_owner_read_all
profiles_select_own
barbershops_authenticated_read_own
barbershops_public_read_active
```

During review, confirm there are no additional production policies with broad `owner` access that bypass `barbershop_id = private.current_user_barbershop_id()`.

Owner access in the hardened plan is tenant-scoped, not global.

## Suggested Application Flow

1. Apply the policy plan in a Supabase staging or controlled project.
2. Reload PostgREST schema if needed:

```sql
notify pgrst, 'reload schema';
```

3. Run the application against that environment.
4. Validate all checklist items below before considering production.

## Validation Checklist

### Public Booking

- `/book/:slug` opens the barbershop resolved by the explicit slug.
- `/book` does not assume a hardcoded production barbershop.
- `/book/barbearia-inexistente` shows `Barbearia não encontrada ou indisponível.`
- `/book/barbearia-inexistente` cannot submit or create an appointment.
- Public booking lists only active barbers needed for booking.
- Public booking lists only active services needed for booking.
- Public booking reads occupied slots through `public.get_public_appointment_slots(uuid)`.
- Anonymous/public booking must use `public.get_public_appointment_slots(uuid)`; apply and validate `docs/public-appointment-availability-rpc.sql`.
- Public booking creates an appointment with `status = 'scheduled'`.
- Public booking creates an appointment with a non-null `barbershop_id`.
- Public booking creates an appointment with a non-null `barber_id`.
- Public booking creates an appointment with a non-null `service_id`.
- Public appointment insert rejects a `barber_id` from another barbershop.
- Public appointment insert rejects a `service_id` from another barbershop.

### Owner Login

- Owner can log in.
- Owner can read their own profile.
- Owner can read profiles from their own barbershop.
- Owner cannot read data from another barbershop when a second barbershop exists.
- Owner can read barbers from their own barbershop.
- Owner can manage barbers from their own barbershop.
- Owner can read services from their own barbershop.
- Owner can manage services from their own barbershop.
- Owner can create appointments in their own barbershop.
- Owner can update appointments in their own barbershop.
- Owner can delete appointments in their own barbershop.

### Barber Login

- Barber can log in.
- Barber can read their own profile.
- Barber cannot read profiles from another barbershop.
- Barber can read barbers from their own barbershop.
- Barber cannot manage other barbers.
- Barber can read services from their own barbershop.
- Barber cannot manage services.
- Barber can read appointments from their own barbershop only when `barber_id` matches their profile.
- Barber cannot read another barber's appointments.
- Barber cannot read appointments from another barbershop.
- Barber can create appointments only for their own `barber_id`.
- Barber can update appointments only for their own `barber_id`.
- Barber cannot delete appointments.

### Scheduling And Finance

- Creating an appointment still works from the internal panel.
- Completing an appointment still works.
- Completed appointments still generate the expected financial record.
- Commission values remain correct.
- Existing PDF/CSV reporting flows still work.

### Multi-Tenant Negative Checks

When a second barbershop exists:

- Owner from barbershop A cannot read barbershop B appointments.
- Owner from barbershop A cannot update barbershop B appointments.
- Owner from barbershop A cannot manage barbershop B barbers.
- Owner from barbershop A cannot manage barbershop B services.
- Barber from barbershop A cannot read barbershop B data.
- Barber from barbershop A cannot read another barber's appointments in barbershop A.

The first practical second-barbershop validation was recorded in `docs/supabase-tenant-isolation-validation.md` using `Barbearia Fake RLS`.

## Rollback Notes

If validation fails, revert only the newly applied policies in the controlled environment.

Do not remove the temporary fallback trigger as part of rollback.

Do not change schema nullability as part of rollback.

Capture the failing query, role, user id, profile row, and expected barbershop before changing policies again.
