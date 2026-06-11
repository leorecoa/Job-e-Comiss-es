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
- Em fluxo publico, use `public_appointment_slots` para disponibilidade.
- Leitura completa de `appointments` deve ser restrita ao painel interno autenticado.
- Nao desative RLS para resolver bug de frontend.

## Git

- Commits devem ser pequenos e com escopo claro.
- Use `gh` para abrir PR quando a branch estiver pronta.
- Nao inclua `node_modules`, `dist`, `.env` ou arquivos temporarios.
