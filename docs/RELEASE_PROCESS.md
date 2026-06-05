# Processo de Release

Este checklist ajuda a criar releases publicas consistentes.

## Antes da release

1. Confirme que a `main` esta sincronizada com `origin/main`.
2. Rode a verificacao completa:

```bash
npm run check
npm audit --audit-level=moderate
```

3. Atualize o `CHANGELOG.md`.
4. Confira se a documentacao publica esta atualizada.
5. Abra um pull request pequeno para a release, se houver mudancas de documentacao.

## Criando a tag

Use versionamento semantico:

```text
vMAJOR.MINOR.PATCH
```

Exemplos:

- `v0.1.0`
- `v0.1.1`
- `v0.2.0`

## Notas de release

As notas devem conter:

- Principais mudancas.
- Correcoes importantes.
- Mudancas de seguranca ou dependencias.
- Link para o changelog.

## Depois da release

- Verifique se a pagina da release esta publica.
- Confira se o badge de CI continua verde.
- Abra issues para proximas melhorias.
