# Job e Comissões

Gestão para barbearias com agenda online, controle de atendimentos, comissões, relatórios financeiros e persistência com Supabase.

O projeto começou como uma aplicação local para controle diário de barbearia e evoluiu para um MVP SaaS com booking público, painel interno, autenticação, papéis de acesso e isolamento multi-tenant por barbearia.

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=111827)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-3FCF8E?style=for-the-badge&logo=supabase&logoColor=111827)
![Vitest](https://img.shields.io/badge/Vitest-Tested-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)

## Visão geral

Job e Comissões é uma aplicação web para pequenas barbearias que precisam centralizar:

- agendamento público de clientes;
- agenda interna por barbeiro;
- controle de atendimentos;
- cálculo de comissões;
- registro de vales e retiradas;
- relatórios em PDF e CSV;
- persistência online com Supabase;
- fallback local para desenvolvimento e demonstração.

O projeto roda como uma SPA em React, TypeScript e Vite. A camada de dados usa Supabase quando as variáveis de ambiente estão configuradas e mantém fallback em `localStorage` para fluxo local.

## Funcionalidades atuais

### Agenda e booking público

- Tela pública de agendamento em `/book` e `/agendar`.
- Suporte a booking por slug de barbearia, como `/book/gestao-maxima`.
- Seleção de barbeiro, serviço, data e horário disponível.
- Criação de agendamento público com vínculo obrigatório a:
  - `barbershop_id`
  - `barber_id`
  - `service_id`
- Validação para impedir que barbeiro e serviço de barbearias diferentes sejam usados no mesmo agendamento.
- Link manual para WhatsApp via `wa.me`.

### Painel interno

- Agenda diária por barbeiro.
- Status de agendamento:
  - agendado;
  - confirmado;
  - concluído;
  - cancelado;
  - não compareceu.
- Conclusão de agendamento com geração de lançamento financeiro.
- Rastreabilidade entre agendamento e registro financeiro.
- Prevenção de duplicidade ao concluir o mesmo agendamento mais de uma vez.

### Financeiro e comissões

- Cadastro de atendimentos.
- Serviços, produtos adicionais e observações.
- Cálculo de comissão sobre serviços e adicionais.
- Preservação histórica de comissões já salvas.
- Registro de vales e retiradas por profissional.
- Dashboard diário e mensal.
- Exportação de relatórios em PDF e CSV.
- Backup e restauração de dados locais.

### Supabase, autenticação e multi-tenant

- Persistência online com Supabase.
- Fallback automático para `localStorage` quando Supabase não está configurado.
- Supabase Auth para painel interno.
- Papéis iniciais:
  - `owner`
  - `barber`
- Modelo tenant-aware por `barbershop_id`.
- RLS aplicado para isolamento entre barbearias.
- Owner limitado aos dados da própria barbearia.
- Barber limitado à própria barbearia e ao próprio vínculo de barbeiro.
- Booking público preservado sem expor dados sensíveis.
- Bloqueio de slug inválido.

## Estado atual do projeto

O projeto está em fase de MVP comercial técnico.

Já existe uma base funcional para demonstrar:

- agendamento público;
- agenda interna;
- fluxo financeiro;
- Supabase Auth;
- persistência em banco;
- isolamento por barbearia;
- regras iniciais de segurança com RLS;
- validações automatizadas.

Ainda não é tratado como SaaS comercial final. Os próximos passos envolvem refinamento de produto, testes e2e, limpeza de dados de demonstração, melhorias no dashboard multi-barbearia e preparação para uso real por múltiplas barbearias.

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Supabase Auth
- Supabase Postgres
- Row Level Security
- Vitest
- jsPDF
- jspdf-autotable
- lucide-react

## Estrutura principal

```txt
.
├── App.tsx
├── components/
├── services/
├── lib/
├── docs/
├── scripts/
├── public/
├── scheduling.ts
├── types.ts
├── utils.ts
├── package.json
└── README.md
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

Nesta etapa, a role principal e lida da tabela `profiles`; `user_metadata.role` fica apenas como fallback durante a transicao. Sem env vars do Supabase, o app continua usando o login local/trial existente.

Limitacoes atuais de seguranca/RLS:

- O schema inclui uma view publica de slots ocupados sem dados pessoais.
- O schema inclui policies iniciais para `profiles`, `barbers`, `services` e `appointments`.
- Para producao, o proximo passo e isolamento por barbearia/tenant e hardening completo das policies.

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
