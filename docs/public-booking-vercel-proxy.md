# Public booking via Vercel proxy

## Architecture

The browser uses only these same-origin endpoints:

- `GET /api/public-booking/slots?slug=<public-slug>`
- `POST /api/public-booking/create`

Vercel Functions call narrowly scoped PostgreSQL RPCs with `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. These variables are server-side only, must not use
the `VITE_` prefix, and must be configured manually in Vercel Preview and
Production. Missing configuration fails closed. Payloads, phone numbers, notes,
credentials, and IP headers are neither logged nor persisted by the proxy.

The SPA rewrite remains unchanged. Vercel resolves filesystem Functions under
`api/` before applying rewrites, so API requests are not converted to
`index.html`. Creation is never cached. Successful slot responses use
`public, s-maxage=15, stale-while-revalidate=30`; errors use `no-store`.

## Hobby WAF rule

Configure uma unica regra de rate limiting manualmente no Vercel Firewall:

- Name: `public-booking-create-rate-limit`
- Request Path: exactly `/api/public-booking/create`
- Counting key: IP, managed by Vercel
- Limit: 5 requisicoes por 10 minutos
- Action: Rate Limit, returning HTTP 429
- Environments: Preview for controlled validation, then Production

The WAF does not need method matching because this path is exclusive to the
creation Function, which independently rejects every method except `POST`.
Do not configure this rule from an automated script in this rollout.

## Rollout

1. Configure the two server-side variables in Preview without exposing values.
2. Publish the proxy and frontend to Preview.
3. Confirm slots and creation use only `/api/public-booking/*`.
4. Add the single WAF rule with the Preview environment condition and start with
   observation if the dashboard supports a non-blocking validation mode.
5. Validate HTTP 429 with a small controlled request set and confirm the UI
   keeps its friendly cooldown message.
6. Apply migration 018 manually only after the proxy is healthy. Confirm `anon`
   and `authenticated` cannot execute either legacy public RPC directly.
7. Repeat secrets, deployment, WAF, and migration coordination in Production.

WAF behavior cannot be claimed as validated by unit tests. Preview validation
and the production rule publication are manual Vercel operations.

## Rollback

If the proxy fails before migration 018, roll back the deployment. If migration
018 has already been applied, keep browser roles revoked and roll back to a
known-good proxy deployment; do not silently restore direct `anon` execution.
Disable the WAF rule only when diagnosing a confirmed false positive, with an
approved change window and immediate restoration.

## Accepted residual risk

The Hobby plan supplies only one rate-limiting rule, reserved for creation.
Slots have no endpoint-specific WAF rate limit in this phase. Vercel DDoS
mitigation, same-origin proxying, minimal slot projection, and short CDN cache
reduce that read-only risk. A second slots rule may be added after a plan change
or demonstrated traffic need. The additional 20-per-hour creation rule is also
deferred. PostgreSQL still enforces tenant scope, cooldown, active-booking
limit, advisory locking, time validation, and slot conflict handling.
