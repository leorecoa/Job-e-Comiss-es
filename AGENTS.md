# AGENTS.md - Job e Comissoes

## Contexto

Este repositorio e uma SPA React 19 + TypeScript + Vite para barbearias.

O app inclui:

- Agenda interna de appointments.
- Booking publico em `/book` e `/agendar`.
- Dashboard financeiro, comissoes, vales e relatorios PDF/CSV.
- Supabase persistence com fallback em `localStorage`.
- Supabase Auth com roles `owner` e `barber`.
- Testes com Vitest, CI no GitHub Actions e deploy na Vercel.

## Regra Principal

Estabilidade primeiro.

Faca mudancas pequenas, focadas e revisaveis. Nao faca refatoracoes grandes sem pedido explicito.

## Antes de Alterar

1. Verifique a branch e o status:

```bash
git status --short --branch
```

2. Leia os arquivos relevantes antes de editar.
3. Preserve alteracoes existentes do usuario.
4. Nao toque em financeiro, comissao, PDF/CSV, dashboard ou schema Supabase sem relacao direta com a task.

## Validacao Padrao

Antes de finalizar, rode:

```bash
npm run check
npm run build
npm audit --audit-level=moderate
```

Se algum comando nao puder ser executado, explique o motivo.

## Supabase

- Nunca commite `.env`.
- Use `.env.example` para documentar variaveis.
- Booking publico nao deve ler dados sensiveis de `appointments`.
- Em fluxo publico, use `public.get_public_appointment_slots(uuid)` para disponibilidade ocupada por tenant. Nao consulte `public.appointments` nem `public_appointment_slots` diretamente no frontend publico.
- Leitura completa de `appointments` deve ser restrita ao painel interno autenticado.
- Nao resolva bugs de Supabase desativando RLS, concedendo SELECT publico em `appointments` ou criando fallback global de tenant.
- Para tasks com Supabase, gere SQL review-only; a aplicacao remota e manual.

## SaaS Security

- Preserve tenant isolation.
- Public flows must be scoped by `barbershop_id` or slug-resolved tenant.
- Do not add global tenant fallback.
- Do not grant public SELECT on `appointments`.
- Prefer small review-only SQL files for schema/RLS/security changes.
- Security PRs must be small, focused and auditable, with validation commands and rollout notes.

## Git

- Commits devem ser pequenos e com escopo claro.
- Use `gh` para abrir PR quando a branch estiver pronta.
- Nao inclua `node_modules`, `dist`, `.env` ou arquivos temporarios.
