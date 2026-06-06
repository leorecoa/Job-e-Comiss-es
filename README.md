# Job e Comissoes

Aplicacao web para controle diario de atendimentos, vales, vendas de produtos e comissoes em barbearias.

[![CI](https://github.com/leorecoa/Job-e-Comiss-es/actions/workflows/ci.yml/badge.svg)](https://github.com/leorecoa/Job-e-Comiss-es/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)
![Status](https://img.shields.io/badge/status-active-success)

## Visao Geral

O Job e Comissoes nasceu para simplificar a rotina de barbeiros e pequenas barbearias: registrar atendimentos, calcular comissoes, acompanhar retiradas, exportar relatorios e manter backup local dos dados.

O projeto roda como uma SPA em React com persistencia em `localStorage`, geracao de PDF/CSV no navegador e uma camada de testes para as regras financeiras principais.

## Funcionalidades

- Cadastro de atendimentos com barbeiro, cliente, horario, servico, produtos e observacoes.
- Calculo de comissao sobre servicos e adicionais, preservando comissoes salvas historicamente.
- Registro de vales/retiradas por profissional.
- Dashboard diario e mensal com resumo financeiro e desempenho da equipe.
- Exportacao de relatorios em PDF e CSV.
- Backup e restauracao de dados locais com validacao de estrutura.
- Fluxo de trial e planos PRO/VIP.

## Scheduling MVP

O app agora inclui um MVP de agenda interna para barbearias. A agenda permite escolher uma data e um barbeiro, criar horarios futuros, editar agendamentos e acompanhar status como agendado, confirmado, concluido, cancelado e nao compareceu.

Quando um agendamento e marcado como concluido, ele gera um lancamento financeiro no fluxo atual de atendimentos e comissoes, mantendo rastreabilidade por `appointmentId` e evitando duplicidade se o mesmo agendamento for concluido mais de uma vez.

Limitações atuais:

- A visualizacao inicial e diaria por barbeiro, sem calendario semanal complexo.
- Os dados ainda ficam em `localStorage`.
- O WhatsApp e manual via link `wa.me`; nao ha WhatsApp Business API, SMS ou lembrete automatico.
- A agenda ainda nao sincroniza entre dispositivos.

Proximos passos planejados: Supabase, sincronizacao multi-dispositivo, autenticacao real e lembretes automaticos.

## Public Booking MVP

Clientes podem criar agendamentos pela tela publica em `/book` ou `/agendar`. O fluxo permite escolher barbeiro, servico, data e apenas horarios disponiveis, informar nome e WhatsApp, confirmar o horario e ver uma mensagem clara de sucesso.

Os agendamentos criados pela tela publica usam o mesmo modelo `Appointment` e o mesmo storage da agenda interna, entao barbeiros/dono visualizam esses horarios no painel existente.

Limitações atuais:

- A persistencia ainda usa `localStorage`.
- O booking publico funciona bem para demonstracao/local MVP no mesmo navegador/dispositivo.
- Para uso real multi-dispositivo, o proximo passo e Supabase ou backend.
- O WhatsApp continua manual via link `wa.me`, sem API paga ou automacao.

## Supabase Persistence

O projeto possui uma camada de repository para persistencia online com Supabase e fallback automatico para `localStorage`.

Para configurar:

1. Crie um projeto no Supabase.
2. Rode o SQL em [`docs/supabase-schema.sql`](docs/supabase-schema.sql).
3. Copie `.env.example` para `.env`.
4. Preencha:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

5. Rode:

```bash
npm install
npm run dev
```

Se `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nao estiverem configuradas, o app usa `localStorage`, preservando o fluxo local de desenvolvimento.

Com Supabase configurado, a agenda interna e o booking publico passam pela camada de repositories para carregar/criar/atualizar appointments. Barbeiros e servicos ativos tambem podem ser carregados das tabelas `barbers` e `services`.

### Supabase Auth

Quando Supabase esta configurado, o painel interno exige login com email e senha via Supabase Auth. A tela publica `/book` continua aberta para clientes sem login.

Roles iniciais:

- `owner`: acesso ao painel interno como dono.
- `barber`: acesso ao painel interno como barbeiro.

Nesta etapa, a role e lida de `user_metadata.role` e tambem documentada na tabela `profiles` do schema SQL para futura migracao das policies. Sem env vars do Supabase, o app continua usando o login local/trial existente.

Limitacoes atuais de seguranca/RLS:

- O schema documenta uma view publica de slots ocupados sem dados pessoais.
- Para demo/local MVP, RLS pode ficar desativado temporariamente.
- Para producao, o proximo passo e ativar Supabase Auth, roles de dono/barbeiro e policies com isolamento por barbearia.

Proximos passos: auth real, roles, link publico por barbearia, multi-tenant e hardening de RLS.

## Screenshots

As capturas oficiais do projeto devem ficar em [`docs/screenshots`](docs/screenshots).

Checklist recomendado:

- Dashboard diario com resumo financeiro.
- Modal de novo atendimento.
- Resumo mensal por barbeiro.
- Exportacao de relatorio.
- Configuracoes e backup.

> Dica: mantenha screenshots sem dados reais de clientes.

## Stack

- React 19
- TypeScript
- Vite
- Vitest
- jsPDF + jspdf-autotable
- lucide-react

## Requisitos

- Node.js 22 ou superior.
- npm 10 ou superior.
- Git instalado para clonar o repositorio.

## Como Rodar Localmente

```bash
npm install
npm run dev
```

A aplicacao abre por padrao em `http://localhost:3000`.

## Fluxo Recomendado

1. Instale as dependencias com `npm install`.
2. Inicie o ambiente local com `npm run dev`.
3. Faca a alteracao em uma branch pequena.
4. Rode `npm run check` antes de abrir o pull request.
5. Confira se o CI passou no GitHub.

## Verificacao

```bash
npm run check
```

Esse comando executa:

- `npm run test`
- `npm run typecheck`
- `npm run build`

## Troubleshooting

| Problema | Solucao |
| --- | --- |
| `vite` nao reconhecido | Rode `npm install` novamente |
| Porta `3000` ocupada | Encerre o processo usando a porta ou ajuste `server.port` em `vite.config.ts` |
| Build falha apos atualizar dependencias | Remova `node_modules`, rode `npm install` e execute `npm run check` |
| Relatorios PDF nao baixam | Verifique bloqueio de pop-up/download do navegador |

## Scripts

| Comando | Descricao |
| --- | --- |
| `npm run dev` | Inicia o Vite em modo desenvolvimento |
| `npm run test` | Executa testes unitarios com Vitest |
| `npm run typecheck` | Valida TypeScript com `tsc --noEmit` |
| `npm run build` | Gera build de producao |
| `npm run check` | Roda o gate completo de verificacao |
| `npm run preview` | Serve o build localmente |

## Qualidade e Seguranca

- CI configurado com GitHub Actions.
- Testes cobrindo regras de comissao, datas locais e CSV.
- Dependencias auditadas com `npm audit`.
- Gerador de PDF carregado sob demanda para reduzir o bundle inicial.
- Historico de versoes em [CHANGELOG.md](CHANGELOG.md).
- Guia operacional de [backup e restauracao](docs/BACKUP_RESTORE.md).

## Contribuindo

Leia o [guia de contribuicao](CONTRIBUTING.md) antes de abrir uma issue ou pull request.

## Roadmap

Veja o [roadmap do produto](docs/ROADMAP.md) para proximas melhorias e prioridades.

## Licenca

MIT
