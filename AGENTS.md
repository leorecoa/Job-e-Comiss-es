# AGENTS.md — Job e Comissões

## Project Context

This is a React 19 + TypeScript + Vite app for barbershop scheduling, commissions, financial records and public booking.

The app includes:

- Internal appointment schedule
- Public booking flow
- Commission and financial dashboard
- PDF/CSV export
- Supabase persistence with localStorage fallback
- Supabase Auth and profile-based roles
- Vitest tests
- GitHub Actions CI
- Vercel deployment

## Core Rule

Stability first.

Make small, focused, reviewable changes. Do not perform large refactors unless explicitly requested.

## Required Workflow

Before changing code, inspect the current state:

```bash
npm run check
npm run build
npm audit --audit-level=moderate