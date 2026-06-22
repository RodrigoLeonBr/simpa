# Idea — Importação SIA Produção (MySQL → PostgreSQL)

**Slug:** `importacao-sia-producao`  
**Date:** 2026-06-21  
**Source:** [`consultasia/docs/sia-schema-for-llm.md`](../../../consultasia/docs/sia-schema-for-llm.md)

## Problem

SIMPA já espelha **cadastros** do MySQL/XAMPP (`prestador`, `procedimento`, `forma`, `cbo`) via `sync_cadastros_mysql.py` e UI em Cadastros. Porém a **produção ambulatorial** (`s_prd`, ~5.9M linhas) ainda não está operacional de ponta a ponta:

- Existe esqueleto (`sync_sia_mysql.py`, `POST /api/sia/sincronizar`, tabelas `sia_sincronizacoes` / `sia_producao`) mas a extração MySQL não segue as regras do schema real (CAST, COLLATE, rubrica).
- Gravação linha-a-linha é inviável em volume municipal.
- Produção é indexada por **nome da unidade** (`re_cnome`), não por CNES/`estabelecimento_id` — frágil para Painel e consolidador.
- Não há UI para o planejamento disparar sync de produção por competência.
- Métricas de apresentado vs aprovado e rubrica (`s_rub`) não entram no espelho PG.

## Opportunity

Com cadastros forma/cbo/procedimento já sincronizados, importar `s_prd` por competência permite:

- Alimentar módulo `ambulatorial_sia` no contrato dashboard v3.1.0.
- Expor `GET /api/sia/producao` com enriquecimento forma/CBO já implementado.
- Base para relatórios MAC (/relatorios) e widgets SIA no Painel.

## MVP intent

1. Operador escolhe **ano/mês** → importa só `prd_cmp` correspondente.
2. **Agregar no MySQL** (GROUP BY) — descartar folha, sequência, flags, APAC, CNS, NF, CID sec/causa (ADR-002).
3. Grão PG: competência × CNES × procedimento × faixa × sexo × CBO × rubrica.
4. Batch insert + `estabelecimento_id`.
5. UI seletor mês + histórico.

## Out of scope (later)

- Sync incremental de 5.9M linhas históricas de uma vez (usar janela N meses).
- SIHD.
- Reescrever Importação e-SUS.
