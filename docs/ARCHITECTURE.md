# Arquitetura

Este documento resume a estrutura atual do Job e Comissoes.

## Visao geral

O projeto e uma SPA React 19 + TypeScript + Vite para operacao de barbearias em modelo SaaS multi-tenant.

O app combina:

- booking publico por `/book/:slug`;
- painel interno para owner;
- painel interno para barber;
- catalogo de barbeiros e servicos por tenant;
- agenda de appointments;
- controle financeiro, comissoes, vales e relatorios PDF/CSV;
- Supabase Auth, Database, Storage e RLS.

## Camadas

| Camada | Responsabilidade |
| --- | --- |
| `App.tsx` | Composicao principal, guards simples de rota, estado de alto nivel e handlers operacionais |
| `components/` | Telas, modais, cards, agenda, booking publico e UI |
| `services/` | Repositories Supabase/localStorage, auth, RPCs e geracao de PDF |
| `scheduling.ts` | Regras puras de appointments, slots, conflitos e validacao de booking |
| `utils.ts` | Formatacao, datas locais, CSV e regras financeiras compartilhadas |
| `types.ts` | Tipos e enums centrais |
| `docs/` | Schema de referencia, RLS, SQL manual, seguranca e operacao |

## Persistencia

O app usa Supabase quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` existem.

Sem Supabase em desenvolvimento, alguns repositories podem usar fallback local em `localStorage` para demo/dev.

Em producao, o fallback local nao deve operar dados reais. O helper em `lib/supabase.ts` calcula:

- `isSupabaseConfigured`
- `isProductionWithoutSupabase`
- `shouldUseLocalFallback`

Quando producao esta sem Supabase configurado, o app deve bloquear operacoes com mensagem de configuracao indisponivel.

Repositories principais:

- `services/appointmentRepository.ts`
- `services/barberRepository.ts`
- `services/serviceRepository.ts`
- `services/barbershopRepository.ts`
- `services/authRepository.ts`
- `services/teamInvitationRepository.ts`

## Rotas

O projeto nao usa router pesado. As rotas sao detectadas por `window.location.pathname`.

- `/book/:slug`: booking publico tenant-aware.
- `/book` e `/agendar`: entrada publica sem slug explicito; nao deve assumir tenant padrao em producao.
- `/onboarding`: criacao/configuracao inicial de barbearia para owner autenticado.
- demais rotas: painel interno owner ou barber conforme sessao.

## Supabase e seguranca

`public.barbershops` e a raiz do tenant.

Tabelas operacionais usam `barbershop_id`:

- `public.profiles`
- `public.barbers`
- `public.services`
- `public.appointments`

Roles atuais:

- `owner`
- `barber`

Regras atuais:

- owner opera somente a propria `barbershop_id`;
- barber opera somente a propria `barbershop_id` e o proprio `barber_id`;
- public booking resolve a barbearia por slug antes de listar catalogo;
- public booking lista apenas barbeiros e servicos ativos do tenant;
- public booking usa RPC `public.get_public_appointment_slots(uuid)` para disponibilidade;
- public booking nao deve ler linhas completas de `public.appointments`;
- public appointment insert nao deve solicitar retorno de linhas sensiveis;
- Vinculo comercial de barber exige convite e aceite explicito por `accept_team_invitation`; veja `docs/team-invitations.md`.

SQL manual de referencia:

```txt
supabase/migrations (sequencia completa 001-034; revisao e aplicacao remota manuais)
```

`docs/supabase-schema.sql` e a referencia de schema base. Ele nao deve recriar policies MVP permissivas. As policies atuais ficam em `docs/supabase-tenant-rls-plan.sql`.

## Regras financeiras

Comissoes sao calculadas em `calculateClientCommission`. Produtos nao geram comissao. Appointments concluidos geram lancamento financeiro com rastreabilidade para evitar duplicidade.

## Relatorios

- CSV e montado em `utils.ts`.
- PDF e gerado sob demanda via import dinamico de `services/pdfService.ts`.

## Limites arquiteturais atuais

- `App.tsx` ainda concentra muita orquestracao de estado e handlers.
- Os SQLs sao aplicados manualmente via docs, nao por migrations automatizadas.
- Observabilidade externa, CAPTCHA/rate limit e billing ainda nao fazem parte da arquitetura atual.
