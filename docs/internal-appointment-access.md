# Internal appointment access

Authenticated clients do not receive direct `SELECT` or `UPDATE` access to `public.appointments`.

`public.get_internal_appointments()` derives the active profile and tenant from `auth.uid()`. Owners receive all appointment columns for their tenant. Barbers receive only their own schedule with `id`, `barbershop_id`, `client_name`, `barber_id`, `barber_name`, `service_id`, `service_type`, `start_at`, `end_at` and `status`; sensitive nullable columns are returned as `NULL` by the fixed PostgreSQL signature and are omitted by the repository mapper.

`public.update_owner_appointment(...)` is the only owner update path. It derives the tenant from the authenticated active owner, validates the selected active barber and service in that tenant, and never accepts `barbershop_id` or `financial_record_id` from the client.

Both RPCs are `SECURITY DEFINER` with `search_path = pg_catalog`. Only `authenticated` receives `EXECUTE`; `PUBLIC`, `anon` and `service_role` do not. Direct authenticated `INSERT` remains governed by the existing tenant-scoped RLS policies, while direct `SELECT`, `UPDATE` and `DELETE` are revoked.

Appointments are preserved as operational history. Owners cancel or change status through `update_owner_appointment(...)`; neither owners nor barbers can physically delete appointments under the current contract.
