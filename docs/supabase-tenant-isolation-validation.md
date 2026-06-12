# Supabase Tenant Isolation Validation

## Objective

Record the practical validation of multi-tenant isolation by `barbershop_id` using a second fake barbershop in Supabase.

This document is evidence of manual validation. It is not an executable migration and does not change production code.

## Validation Date

Approximate validation date: 2026-06-12.

## Test Data

### Main Barbershop

```txt
name: Gestão Máxima
appointments: 24
```

### Fake Test Barbershop

```txt
name: Barbearia Fake RLS
slug: barbearia-fake-rls
id: fc9bb084-eb2c-4fd4-a287-83dbe6bb6ea3
appointments: 1
```

### Fake Barber

```txt
name: Barbeiro Fake RLS
id: 49591f96-fcff-4cc1-b0bf-17d2932251c6
barbershop_id: fc9bb084-eb2c-4fd4-a287-83dbe6bb6ea3
```

### Fake Service

```txt
name: Serviço Fake RLS
id: 4cbf9f97-598a-4574-8c72-95c94ec0aba5
barbershop_id: fc9bb084-eb2c-4fd4-a287-83dbe6bb6ea3
```

### Fake Appointment

```txt
client_name: Cliente Fake RLS
barber_name: Barbeiro Fake RLS
service_type: Serviço Fake RLS
barbershop_id: fc9bb084-eb2c-4fd4-a287-83dbe6bb6ea3
status: scheduled
```

## Tested Flows

### Owner Logged Into Gestão Máxima

Expected result:

- `Cliente Fake RLS` must not appear.
- `Barbeiro Fake RLS` must not appear.
- `Serviço Fake RLS` must not appear.

Observed result:

- `Cliente Fake RLS` did not appear.
- `Barbeiro Fake RLS` did not appear.
- `Serviço Fake RLS` did not appear.

### Anonymous `/book/gestao-maxima`

Expected result:

- Must not list `Barbeiro Fake RLS`.
- Must not list `Serviço Fake RLS`.
- Must not mix fake barbershop data with Gestão Máxima data.

Observed result:

- `Barbeiro Fake RLS` was not listed.
- `Serviço Fake RLS` was not listed.
- Gestão Máxima data was not mixed with the fake barbershop.

### Anonymous `/book/barbearia-fake-rls`

Expected result:

- Must open the fake barbershop.
- Must show only data linked to `barbearia-fake-rls`.

Observed result:

- The fake barbershop opened correctly.
- Only data linked to the fake barbershop was shown.

### Invalid Public Slug

Expected result:

- `/book/barbearia-inexistente` remains blocked.

Observed result:

- `/book/barbearia-inexistente` remained blocked.

## Supabase Confirmation Query

The confirmation query returned:

```txt
Barbearia Fake RLS | 1 appointment
Gestão Máxima      | 24 appointments
```

## Public Slots View

`public.public_appointment_slots` remains the public read surface for booking availability.

It exposes the fields needed by public booking:

```txt
barbershop_id
barber_id
barber_name
start_at
end_at
status
```

It allows only `SELECT` for `anon` and `authenticated`.

It does not expose sensitive appointment fields such as `client_name` or `client_phone`.

## Technical Conclusion

Tenant isolation by `barbershop_id` was validated in a real Supabase scenario with a second fake barbershop.

Gestão Máxima and Barbearia Fake RLS did not mix appointments, barbers, or services in the tested owner and public booking flows.

The fake barbershop should remain test-only data and should not be treated as a production business tenant.

## Related Public Insert Hardening

After this isolation validation, public appointment inserts were hardened to require `barbershop_id`, `barber_id`, and `service_id`.

See `docs/public-appointment-entity-id-hardening.md` for the applied-state record and production validation.

## Related NOT NULL Enforcement

After public insert hardening, `barbershop_id` was set to `NOT NULL` on the main tenant tables.

See `docs/supabase-barbershop-id-not-null-applied.md` for the applied-state record and production validation.

## Still Pending

- The temporary trigger `set_default_appointment_barbershop_id` has not been removed.
- No real second production barbershop has been created.

## Recommended Next Steps

1. Keep a second-barbershop validation scenario before any critical RLS change.
2. Harden public appointment inserts to require `barber_id` and `service_id` when production data is ready for that constraint.
3. Validate that no flow depends on automatic fallback assignment of `barbershop_id`.
4. Remove the temporary `set_default_appointment_barbershop_id` trigger in a separate change after stabilization.
