# Politica de Seguranca

## Versoes suportadas

| Versao | Suporte |
| --- | --- |
| `main` | Sim |
| `v0.1.x` | Sim |

## Reportando vulnerabilidades

Se encontrar uma vulnerabilidade, evite publicar detalhes sensiveis em uma issue aberta.

Envie um resumo privado para o mantenedor ou abra uma issue sem dados exploraveis, descrevendo:

- Area afetada.
- Impacto esperado.
- Passos gerais para reproduzir.
- Versao, commit ou ambiente usado.

## Escopo

Este projeto roda no navegador e usa `localStorage` para persistencia local. Dados inseridos no app ficam no dispositivo do usuario, exceto quando exportados manualmente.

## Boas praticas

- Nao publique backups com dados reais.
- Nao compartilhe relatorios contendo dados de clientes.
- Rode `npm audit --audit-level=moderate` antes de releases.
