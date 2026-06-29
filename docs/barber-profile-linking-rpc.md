# Barber Profile Linking RPC

## Objective

Document a safe manual SQL/RPC path so an authenticated owner can link:

- an existing `public.barbers` row from the owner's tenant
- to an existing authenticated user in `auth.users`

without doing ad hoc SQL updates on `public.profiles`.

This document is review-only. It does not change the app by itself.

## Why this is needed

The current frontend can read the authenticated user's own profile and operate within the resolved tenant, but it cannot safely locate another user by email.

Current limits:

- `public.profiles` does not store `email`
- real user email lives in `auth.users`
- the frontend should not receive broad read access to `auth.users`
- existing tenant-aware profile policies are scoped by `barbershop_id`
- a not-yet-linked barber account is not discoverable from the owner dashboard by email alone

Because of that, a direct frontend-only flow would either fail under RLS or require an unsafe relaxation of access.

## Proposed approach

Use a reviewed `security definer` RPC:

```txt
public.link_barber_profile_by_email(target_email, target_barber_id)
```

The RPC is called by an authenticated owner and performs the sensitive lookup server-side.

See:

- [barber-profile-linking-rpc.sql](./barber-profile-linking-rpc.sql)

## Required behavior

The RPC must:

1. require an authenticated user;
2. require an active owner profile;
3. require the owner to have a valid `barbershop_id`;
4. require the selected barber to belong to the same `barbershop_id`;
5. locate the target user in `auth.users` by normalized email;
6. reject the operation if the target user does not exist;
7. reject linking the current owner user as a barber;
8. reject repurposing an existing `owner` profile;
9. reject linking a profile already attached to another tenant;
10. upsert `public.profiles` for the target user as:

```txt
role = barber
active = true
barbershop_id = owner barbershop_id
barber_id = selected barber id
```

## Why an RPC is preferred here

This keeps the sensitive parts out of the browser:

- no frontend lookup on `auth.users`
- no broad `SELECT` policy on `profiles`
- no tenant-crossing query exposed to the client
- no manual SQL per barber after the RPC exists

It also preserves the existing security model:

- owner actions remain tenant-scoped
- barber access still depends on a coherent profile
- the public booking flow remains unchanged

## SQL summary

The review-only SQL in [barber-profile-linking-rpc.sql](./barber-profile-linking-rpc.sql):

- creates `public.link_barber_profile_by_email(text, uuid)`
- uses `security definer`
- validates the authenticated owner profile first
- validates the selected barber belongs to the owner's tenant
- reads `auth.users` internally to resolve the email
- inserts or updates `public.profiles`
- returns the final linked profile row without exposing `email`
- grants execute only to `authenticated`

The versioned SQL was later corrected to use explicit aliases such as `pr.active` and `select pr.*` to avoid PostgreSQL ambiguity with the `RETURNS TABLE (... active boolean, ...)` output column.

It does **not**:

- change current RLS policies on tables
- expose `auth.users` directly to the frontend
- create a public path
- affect booking or appointment visibility

## Expected frontend flow later

This PR does not implement UI yet, but the intended owner flow is:

1. owner chooses a barber from the current tenant catalog;
2. owner enters the barber user's email;
3. app calls:

```ts
supabase.rpc('link_barber_profile_by_email', {
  p_target_email: email,
  p_target_barber_id: barberId,
});
```

4. app shows a success or friendly error message.

## Suggested user-facing errors

These messages map well to the RPC exceptions:

- `TARGET_USER_NOT_FOUND`
  - "Usuario nao encontrado. Peca para o barbeiro criar uma conta primeiro."
- `BARBER_NOT_IN_TENANT`
  - "Este barbeiro nao pertence a sua barbearia."
- `TARGET_PROFILE_BELONGS_TO_ANOTHER_TENANT`
  - "Este usuario ja esta vinculado a outra barbearia."
- `TARGET_PROFILE_IS_OWNER`
  - "Nao foi possivel vincular este usuario."
- `OWNER_ROLE_REQUIRED`
  - "Apenas owners podem vincular barbeiros."

## Operational validation after manual application

After applying the SQL manually in Supabase, validate:

1. owner from tenant A links a barber from tenant A to an existing barber user email;
2. resulting `profiles` row has:

```txt
role = barber
active = true
barbershop_id = tenant A
barber_id = selected barber from tenant A
```

3. linked barber can sign in and access only:
   - own `barbershop_id`
   - own `barber_id`
4. linked barber cannot read appointments from:
   - another barber in the same tenant
   - another tenant
5. owner cannot link:
   - a barber from another tenant
   - a user already attached to another tenant
   - an owner profile

## Notes and limits

- This document does not claim the RPC is universally safe without review.
- Apply it manually and validate with at least two tenants before using in production.
- If the project later needs invitations, email verification workflows, or owner-managed account creation, those should be designed separately.
- If the project later needs a richer profile directory for owners, prefer a dedicated reviewed backend surface over broad table reads.
