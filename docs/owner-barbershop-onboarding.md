# Owner Barbershop Onboarding

## Objective

Allow an authenticated owner to create a new barbershop without manual Supabase inserts.

This is the first onboarding step for turning the project into a safer self-serve SaaS flow.

## Route

The onboarding flow uses:

```txt
/onboarding
```

The route is intended for authenticated owners that still do not have a `barbershop_id` linked in `profiles`.

## Form Fields

The owner can create a barbershop with:

```txt
name
slug
phone
address
whatsapp
description
```

The public booking link preview is generated from:

```txt
/book/{slug}
```

## Flow

1. User signs in or signs up as `owner`.
2. If the authenticated owner still has no `barbershop_id`, the app redirects to `/onboarding`.
3. The onboarding form normalizes the slug:
   - lowercase
   - accent removal
   - spaces to hyphen
   - invalid characters removed
4. The repository checks whether the slug already exists.
5. The repository creates the new row in `public.barbershops`.
6. The authenticated user's profile is upserted as:

```txt
role = owner
active = true
barbershop_id = new barbershop id
barber_id = null
```

7. After success, the app refreshes the auth session and returns the owner to the main dashboard.

## Security Notes

- The frontend never accepts a free `barbershop_id` from the user.
- The repository always uses the current authenticated user returned by Supabase Auth.
- The flow does not allow creating a barbershop for another user.
- Slug collisions return a friendly validation error before continuing.

## Expected Supabase Permissions

This phase does not apply SQL from the repository.

For the onboarding flow to work in production, Supabase must already allow:

- authenticated insert into `public.barbershops` for the current user flow;
- authenticated upsert/update of the current user's `public.profiles` row as `owner`;
- tenant-aware reads after the `barbershop_id` link is saved.

If any of these permissions still depend on manual setup, document and apply them directly in Supabase, not from this repository change.

## Current Limitations

- No payment or subscription step yet.
- No invite flow for additional barbers yet.
- No global admin flow for provisioning multiple barbershops.
- No automatic setup of default barbers or services in this phase.

## Next Steps

1. Add invite flow for barbers.
2. Add subscription/billing gate for SaaS activation.
3. Add owner onboarding analytics and better completion tracking.
4. Evaluate an admin/global management flow only after the owner self-serve path is stable.
