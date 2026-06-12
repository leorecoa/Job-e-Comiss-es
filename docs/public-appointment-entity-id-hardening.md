# Public Appointment Entity ID Hardening

## Status

Public appointment entity ID hardening was applied manually in Supabase and validated in production.

This document records the applied production state. It is not an executable migration and does not change application code.

## Objective

The public booking flow already resolves a barbershop, barber, service, and time slot before creating an appointment.

This hardening closes the database-side compatibility gap that previously allowed public appointments where `barber_id` or `service_id` could be `null`.

The current contract is now stricter:

- public booking must send `barbershop_id`
- public booking must send `barber_id`
- public booking must send `service_id`
- Supabase RLS validates that those IDs belong to the same active barbershop context

## Previous State

Before this hardening, the public insert policy preserved compatibility with older public appointment payloads that could omit `barber_id` or `service_id`.

That state was useful during the tenant migration, but it left the database less strict than the frontend/repository contract.

## Current State

The public policy `appointments_public_insert_scheduled` now requires every new anonymous public appointment to include:

```txt
barbershop_id
barber_id
service_id
```

The policy also validates:

```txt
barbershop_id belongs to an active barbershop
barber_id belongs to the same barbershop_id and is active
service_id belongs to the same barbershop_id and is active
status = scheduled
client_name is present
client_phone is present
barber_name is present
service_type is present
start_at is present
end_at is present
end_at > start_at
```

This means public appointment inserts can no longer link a barber or service from a different barbershop, and can no longer create rows without the entity IDs required for future stricter schema constraints.

## Frontend And Repository Alignment

The frontend/repository was already updated to require entity IDs before this database hardening.

Public booking submit is blocked unless the flow has:

```txt
barbershop.id
selectedBarber.id
selectedService.id
selectedSlot
```

The public appointment payload includes:

```txt
barbershopId
barberId
serviceId
barberName
serviceType
serviceValue
commissionRate
startAt
endAt
clientName
clientPhone
status scheduled
```

Repository-level defensive validation rejects public appointment creation when `barbershopId`, `barberId`, or `serviceId` is missing.

## Production Validation

Approximate validation date: 2026-06-12.

### `/book/gestao-maxima`

Expected result:

- public booking creates an appointment normally
- the new appointment includes `barbershop_id`
- the new appointment includes `barber_id`
- the new appointment includes `service_id`

Observed result:

- appointment creation succeeded
- the created appointment included `barbershop_id`, `barber_id`, and `service_id`

### `/book/barbearia-fake-rls`

Expected result:

- public booking opens the fake test barbershop
- public booking creates an appointment normally for that tenant
- the created appointment uses the fake barbershop barber and service IDs

Observed result:

- appointment creation succeeded
- the new fake appointment was created with:

```txt
client_name: kleo
barber_id: 49591f96-fcff-4cc1-b0bf-17d2932251c6
service_id: 4cbf9f97-598a-4574-8c72-95c94ec0aba5
barbershop_id: fc9bb084-eb2c-4fd4-a287-83dbe6bb6ea3
status: scheduled
```

### `/book/barbearia-inexistente`

Expected result:

- invalid public slug remains blocked
- invalid public slug cannot submit or create an appointment

Observed result:

- `/book/barbearia-inexistente` remained blocked
- no appointment was created from the invalid slug

## Technical Conclusion

The public appointment insert path is now aligned across frontend, repository, and Supabase RLS.

The hardening validates the complete tenant entity chain:

```txt
barbershop_id -> active barbershop
barber_id -> active barber in same barbershop_id
service_id -> active service in same barbershop_id
```

This keeps public booking tenant-aware without exposing full appointment reads or sensitive client data.

## Still Pending

These steps remain intentionally pending:

- The temporary trigger `set_default_appointment_barbershop_id` has not been removed.
- A real second production barbershop has not been created.

`barbershop_id NOT NULL` was later applied and validated in production. See `docs/supabase-barbershop-id-not-null-applied.md`.

## Recommended Next Steps

1. Keep the second fake barbershop available for isolation validation.
2. Repeat validation before any critical RLS change.
3. Plan safe removal of the temporary `set_default_appointment_barbershop_id` trigger.
4. Validate that no flow depends on automatic fallback assignment of `barbershop_id`.
5. Keep documenting manual Supabase changes that affect RLS, public booking, or tenant isolation.
