# Supabase Tenant RLS Application Notes

## Status

`docs/supabase-tenant-rls-plan.sql` is a reviewable plan, not an automatic migration.

Apply it first in a controlled Supabase environment with production-like data.

Do not apply `NOT NULL` as part of this step.

Do not remove the temporary public appointment fallback trigger:

```txt
public.set_default_appointment_barbershop_id()
set_default_appointment_barbershop_id
```

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

Confirm the public slots view exposes `barbershop_id` as the final view column:

```txt
public.public_appointment_slots
```

Confirm the public slots view still returns occupied slots for anonymous public booking after RLS is applied. If the view uses `security_invoker`, validate the underlying permissions/RLS behavior carefully in the controlled environment before production.

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

- `/book` opens using the `gestao-maxima` fallback.
- `/book/gestao-maxima` opens normally.
- `/book/barbearia-inexistente` shows `Barbearia não encontrada ou indisponível.`
- `/book/barbearia-inexistente` cannot submit or create an appointment.
- Public booking lists only active barbers needed for booking.
- Public booking lists only active services needed for booking.
- Public booking reads occupied slots through `public.public_appointment_slots`.
- Anonymous reads from `public.public_appointment_slots` still work after RLS hardening.
- Public booking creates an appointment with `status = 'scheduled'`.
- Public booking creates an appointment with a non-null `barbershop_id`.

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

## Rollback Notes

If validation fails, revert only the newly applied policies in the controlled environment.

Do not remove the temporary fallback trigger as part of rollback.

Do not change schema nullability as part of rollback.

Capture the failing query, role, user id, profile row, and expected barbershop before changing policies again.
