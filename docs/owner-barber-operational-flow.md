# Owner And Barber Operational Flow

## Overview

This document describes the current operational SaaS flow for the two internal roles:

- `owner`
- `barber`

It focuses on day-to-day usage of the application after the tenant model, public booking flow, and internal RBAC hardening already in place.

The public customer flow is included only as part of the end-to-end operating cycle.

## Owner flow

The owner is responsible for preparing and operating one barbershop tenant.

Current owner flow:

1. Sign in with an authenticated account.
2. Complete onboarding if the profile still has no `barbershop_id`.
3. Create or confirm the linked barbershop.
4. Configure barbershop data.
5. Configure operating days, opening hours, closing hours, and `slot_step_minutes`.
6. Create at least one barber in the tenant catalog.
7. Create at least one service in the tenant catalog.
8. Review the owner setup checklist.
9. Copy and use the public booking link:

```txt
/book/:slug
```

### Owner prerequisites

The owner internal flow depends on a coherent authenticated profile:

- `role = owner`
- `active = true`
- valid `barbershop_id`

The frontend role value alone is not enough. Internal access still depends on a valid tenant-linked profile and Supabase enforcement.

### Barbershop setup

The owner creates or operates a single tenant-scoped barbershop.

Relevant barbershop data includes:

- `name`
- `slug`
- `phone`
- `address`
- `whatsapp`
- `description`
- branding fields when configured
- `business_hours`
- `slot_step_minutes`

The public booking URL is derived from the saved slug:

```txt
/book/{slug}
```

### Operational configuration

The owner configures:

- active days of the week
- opening time per day
- closing time per day
- slot step interval

These settings are stored on the barbershop tenant and are later consumed by the public booking flow for that same slug.

### Catalog setup

The owner manages the tenant catalog:

- barbers
- services

Catalog writes must stay inside the authenticated owner's `barbershop_id`.

Public booking only uses active catalog rows from the resolved tenant.

### Owner setup checklist

The owner-facing checklist is the current operational readiness surface.

It verifies whether the tenant is ready for public booking, including:

- barbershop loaded
- active barbershop
- public slug available
- business hours configured
- valid `slot_step_minutes`
- at least one active barber
- at least one active service
- public booking link available

Expected final statuses:

- `Booking pronto para receber agendamentos.`
- `Booking incompleto.`

## Linking a barber to a user

The owner can link an existing barber catalog row to an existing authenticated user by email.

This flow uses the reviewed Supabase RPC:

```txt
public.link_barber_profile_by_email(
  p_target_email text,
  p_target_barber_id uuid
)
```

See:

- [barber-profile-linking-rpc.md](./barber-profile-linking-rpc.md)
- [barber-profile-linking-rpc.sql](./barber-profile-linking-rpc.sql)

### Current flow

1. The barber creates an account first.
2. The owner opens the internal panel.
3. The owner selects a barber from the current tenant catalog.
4. The owner enters the barber user's email.
5. The app calls the RPC.
6. The RPC validates:
   - authenticated owner
   - active owner profile
   - owner `barbershop_id`
   - selected `barber_id` inside the same tenant
   - target user existence in `auth.users`
7. The RPC creates or updates `public.profiles` for the target user as:

```txt
role = barber
active = true
barbershop_id = owner tenant
barber_id = selected barber
```

### Expected messages

- user not found
  - `Usuario nao encontrado. Peca para o barbeiro criar uma conta primeiro.`
- barber does not belong to the current barbershop
  - `Este barbeiro nao pertence a sua barbearia.`
- target user already belongs to another tenant
  - `Este usuario ja esta vinculado a outra barbearia.`
- target user is already an owner
  - `Este usuario ja e owner e nao pode ser vinculado como barbeiro.`
- owner tried to reuse the same account as barber
  - `Use uma conta separada para o barbeiro.`
- link success
  - `Barbeiro vinculado com sucesso.`

## Barber flow

The barber operates only after the account is linked to a valid tenant profile.

Required barber profile state:

- `role = barber`
- `active = true`
- valid `barbershop_id`
- valid `barber_id`

### Current barber capabilities

The barber:

- signs in with the linked account
- accesses only the internal barber dashboard
- reads only the barber's own agenda
- creates manual appointments only for the barber's own `barber_id`

The manual appointment flow must use:

- `barbershopId` from the authenticated barber session
- `barberId` from the authenticated barber session
- `barberName` from the resolved current barber

The barber flow must not depend on:

- `ownerBarbershop`
- owner-only catalog context
- textual role alone

If the barber session is incomplete, the expected blocking message is:

```txt
Perfil de barbeiro incompleto. Peca ao owner para vincular sua conta novamente.
```

### Access boundaries

The barber must not:

- create appointments for another barber
- operate in another `barbershop_id`
- access owner-only setup surfaces
- see the owner setup checklist

## Customer flow

The customer uses the public booking route:

```txt
/book/:slug
```

Current customer flow:

1. Open the tenant public booking URL.
2. Resolve the barbershop by slug.
3. Load active barbers for that tenant.
4. Load active services for that tenant.
5. Load public occupied slots through `public.get_public_appointment_slots(uuid)`.
6. Select barber, service, date, and hour.
7. Fill customer data.
8. Submit a validated public appointment payload.

The booking flow validates tenant readiness, selected entities, and slot consistency before insert.

The inserted appointment must land in the correct tenant agenda.

## Operational security rules

Current operating rules:

- `barbershop_id` is required for tenant-scoped operations
- `barber_id` is required for barber-scoped internal operations
- public booking does not have `SELECT` on `appointments`
- production does not use local fallback as an operational substitute when Supabase is unavailable
- role text alone does not authorize internal access
- owner should not need manual SQL for barber linking after the RPC and owner UI are available

Additional enforcement already in the current model:

- public booking is slug-based and tenant-scoped
- public appointment payloads are validated before Supabase insert
- duplicate active slots are blocked by application checks and database index

## End-to-end test checklist

Recommended operational walkthrough:

1. Owner signs in.
2. Owner creates or confirms the tenant.
3. Owner configures barbershop settings.
4. Owner configures business hours and `slot_step_minutes`.
5. Owner creates at least one barber.
6. Owner creates at least one service.
7. Owner reviews the setup checklist.
8. Owner links a barber account by email.
9. Barber signs in with the linked account.
10. Customer opens `/book/:slug`.
11. Customer creates an appointment through public booking.
12. Barber confirms the appointment appears in the barber agenda.
13. Barber creates a manual appointment for the same tenant and own `barber_id`.
14. Owner confirms the barbershop agenda reflects the operation.

## Current limits

Implemented and operational does not mean feature-complete SaaS.

Known limits:

- billing and subscription management are not implemented yet
- formal invitation flow by email is not implemented yet
- global admin and support flows are not implemented yet
- external CAPTCHA or rate limiting can still be added
- observability, alerting, and operational logs can still evolve

These limits should be treated as product and platform follow-up work, not as proof that the current tenant model is incorrect.
