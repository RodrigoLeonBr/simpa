---
provider: manual
pr:
round: 1
round_created_at: 2026-06-23T00:00:00Z
status: resolved
file: migration_010_sia_producao_cnes.sql
line: 63
severity: high
author: claude-code
provider_ref:
---

# Issue 001: UNIQUE ignora rubrica e quebra grão definido no ADR-002

## Review Comment

O grão oficial da feature foi definido como `competencia × cnes × codigo_sigtap × faixa_etaria × sexo × cbo × rubrica_codigo` (ADR-002 / TechSpec), e a extração em `sync_sia_mysql.py` realmente agrupa por rubrica (`LEFT(prd.PRD_RUB, 4) AS rubrica_codigo`).

Porém a constraint criada em `migration_010_sia_producao_cnes.sql` usa:

`UNIQUE NULLS NOT DISTINCT (sincronizacao_id, cnes, codigo_sigtap, faixa_etaria, sexo, cbo)`

sem `rubrica`. Isso permite colisão quando há duas rubricas diferentes para a mesma combinação de `cnes+sigtap+faixa+sexo+cbo`. Na prática, o INSERT em `sync_sia_mysql.py` pode falhar por violação de unicidade em competências válidas, impedindo a carga completa.

Sugestão: alinhar a chave técnica ao grão funcional, adicionando `rubrica` como coluna relacional em `sia_producao` (em vez de apenas `dados_extras`) e incorporando-a na UNIQUE, ou então revisar a agregação para remover rubrica do grão de forma explícita e documentada (ADR/TechSpec/testes). Hoje há divergência de contrato.

Arquivos também afetados por este mesmo problema de raiz:
- `sync_sia_mysql.py` (query/agregação por `rubrica_codigo`)
- `tests/test_sync_sia_mysql.py` e `tests/test_migration_010.py` (não cobrem o conflito de duplicidade por rubrica)

## Triage

- Decision: `VALID`
- Notes:
  - O problema era real: o grão do ADR-002 inclui rubrica, mas a UNIQUE de `sia_producao` não incluía.
  - Correção aplicada:
    - `migration_010_sia_producao_cnes.sql`: adicionada coluna relacional `rubrica` e UNIQUE atualizada para `(sincronizacao_id, cnes, codigo_sigtap, faixa_etaria, sexo, cbo, rubrica)`.
    - `schema_full.sql`: alinhado ao mesmo grão com coluna `rubrica`.
    - `sync_sia_mysql.py`: grava `rubrica` como coluna relacional no INSERT de `sia_producao` (mantendo `dados_extras` para descrição/código legado).
    - testes ajustados em `tests/test_migration_010.py` e `tests/test_sync_sia_mysql.py`.
  - Resultado: o conflito de unicidade por rubrica deixa de ocorrer para combinações válidas da competência.
