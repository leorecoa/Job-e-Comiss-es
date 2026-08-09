# Public Booking Abuse Protection

Migration `20260809001100` adds a first anti-abuse layer to `public.create_public_appointment(...)` without changing its signature or public grants.

- The phone is normalized to digits before validation and storage.
- A transaction-level advisory lock serializes calls by `barbershop_id + normalized phone`.
- A successful appointment blocks another public creation for the same tenant and phone for 60 seconds.
- A phone may have at most three future `scheduled` or `confirmed` appointments per tenant.
- `completed`, `cancelled` and `no_show` do not count toward the active limit.
- Internal inserts are unaffected because the checks run only inside the public RPC.

Remote application is manual. Validate the migration and rollout in a controlled environment before applying it to Supabase.

Run `scripts\test-public-booking-concurrency.ps1` with the local stack active to verify that concurrent calls serialize and cannot create a fourth future active appointment.
