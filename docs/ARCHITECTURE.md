# Arquitetura

Este documento resume a estrutura atual do Job e Comissoes.

## Visao Geral

O projeto e uma SPA em React 19 + TypeScript + Vite para barbearias. Ele combina agenda interna, booking publico, controle financeiro, comissoes, vales, relatorios PDF/CSV e deploy via Vercel.

## Camadas

| Camada | Responsabilidade |
| --- | --- |
| `App.tsx` | Composicao principal, guards de rota simples, estado de alto nivel e handlers |
| `components/` | Telas, modais, cards, agenda, booking publico e UI reutilizavel |
| `services/` | Repositories Supabase/localStorage, auth e geracao de PDF |
| `scheduling.ts` | Regras puras de appointments, slots, conflitos e WhatsApp manual |
| `utils.ts` | Formatacao, datas locais, CSV e regras financeiras compartilhadas |
| `types.ts` | Tipos e enums centrais |
| `docs/` | Arquitetura, produto, roadmap, Supabase schema e operacao |

## Persistencia

O app usa Supabase quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` existem. Sem essas variaveis, usa fallback em `localStorage`.

Repositories principais:

- `services/appointmentRepository.ts`
- `services/barberRepository.ts`
- `services/serviceRepository.ts`
- `services/authRepository.ts`

## Rotas

O projeto nao usa router pesado. As rotas publicas sao detectadas por `window.location.pathname`.

- `/book` e `/agendar`: booking publico.
- Demais rotas: painel interno.

## Seguranca

- Booking publico nao deve ler linhas completas de `appointments`.
- Disponibilidade publica usa `public_appointment_slots`.
- Painel interno usa Supabase Auth quando configurado.
- Roles atuais: `owner` e `barber`, vindas de `profiles.role` com fallback em metadata.

## Regras Financeiras

Comissoes sao calculadas em `calculateClientCommission`. Produtos nao geram comissao. Appointments concluidos geram lancamento financeiro com rastreabilidade para evitar duplicidade.

## Relatorios

- CSV e montado em `utils.ts`.
- PDF e gerado sob demanda via import dinamico de `services/pdfService.ts`.
