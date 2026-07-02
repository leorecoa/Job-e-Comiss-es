# Performance Notes

## Status

This document records the performance pass applied after the `v0.9.0-pilot` baseline.

It is a documentation record only. It does not define product behavior, database behavior, RLS, Supabase policies, or deployment configuration.

## Context

The pilot baseline already had the main SaaS flows in place:

- public booking by `/book/:slug`
- owner dashboard
- barber dashboard
- tenant isolation by `barbershop_id`
- fail-closed behavior in production without Supabase
- automated Vitest and Playwright coverage

The performance work focused on initial load and visual readiness without changing those flows.

## Initial Bundle Reduction

Before the optimization pass, the main JavaScript chunk was approximately:

```txt
main chunk: ~738.21 kB
gzip:       ~203.03 kB
```

After lazy loading internal operational surfaces, the main JavaScript chunk was approximately:

```txt
main chunk: ~491.24 kB to ~491.50 kB
gzip:       ~137.66 kB to ~137.79 kB
```

The Vite warning below stopped appearing after the split:

```txt
Some chunks are larger than 500 kB after minification
```

Changed loading behavior:

- dashboards are loaded lazily
- internal modals are loaded lazily
- owner-only operational surfaces are loaded lazily
- barber dashboard is loaded lazily
- report and settings surfaces are loaded only when needed
- `PublicBookingPage` remains a direct import to preserve the public booking entry path

The existing dynamic import for PDF generation was preserved.

## Initial Visual Rendering

The next pass reduced visual work that could dominate LCP:

- splash delay was shortened
- splash transition was shortened
- splash visual weight was reduced
- public booking loading state was made smaller
- booking images use `decoding="async"`
- public booking cover image uses `loading="eager"` and `fetchPriority="high"` when it is the above-the-fold hero image

This pass did not change booking payloads, tenant resolution, owner flow, barber flow, Supabase access, or RLS.

## Lighthouse Result

Latest recorded measurement:

```txt
Tool: Lighthouse 13.2.0
Mode: mobile simulation
URL:  https://job-e-comiss-es.vercel.app/
Date: 2026-07-01
```

Recorded metrics after the performance changes:

```txt
FCP:         ~2.1s
LCP:         ~3.3s
Speed Index: ~2.1s
```

These numbers are not a guarantee. They can vary based on device, network conditions, cache state, Supabase response time, tenant data, and image assets configured for a barbershop.

## Behavior Preserved

The performance pass was intended to preserve behavior for:

- public booking
- owner dashboard
- barber dashboard
- tenant isolation
- Supabase persistence
- fail-closed production behavior without Supabase
- public booking without `SELECT` on full `appointments`

Validation should continue to include:

```bash
npm run test
npm run typecheck
npm run build
npm run validate
npm run check
npm audit --audit-level=moderate
npx playwright test
```

## Remaining Opportunities

Further performance work can be evaluated separately:

- optimize tenant-specific cover images
- add image size guidance for owner-uploaded branding assets
- measure `/book/:slug` on real mobile hardware
- review route-level preloading after more production traffic data exists
- revisit CSS and animation costs if Lighthouse points to render delay again

