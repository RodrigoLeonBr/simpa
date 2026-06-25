---
status: completed
title: "sync_sih_mysql.py — extração MySQL s_aih + s_aih_pa e batch write PG"
type: backend
complexity: high
dependencies:
  - task_01
---

# Task 02: sync_sih_mysql.py — extração MySQL s_aih + s_aih_pa e batch write PG

## Overview

Cria o script Python `sync_sih_mysql.py` que extrai dados de internações do MySQL (tabelas `s_aih` e `s_aih_pa` do banco `producao`), agrega ao grão gerencial definido no TechSpec, resolve `estabelecimento_id` via mapa CNES→PG, e grava nas tabelas `sih_internacoes` e `sih_procedimentos` em lotes com isolamento por SAVEPOINT. Emite eventos de progresso em formato `SIH_PROGRESS` compatível com o serviço Node.js que fará o spawn.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST usar `etl_db.py` para conexões MySQL e PG — não reimplementar conexão
- MUST extrair `s_aih` com GROUP BY no grão: CNES × PROC_PRINCIPAL × DIAG_PRINCIPAL × COMPLEXIDADE × FINANCIAMENTO × MOTIVO_SAIDA × SEXO_PACIENTE, sem CAST (campos já são int/decimal)
- MUST extrair `s_aih_pa` com GROUP BY no grão: CNES × PROC_DETALHADO × CBO_PROFISSIONAL × FINANCIAMENTO_DETALHE, sem CAST
- MUST usar `COLLATE utf8mb4_unicode_ci` em JOIN prestador (s_aih.CNES = prestador.re_cunid)
- MUST usar três colunas (AIH + CNES + COMPETENCIA) em qualquer JOIN entre s_aih e s_aih_pa conforme TechSpec § Integration Points
- MUST gravar `sih_sincronizacoes` ao início (status 'pendente') e atualizar ao fim (status 'ok'/'parcial'/'erro')
- MUST resolver estabelecimento_id carregando mapa CNES→id de estabelecimentos uma vez por run
- MUST usar `execute_batch` em chunks de 1000 linhas com SAVEPOINT por chunk (padrão de sync_sia_mysql.py)
- MUST emitir eventos JSON em stderr com prefixo `SIH_PROGRESS ` em cada bloco/chunk
- MUST suportar CLI: `--competencia YYYY-MM`, `--pg-write`, `--reimportar`, `--exec-id`, `--json-out`
- MUST reimportar via DELETE FROM sih_internacoes/sih_procedimentos WHERE sincronizacao_id = %s antes de reinserir
- MUST retornar JSON em stdout: {competencia, status, qtd_internacoes, qtd_procedimentos, orphan_cnes, erros, sincronizacao_id, linhas_mysql_raw}
- MUST usar variáveis de ambiente prefixadas `SIH_*` para tabelas e batch size (ver TechSpec § ADR-002)
</requirements>

## Subtasks

- [x] 2.1 Implementar `build_sih_query_internacoes()` com a query GROUP BY de s_aih conforme TechSpec § Integration Points (query exata)
- [x] 2.2 Implementar `build_sih_query_procedimentos()` com a query GROUP BY de s_aih_pa
- [x] 2.3 Implementar `resolver_estabelecimento_id(conn_pg)` → dict[cnes, id]
- [x] 2.4 Implementar `gravar_sih_pg(conn_pg, df_int, df_proc, competencia_date, sincronizacao_id, *, reimportar, batch_size)` com SAVEPOINT e progress events
- [x] 2.5 Implementar `sincronizar(competencia, *, pg_write, reimportar, exec_id)` orquestrando etapas 2.1–2.4
- [x] 2.6 Implementar CLI argparse e bloco `if __name__ == '__main__'`
- [x] 2.7 Escrever testes pytest com mocks de MySQL e PG

## Implementation Details

Espelha estrutura de `sync_sia_mysql.py`. Funções principais: `build_sih_query_internacoes`, `build_sih_query_procedimentos`, `resolver_estabelecimento_id`, `gravar_sih_pg`, `sincronizar`. Ver TechSpec § Core Interfaces para assinaturas exatas.

Diferenças críticas em relação a sync_sia_mysql.py:
- Sem CAST (s_aih usa int/decimal nativo)
- FINANCIAMENTO = 2 chars (não LEFT(…,4))
- Dois DataFrames separados por extração (internacoes + procedimentos)
- DELETE por sincronizacao_id (não por competencia diretamente) em reimport

### Relevant Files

- `sync_sia_mysql.py` — modelo estrutural completo (funções, patterns, progress events)
- `etl_db.py` — `pg_connect()`, `mysql_connect()`, `mysql_available()`
- `sih-aih-schema-for-llm.md` — schema exato de s_aih, s_aih_pa, COLLATE, regras
- `tests/conftest.py` — fixtures de teste
- `tests/test_integration.py` — padrão de testes Python

### Dependent Files

- `services/sih.js` (task_03) — faz spawn deste script e interpreta eventos SIH_PROGRESS
- `migration_013_sih_tabelas.sql` (task_01) — tabelas PG onde este script escreve

### Related ADRs

- [ADR-001: Dual-Table Hybrid Storage](adrs/adr-001.md) — grão de agregação dos dois DataFrames
- [ADR-002: Standalone sync_sih_mysql.py](adrs/adr-002.md) — decisão de script separado, CLI interface, env vars SIH_*

## Deliverables

- `sync_sih_mysql.py` na raiz do projeto
- `tests/test_sync_sih_mysql.py` (pytest)

## Tests

- Unit tests:
  - [ ] `build_sih_query_internacoes()` contém `WHERE sa.COMPETENCIA = %(comp)s`, COUNT(DISTINCT sa.AIH), SUM(sa.DIARIAS), SUM(sa.VALOR_TOTAL_AIH) sem CAST
  - [ ] `build_sih_query_procedimentos()` contém GROUP BY CNES, PROC_DETALHADO, CBO_PROFISSIONAL, FINANCIAMENTO_DETALHE
  - [ ] `build_sih_query_internacoes()` usa `COLLATE utf8mb4_unicode_ci` no JOIN com prestador
  - [ ] `gravar_sih_pg()` com `reimportar=True` executa DELETE FROM sih_internacoes e sih_procedimentos antes de INSERT
  - [ ] `gravar_sih_pg()` com `reimportar=False` não executa DELETE
  - [ ] `sincronizar()` com `pg_write=False` retorna JSON com shape correto sem gravar no PG
  - [ ] `sincronizar()` com competencia inválida (`2025-13`) lança ValueError
  - [ ] FINANCIAMENTO passado como 2 chars sem truncamento
  - [ ] Evento SIH_PROGRESS emitido em stderr a cada bloco de insert
- Integration tests:
  - [ ] `sincronizar('2025-01', pg_write=True)` com MySQL mock: sih_sincronizacoes tem status 'ok' e qtd_internacoes > 0
  - [ ] CNES sem match em estabelecimentos resulta em estabelecimento_id NULL e orphan_cnes > 0 no resultado
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `python sync_sih_mysql.py --competencia 2025-01 --json-out` retorna JSON válido sem PG write
- `python sync_sih_mysql.py --competencia 2025-01 --pg-write` grava em sih_internacoes e sih_procedimentos
- Re-run com `--reimportar` substitui dados sem duplicar
