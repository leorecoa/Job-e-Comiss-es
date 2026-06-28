# Dependency Audit

## Objective

This process reduces two classes of risk:

- vulnerable dependencies reaching production
- operational regressions introduced by dependency updates

It does not guarantee absolute security. It establishes a repeatable review and validation path before merge.

## Standard command

The baseline audit command is:

```bash
npm audit --audit-level=moderate
```

This is the minimum dependency security gate used in the repository.

## Required validation before merge

Before merging a dependency update or a dependency-related fix, run:

```bash
npm run test
npm run typecheck
npm run build
npm run validate
npm run check
npm audit --audit-level=moderate
```

The dependency change is not ready to merge until this battery passes or an explicit exception is documented.

## Dependabot

Dependabot PRs are not merged only because CI passed.

Each dependency PR should be reviewed with the same validation battery used for manual updates.

For updates with higher regression potential, review upstream release notes or changelog before merge, especially for:

- major updates
- minor updates in sensitive tooling
- security-related transitive updates

Examples of sensitive packages in this project include:

- `@supabase/supabase-js`
- `react`
- `vite`
- `vitest`
- build and test tooling that affects runtime output or CI behavior

## Blocking criteria

Any `moderate`, `high`, or `critical` vulnerability should be treated before merge.

If there is no fix yet, or if the finding is assessed as a false positive, document the justification in the PR before merge.

That justification should state at least:

- affected package
- advisory or audit output
- why the risk is currently accepted or not applicable
- follow-up action, if any

## Risk scope

Frontend dependencies can affect:

- browser runtime behavior
- client-side security properties
- build output
- test confidence
- local and CI tooling

Packages related to Supabase, React, Vite, test runners, and supporting tooling should be updated conservatively.

Even when an update looks small, it can still affect:

- public booking behavior
- auth flows
- build artifacts
- hydration or rendering behavior
- CI scripts

## PR rule

For dependency work:

- use a small PR
- use a dedicated branch
- keep commits normal and scoped
- merge with **Create a merge commit**

Do not use squash or rebase for dependency PRs when the goal is to preserve the update tree and review history.

## Checklist

Before merge:

- run the validation battery
- inspect `git diff --stat`
- review `package.json` and `package-lock.json` if they changed
- confirm `npm audit --audit-level=moderate` passes
- confirm Vercel is ready when the PR deploys
- only then merge

## Related project rules

- keep public booking without public `SELECT` on `appointments`
- review tenant and RBAC implications before merging dependency updates that affect auth, routing, persistence, or Supabase client behavior
- apply manual SQL only when there is an explicit reviewed document in `docs/`
