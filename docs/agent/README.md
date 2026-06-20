# Documentação para agentes — SIMPA

Índice modular. O ponto de entrada é **[CLAUDE.md](../../CLAUDE.md)** na raiz.

## Como usar

1. Leia `CLAUDE.md` para contexto, stack e mapa.
2. Abra **apenas** o arquivo do módulo que vai alterar.
3. Para features Compozy, leia também `.compozy/tasks/<slug>/_techspec.md` e ADRs.

## Arquivos

| Arquivo | Quando ler |
|---------|------------|
| [backend-api.md](backend-api.md) | Novos endpoints, services, middleware |
| [frontend.md](frontend.md) | Páginas, hooks, componentes, tipos |
| [cadastros.md](cadastros.md) | Estabelecimentos, procedimentos, enriquecimento, workflow perfil-painel |
| [database.md](database.md) | Migrations, schema, queries |
| [etl-python.md](etl-python.md) | Scripts Python, sync MySQL |
| [docker-env.md](docker-env.md) | Compose, variáveis, portas |
| [auth-roles.md](auth-roles.md) | Login, JWT, perfis, admin |
| [testing-ci.md](testing-ci.md) | Jest, Vitest, pytest, Playwright, CI |
| [compozy.md](compozy.md) | Workflows PRD/TechSpec/tasks |

## Manutenção

- **CLAUDE.md**: hub ≤300 linhas — só resumo e links.
- **docs/agent/**: detalhe técnico por domínio.
- Ao adicionar módulo novo: criar arquivo aqui + uma linha no índice de `CLAUDE.md`.
