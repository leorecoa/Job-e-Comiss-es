# Database Rules

- Supabase access must go through repository files in `services/`.
- Keep `localStorage` fallback for local development.
- Never expose full `appointments` rows to anonymous public booking flows.
- Public booking availability must use `public_appointment_slots`.
- Full `appointments` reads are internal-only and require an authenticated session.
- Do not disable RLS to fix frontend issues.
- Schema changes must be documented in `docs/supabase-schema.sql` or a clearly named migration document.
- Preserve `financialRecordId`/`appointmentId` traceability when completing appointments.
