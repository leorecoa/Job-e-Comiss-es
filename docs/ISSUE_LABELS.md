# Guia de Labels

Use labels para deixar issues e pull requests mais faceis de filtrar e priorizar.

## Tipo

| Label | Quando usar |
| --- | --- |
| `bug` | Erro de comportamento, regressao ou falha visual |
| `enhancement` | Melhoria de produto ou nova funcionalidade |
| `documentation` | README, guias, templates, changelog ou docs tecnicas |
| `maintenance` | Dependencias, CI, configuracoes e organizacao do repo |
| `security` | Vulnerabilidade, hardening ou politica de seguranca |

## Prioridade

| Label | Quando usar |
| --- | --- |
| `priority: high` | Impacta uso principal, dados ou verificacao |
| `priority: medium` | Melhoria relevante, mas sem bloqueio imediato |
| `priority: low` | Ajuste pequeno, cosmetico ou futuro |

## Fluxo

| Label | Quando usar |
| --- | --- |
| `needs-triage` | Ainda precisa de analise |
| `ready` | Escopo claro e pronto para implementacao |
| `blocked` | Depende de decisao, acesso ou outra tarefa |

## Regras simples

- Prefira poucas labels com significado claro.
- Toda issue deve ter pelo menos uma label de tipo.
- Use labels de prioridade apenas quando houver impacto real.
- Remova `needs-triage` quando a issue tiver escopo definido.
