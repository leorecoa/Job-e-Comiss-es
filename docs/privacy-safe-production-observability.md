# Privacy-safe production observability

The client optionally reports unexpected application failures through `@sentry/react`. Monitoring is disabled when `VITE_SENTRY_DSN` is empty, and a reporter failure never blocks application behavior.

## Vercel configuration

Configure these variables manually for the intended Preview and Production scopes:

```text
VITE_SENTRY_DSN=
VITE_APP_ENVIRONMENT=preview|production
```

`VITE_SENTRY_DSN` is a public client configuration value, not an administrative secret. Never add a Sentry auth token or server credential to a `VITE_` variable.

In Vercel project settings, open **Environment Variables** and enable **Automatically expose System Environment Variables**. The Vite build reads `VERCEL_GIT_COMMIT_SHA` directly from the build process and exposes only that SHA as the Sentry release. It also reads `VERCEL_ENV` as an environment fallback. If the SHA is unavailable, events use the safe technical fallback `job-e-comissoes@unversioned`; no branch, author or deployment URL is exposed.

## Privacy controls

- Automatic PII collection is disabled.
- Session Replay, tracing and profiling are not enabled.
- Request bodies, headers, cookies, query strings, users, breadcrumbs and arbitrary contexts are discarded.
- Raw exception messages are replaced before transmission; stack structure is retained for diagnosis.
- No Supabase payload, localStorage or sessionStorage content is reported.
- Correlation IDs are random per error and are not tied to user identity.
- Expected public booking outcomes are not reported as exceptions.

Review Sentry project retention before enabling Production. Keep the minimum retention needed for incident response and periodically audit sampled events against this privacy contract.

## Preview validation

After configuring a Preview deployment, trigger one controlled synthetic Error Boundary failure in Preview only and confirm that the event contains operation, sanitized route, environment, release and correlation ID without personal data. Remove the trigger before merge. Do not deliberately generate errors in Production without an approved incident or rollout review.
