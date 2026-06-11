# Architecture Rules

- Keep the app as a React + TypeScript + Vite SPA.
- Prefer small, isolated modules over broad changes in `App.tsx`.
- Keep domain rules in pure helpers when possible, especially scheduling, conflict checks and formatting.
- Repositories under `services/` own persistence access.
- Components must not call Supabase directly.
- Public booking and internal schedule must share appointment types and scheduling helpers.
- Do not duplicate appointment models or create parallel storage paths.
