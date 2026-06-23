# Job e Comissões

Sistema SaaS para barbearias controlarem agendamentos, comissões, serviços, barbeiros, relatórios financeiros e booking público por barbearia.

O projeto nasceu como uma ferramenta de controle financeiro para barbearias e evoluiu para uma aplicação multi-tenant com Supabase, autenticação, roles, RLS, booking público e operação por barbearia.

<p align="left">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=111827" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=111827" />
  <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" />
</p>

---

## Visão geral

O **Job e Comissões** é uma aplicação web para gestão operacional de barbearias.

A plataforma permite registrar atendimentos, calcular comissões, controlar vales, acompanhar vendas de produtos, organizar agenda interna e disponibilizar um booking público para clientes agendarem horários.

Além do uso operacional diário, o projeto também explora conceitos importantes de produto SaaS, como autenticação, papéis de usuário, isolamento por barbearia, políticas RLS, rotas públicas por slug e configuração visual da barbearia.

---

## Problema que resolve

Barbearias pequenas e médias costumam controlar agenda, comissões e fechamento financeiro por planilhas, cadernos ou mensagens de WhatsApp.

Esse fluxo gera problemas como:

- perda de histórico financeiro;
- cálculo manual de comissão;
- dificuldade para conferir atendimentos por barbeiro;
- falta de visão diária, semanal ou mensal;
- risco de agendamento duplicado;
- pouca organização entre serviços, profissionais e clientes;
- ausência de uma página pública simples para agendamento.

O Job e Comissões centraliza esse processo em uma aplicação web com foco em clareza operacional, segurança dos dados e evolução para uso comercial.

---

## Funcionalidades principais

- Cadastro e controle de atendimentos.
- Cálculo de comissão por serviço.
- Registro de vendas de produtos.
- Controle de vales/adiantamentos.
- Dashboard financeiro.
- Agenda interna por barbeiro.
- Status de agendamento.
- Booking público para clientes.
- Gestão de barbeiros.
- Gestão de serviços.
- Gestão de horários comerciais.
- Configuração de identidade visual da barbearia.
- Exportação de relatórios.
- Backup e restauração para ambiente de demonstração/desenvolvimento.
- Autenticação com Supabase Auth.
- Controle de acesso por roles.
- Isolamento multi-tenant por barbearia.
- Policies RLS para proteção dos dados.

---

## Estado atual do produto

- Controle financeiro de atendimentos, produtos, vales e comissões.
- Agenda interna com status de agendamento.
- Booking público por rota `/book`, `/agendar` e slug da barbearia.
- Persistência via Supabase com fallback local para desenvolvimento.
- Supabase Auth para painel interno.
- Roles `owner` e `barber`.
- Isolamento multi-tenant por `barbershop_id`.
- Policies RLS aplicadas para reduzir risco de vazamento entre barbearias.
- Gestão de catálogo, barbeiros, serviços, horários comerciais e branding.

Sem variáveis Supabase configuradas, o app usa `localStorage` como fallback de desenvolvimento e demonstração. Em ambiente configurado, os fluxos principais usam Supabase.

---

## Demonstração

Deploy:

```txt
https://job-e-comiss-es.vercel.app

Rotas principais:

/              Página inicial / painel conforme contexto da aplicação
/book          Booking público
/agendar       Booking público alternativo
/login         Autenticação
/dashboard     Painel interno

Exemplo de fluxo público:

Cliente acessa o link da barbearia
→ escolhe serviço
→ escolhe barbeiro
→ seleciona horário disponível
→ informa nome e telefone
→ confirma o agendamento

Exemplo de fluxo interno:

Owner ou barber acessa o painel
→ visualiza agenda
→ acompanha atendimentos
→ altera status
→ registra conclusão
→ acompanha impacto financeiro e comissões

---

Arquitetura

A aplicação é organizada em camadas para separar interface, regras de negócio, persistência e integrações.

Frontend React
├── Páginas públicas
│   └── Booking / agendamento público
│
├── Painel interno
│   ├── Dashboard
│   ├── Agenda
│   ├── Serviços
│   ├── Barbeiros
│   ├── Configurações
│   └── Relatórios
│
├── Camada de domínio
│   ├── Atendimentos
│   ├── Agendamentos
│   ├── Comissões
│   ├── Produtos
│   ├── Vales
│   └── Barbearias
│
├── Repositórios
│   ├── Supabase
│   └── Fallback local
│
└── Infraestrutura
    ├── Supabase Auth
    ├── Supabase Database
    ├── Supabase RLS
    └── Vercel

Principais decisões arquiteturais:

- React + TypeScript para interface e regras client-side.
- Supabase como backend gerenciado.
- Repositories para separar acesso a dados da interface.
- Fallback local para desenvolvimento e demonstração.
- RLS para reforçar isolamento entre barbearias.
- Rotas públicas separadas do painel autenticado.
- Estrutura preparada para evolução SaaS.

---

Stack

Frontend

- React 19
- TypeScript
- Vite
- TailwindCSS
- Framer Motion
- React Router
- jsPDF

Backend as a Service

- Supabase Auth
- Supabase Database
- Supabase Row Level Security
- Supabase Storage, quando aplicável para branding/imagens

Qualidade

- Vitest
- Testing Library
- TypeScript typecheck
- ESLint
- Build validation
- GitHub Actions

Deploy

- Vercel

---

Segurança e multi-tenant

O projeto utiliza Supabase com políticas de segurança em nível de linha para reduzir o risco de acesso indevido entre barbearias.

Modelo principal de isolamento:

barbershops
├── services
├── barbers
├── appointments
├── profiles
└── financial records

Cada registro operacional relevante é associado a uma barbearia por meio de "barbershop_id".

Estratégia de acesso:

- "owner": acessa e gerencia dados da própria barbearia.
- "barber": acessa dados relacionados à própria barbearia e ao próprio escopo operacional.
- público: acessa apenas informações necessárias para booking público.
- cliente público: consegue criar agendamento sem acessar dados internos da barbearia.

Pontos de segurança trabalhados:

- isolamento por "barbershop_id";
- uso de policies RLS;
- separação entre rotas públicas e painel interno;
- redução de exposição de dados sensíveis no booking público;
- validação de payloads de agendamento;
- controle de status dos agendamentos;
- preservação do vínculo financeiro após conclusão de atendimento.

---

Booking público

O booking público permite que clientes agendem horários sem precisar acessar o painel interno.

Fluxo esperado:

Acessar link público
→ selecionar serviço
→ selecionar barbeiro
→ escolher horário
→ informar dados básicos
→ confirmar agendamento

Recursos do booking:

- rota pública "/book";
- rota alternativa "/agendar";
- suporte a slug da barbearia;
- listagem de serviços ativos;
- listagem de barbeiros ativos;
- horários disponíveis conforme configuração operacional;
- criação de agendamento com status inicial;
- integração com dados da barbearia;
- preservação do isolamento multi-tenant.

O booking público foi pensado para funcionar como porta de entrada comercial da barbearia, reduzindo dependência de mensagens manuais e melhorando a organização da agenda.

---

Painel interno

O painel interno concentra a operação da barbearia.

Áreas principais:

- Dashboard financeiro.
- Agenda por barbeiro.
- Gestão de atendimentos.
- Gestão de comissões.
- Gestão de produtos.
- Gestão de vales.
- Gestão de barbeiros.
- Gestão de serviços.
- Configuração de horários comerciais.
- Configuração de branding.
- Relatórios e exportações.

O painel foi desenvolvido para apoiar o uso diário da barbearia, com foco em velocidade, clareza e controle financeiro.

---

Como rodar localmente

Clone o repositório:

git clone https://github.com/leorecoa/Job-e-Comiss-es.git
cd Job-e-Comiss-es

Instale as dependências:

npm install

Crie o arquivo de ambiente:

cp .env.example .env

Execute o projeto em desenvolvimento:

npm run dev

Acesse no navegador:

http://localhost:5173

Execute as verificações principais:

npm run check

Ou rode separadamente:

npm run test
npm run typecheck
npm run build

---

Configuração Supabase

Para usar Supabase, configure as variáveis no ".env":

VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

A aplicação usa essas variáveis para conectar aos fluxos persistidos em Supabase.

Sem variáveis Supabase configuradas, o app usa "localStorage" como fallback de desenvolvimento e demonstração. Em ambiente configurado, os fluxos principais usam Supabase.

Estrutura esperada

A estrutura de banco inclui entidades como:

- "barbershops"
- "profiles"
- "barbers"
- "services"
- "appointments"
- registros financeiros relacionados à operação

Segurança

Ao configurar Supabase, revise e aplique as policies RLS documentadas no projeto.

A configuração correta de RLS é essencial para:

- impedir vazamento de dados entre barbearias;
- limitar acesso por role;
- permitir booking público apenas com dados necessários;
- proteger dados internos do painel administrativo.

---

Testes e qualidade

O projeto possui validações automatizadas para reduzir regressões em regras de negócio e fluxos principais.

Comando principal:

npm run check

Esse comando deve validar:

- testes;
- typecheck;
- build de produção.

Comandos individuais:

npm run test
npm run typecheck
npm run build

Áreas importantes cobertas ou esperadas nos testes:

- cálculo de comissão;
- controle de vales;
- registros financeiros;
- criação de agendamentos;
- conflitos de horário;
- mapeamento entre app e Supabase;
- regras de status;
- isolamento de dados;
- fluxos públicos e internos.

---

Roadmap

Concluído ou em evolução avançada

- Controle financeiro de atendimentos.
- Gestão de comissões.
- Controle de produtos.
- Controle de vales.
- Dashboard operacional.
- Agenda interna.
- Booking público.
- Supabase Auth.
- Persistência via Supabase.
- Roles "owner" e "barber".
- Isolamento por "barbershop_id".
- Policies RLS.
- Branding por barbearia.
- Gestão de serviços.
- Gestão de barbeiros.
- Gestão de horários comerciais.

Próximos passos

- Refinar UX do booking público.
- Melhorar visual das páginas públicas por barbearia.
- Expandir relatórios gerenciais.
- Adicionar filtros avançados por período, barbeiro e serviço.
- Melhorar onboarding do owner.
- Adicionar métricas de receita, ticket médio e recorrência.
- Preparar fluxo de assinatura/plano.
- Criar painel de administração SaaS.
- Melhorar cobertura de testes end-to-end.
- Documentar melhor setup Supabase em produção.
- Criar seed/demo oficial para avaliação do projeto.

---

Screenshots

Adicione aqui imagens reais do produto.

Sugestão de organização:

### Dashboard

![Dashboard](./docs/screenshots/dashboard.png)

### Agenda

![Agenda](./docs/screenshots/agenda.png)

### Booking público

![Booking público](./docs/screenshots/booking.png)

### Gestão de serviços

![Serviços](./docs/screenshots/services.png)

### Branding da barbearia

![Branding](./docs/screenshots/branding.png)

Caso as imagens estejam em outro caminho, ajuste os links conforme a estrutura do repositório.

---

Licença

Este projeto está disponível sob os termos definidos no arquivo de licença do repositório.

Consulte:

LICENSE

---

Autor

Desenvolvido por Leandro Jessé.

GitHub:

https://github.com/leorecoa
