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

## Stack

- React 19
- TypeScript
- Vite
- Vitest
- jsPDF + jspdf-autotable
- lucide-react

## Como Rodar

```bash
npm install
npm run dev
```

A aplicacao abre por padrao em `http://localhost:3000`.

## Verificacao

```bash
npm run check
```

Esse comando executa:

- `npm run test`
- `npm run typecheck`
- `npm run build`

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

## Contribuindo

Leia o [guia de contribuicao](CONTRIBUTING.md) antes de abrir uma issue ou pull request.

## Roadmap

- Persistencia em backend com autenticacao real.
- Historico de pagamentos e fechamento por barbeiro.
- Importacao/exportacao de backup com migracoes versionadas.
- Mais testes de UI para fluxos de cadastro e relatorio.
- Deploy publico com ambiente de demonstracao.

## Licenca

MIT
