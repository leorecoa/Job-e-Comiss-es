# Politica de Seguranca

## Versoes suportadas

| Versao | Suporte |
| --- | --- |
| `main` | Sim |
| `v0.9.0-pilot` | Sim |

## Reportando vulnerabilidades

Se encontrar uma vulnerabilidade, evite publicar detalhes sensiveis em uma issue aberta.

Envie um resumo privado para o mantenedor ou abra uma issue sem dados exploraveis, descrevendo:

- area afetada;
- impacto esperado;
- passos gerais para reproduzir;
- versao, commit ou ambiente usado.

## Escopo de seguranca atual

O Job e Comissoes e uma SPA React com Supabase Auth, Database e RLS.

O modelo atual usa `barbershop_id` como chave de isolamento multi-tenant:

- owner opera apenas a propria barbearia;
- barber opera apenas a propria barbearia e o proprio `barber_id`;
- public booking resolve a barbearia por slug em `/book/:slug`;
- public booking nao deve assumir tenant padrao silencioso;
- public booking nao deve fazer `SELECT` publico na tabela completa `appointments`;
- disponibilidade publica deve usar `public.public_appointment_slots`;
- inserts publicos em `appointments` nao devem solicitar retorno de linhas sensiveis;
- a RPC `public.link_barber_profile_by_email` deve ser usada para vincular usuario existente a barbeiro sem expor `auth.users`.

## Supabase

As policies RLS e SQLs manuais precisam estar aplicados no projeto Supabase correto.

Arquivos de referencia:

- `docs/security-model.md`
- `docs/supabase-schema.sql`
- `docs/supabase-tenant-rls-plan.sql`
- `docs/appointments-active-slot-unique-index.sql`
- `docs/barber-profile-linking-rpc.sql`
- `docs/deployment.md`

Nao desative RLS para corrigir bug de frontend.

Nao libere `SELECT` publico em `appointments`; essa tabela contem dados de clientes, como nome, telefone e observacoes.

## Fallback local

O fallback em `localStorage` existe para desenvolvimento ou demonstracao local sem Supabase.

Em producao, o app deve falhar fechado quando `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` nao estiverem configuradas corretamente. Producao nao deve salvar tenant, catalogo, perfis, agenda ou financeiro em `localStorage` por ausencia de Supabase.

## Boas praticas

- Nao publique backups com dados reais.
- Nao compartilhe relatorios contendo dados de clientes.
- Nao commite `.env`.
- Confirme as env vars da Vercel antes de piloto ou deploy.
- Rode `npm audit --audit-level=moderate` antes de releases.
- Rode a bateria de validacao antes de merge:

```bash
npm run test
npm run typecheck
npm run build
npm run validate
npm run check
npm audit --audit-level=moderate
npx playwright test
```

## Limites conhecidos

Este documento nao afirma seguranca absoluta.

Pontos que ainda podem evoluir:

- CAPTCHA/rate limit externo para booking publico;
- observabilidade e auditoria operacional fora do console;
- hardening adicional contra XSS e roubo de sessao em SPA;
- revisao periodica de RLS antes de qualquer mudanca em tenant/RBAC.
