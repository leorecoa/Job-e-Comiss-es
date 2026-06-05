# Contribuindo

Obrigado por considerar contribuir com o Job e Comissoes.

Este projeto usa um fluxo simples: criar uma issue, abrir uma branch pequena, validar localmente e enviar um pull request.

## Ambiente local

```bash
npm install
npm run dev
```

## Antes de abrir PR

Rode o gate completo:

```bash
npm run check
npm audit --audit-level=moderate
```

## Padrao de branch

Use nomes curtos e descritivos:

- `fix/descricao-curta`
- `feat/descricao-curta`
- `docs/descricao-curta`
- `test/descricao-curta`

## Padrao de commit

Prefira commits pequenos com prefixos claros:

- `fix: corrige calculo de comissao`
- `feat: adiciona filtro por barbeiro`
- `docs: atualiza guia de instalacao`
- `test: cobre regras de relatorio`

## Checklist do PR

- A mudanca resolve uma issue ou melhoria clara.
- O PR explica o que mudou e como foi validado.
- `npm run check` passa localmente.
- `npm audit --audit-level=moderate` nao reporta vulnerabilidades.

## Fechando issues

Quando o PR resolver uma issue, inclua no corpo do PR:

```text
Closes #NUMERO_DA_ISSUE
```
