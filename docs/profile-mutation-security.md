# Profile mutation security

`public.profiles` is read-only for direct `authenticated` access. RLS alone was not sufficient because the former self-update policy allowed a barber to replace `barber_id` with another active professional in the same tenant, which could affect the `barber_*_own` appointment policies.

Profile writes now use only controlled `SECURITY DEFINER` paths:

- `private.provision_profile_from_auth_user()` creates the initial unscoped profile from trusted Auth metadata.
- `public.create_owner_barbershop(...)` atomically links an owner to the first tenant.
- `public.link_barber_profile_by_email(...)` lets an authenticated owner link an existing barber account inside the owner's tenant.

Direct clients retain `SELECT` through `profiles_select_own` and `profiles_owner_select_own_barbershop`. They receive no table or column grants for `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER`. The linking RPC uses `search_path=pg_catalog`, fully qualified objects, `auth.uid()`, tenant validation, and row locks. `PUBLIC`, `anon`, and `service_role` cannot execute it; `service_role` retains administrative table access.
