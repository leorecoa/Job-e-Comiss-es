# Arquitetura

Este documento resume a estrutura atual do Job e Comissoes.

## Visao geral

O projeto e uma SPA em React com TypeScript, criada com Vite. A aplicacao roda inteiramente no navegador e usa `localStorage` para persistir dados locais.

## Camadas

| Camada | Responsabilidade |
| --- | --- |
| `App.tsx` | Estado principal, filtros, fluxo de assinatura, handlers e composicao das telas |
| `components/` | Modais, cards, graficos, telas de login/paywall e UI reutilizavel |
| `services/` | Geracao de relatorios em PDF |
| `utils.ts` | Formatacao, datas locais, CSV e regras financeiras compartilhadas |
| `types.ts` | Tipos e enums centrais da aplicacao |

## Persistencia

Os dados sao salvos no navegador usando as chaves:

- `barbearia_profile`
- `barbearia_clients`
- `barbearia_vales`
- `barbearia_settings`

## Regras financeiras

Comissoes sao calculadas em `calculateClientCommission` e preservam o valor salvo no atendimento para evitar mudancas historicas quando a taxa atual e alterada.

Produtos nao geram comissao.

## Relatorios

- CSV e montado em `utils.ts`.
- PDF e gerado sob demanda via import dinamico de `services/pdfService.ts`.

## Limites atuais

- Nao ha backend ou autenticacao real.
- Dados ficam no dispositivo do usuario.
- Backup/restauracao dependem de arquivo JSON local.
- Multi-dispositivo ainda exige exportacao manual de backup.
