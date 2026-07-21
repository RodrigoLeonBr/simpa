# Documentação para agentes — SIMPA

Índice modular. O ponto de entrada é **[CLAUDE.md](../../CLAUDE.md)** na raiz.

## Como usar

1. Leia `CLAUDE.md` para contexto, stack e mapa.
2. Abra **apenas** o arquivo do módulo que vai alterar.
3. Para features Compozy arquivadas, leia `.compozy/tasks/_archived/*-<slug>/_techspec.md` e ADRs (ver [compozy.md](compozy.md)).

## Arquivos

| Arquivo | Quando ler |
|---------|------------|
| [backend-api.md](backend-api.md) | Novos endpoints, services, middleware |
| [frontend.md](frontend.md) | Páginas, hooks, componentes, tipos |
| [cadastros.md](cadastros.md) | Estabelecimentos, procedimentos, formas/cbo, enriquecimento, workflows perfil-painel, import de-para e forma-cbo-sia-sih |
| [database.md](database.md) | Migrations, schema, queries |
| [etl-python.md](etl-python.md) | Scripts Python, sync MySQL |
| [docker-env.md](docker-env.md) | Compose, variáveis, portas |
| [restore-backup-e-release-docker.md](restore-backup-e-release-docker.md) | Restaurar `.sql`, migrations pós-restore, gerar/atualizar release Docker sem build no destino |
| [auth-roles.md](auth-roles.md) | Login, JWT, perfis, admin |
| [testing-ci.md](testing-ci.md) | Jest, Vitest, pytest, Playwright, CI |
| [compozy.md](compozy.md) | Workflows PRD/TechSpec/tasks |
| [indicadores-qualidade.md](indicadores-qualidade.md) | Catálogo `/indicadores`, fontes, queries e avaliação no banco |
| [importacao-esus-regras.md](importacao-esus-regras.md) | Fluxo importação e-SUS, preview, de-para, status |
| [importacao-esus-dicionario-dados.md](importacao-esus-dicionario-dados.md) | Tabelas e-SUS, raw JSONB, populacao_cadastrada |
| [sia-atualizacao-cadastro-regras.md](sia-atualizacao-cadastro-regras.md) | Sync cadastros MySQL → PG |
| [sia-atualizacao-cadastro-dicionario-dados.md](sia-atualizacao-cadastro-dicionario-dados.md) | Tabelas estabelecimentos, procedimentos, formas/cbo |
| [sia-importacao-producao-regras.md](sia-importacao-producao-regras.md) | Sync produção SIA, gate 409, status |
| [sia-importacao-producao-dicionario-dados.md](sia-importacao-producao-dicionario-dados.md) | `sia_producao`, sincronizações, enriquecimento |
| [sihd-internacao-dicionario-dados.md](sihd-internacao-dicionario-dados.md) | `sih_aih`, `sih_internacoes`, `sih_procedimentos` — grãos, campos e SQL para Indicadores do Painel |
| [sia-painel-indicadores-proposta.md](sia-painel-indicadores-proposta.md) | Indicadores SIA/OCI/PATE no Painel MAC, metas e periodicidades |

## Manutenção

- **CLAUDE.md**: hub ≤300 linhas — só resumo e links.
- **docs/agent/**: detalhe técnico por domínio.
- Ao adicionar módulo novo: criar arquivo aqui + uma linha no índice de `CLAUDE.md`.
