# Changelog

Todas as mudancas relevantes deste projeto serao documentadas aqui.

O formato segue uma versao simples inspirada em Keep a Changelog, com versoes baseadas em tags do GitHub.

## [v0.1.0] - 2026-06-04

### Added

- Fluxo de cadastro de atendimentos, produtos e vales.
- Dashboard diario e resumo mensal.
- Exportacao de relatorios em PDF e CSV.
- Backup e restauracao de dados locais.
- Testes unitarios para regras financeiras, datas locais e CSV.
- CI com GitHub Actions.
- Templates de issue e pull request.
- Guia de contribuicao.

### Changed

- README reestruturado com stack, scripts, verificacao e roadmap.
- Gerador de PDF carregado sob demanda para reduzir o bundle inicial.
- Dependencias atualizadas e auditadas.

### Fixed

- Preservacao de comissao manual igual a zero.
- Filtro de relatorios por data local.
- Validacao de valores financeiros negativos ou invalidos.
- Validacao basica de backup antes de restaurar dados.

[v0.1.0]: https://github.com/leorecoa/Job-e-Comiss-es/releases/tag/v0.1.0
