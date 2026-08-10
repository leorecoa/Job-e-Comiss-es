# Privacy-safe production observability

The client optionally reports unexpected application failures through `@sentry/react`. Monitoring is disabled when `VITE_SENTRY_DSN` is empty, and a reporter failure never blocks application behavior.

## Vercel configuration

Configure these variables manually for the intended Preview and Production scopes:

```text
VITE_SENTRY_DSN=
VITE_APP_ENVIRONMENT=preview|production
```

`VITE_SENTRY_DSN` is a public client configuration value, not an administrative secret. Never add a Sentry auth token or server credential to a `VITE_` variable. The build exposes the Vercel commit SHA as the Sentry release when `VERCEL_GIT_COMMIT_SHA` is available.

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
