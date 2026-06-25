---
status: completed
title: "consolidate_dashboard.py — módulo hospitalar_sihd + ModuloSIHD expandido"
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 05: consolidate_dashboard.py — módulo hospitalar_sihd + ModuloSIHD expandido

## Overview

Atualiza `consolidate_dashboard.py` para popular `modulos.hospitalar_sihd` com dados reais de `sih_internacoes`: status de importação, KPIs de resumo (total AIH, valor, % UTI, taxa mortalidade) e array `internacoes_por_capitulo_cid`. Também expande a interface `ModuloSIHD` em `types/contrato.ts` com os novos campos opcionais. Após esta task, o badge "SIHD · AIH" no Painel deixa de ser sempre-PENDING.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST adicionar função `fetch_sih_rows(conn, competencia, estabelecimento_id=None)` em `consolidate_dashboard.py`
- MUST chamar `fetch_sih_rows()` dentro de `consolidate_group()` após `fetch_sia_rows()` — não bloquear se SIHD sem dados
- MUST popular `modulos.hospitalar_sihd` com: `status_importacao`, `competencia_sincronizada`, `total_aih`, `total_valor`, `pct_diarias_uti`, `taxa_mortalidade`, `internacoes_por_capitulo_cid`
- MUST retornar `status_importacao = 'PENDING_AIH_FILE'` e `internacoes_por_capitulo_cid = []` quando não há dados SIHD para a competência
- MUST retornar `status_importacao = 'OK'` quando sih_sincronizacoes.status = 'ok' para a competência
- MUST calcular taxa_mortalidade como `SUM(CASE WHEN motivo_saida IN ('31','32') THEN qtd_aih ELSE 0 END) * 100.0 / NULLIF(SUM(qtd_aih), 0)`
- MUST calcular pct_diarias_uti como `SUM(total_diarias_uti) * 100.0 / NULLIF(SUM(total_diarias), 0)`
- MUST construir `internacoes_por_capitulo_cid` agrupando por `LEFT(diag_principal, 1)` com descricao do capítulo CID (CASE WHEN conforme TechSpec sih-aih-schema-for-llm.md § 4.5)
- MUST expandir interface `ModuloSIHD` em `simpa-frontend/src/types/contrato.ts` com campos opcionais conforme TechSpec § Data Models (backward-compatible)
- MUST NOT quebrar fluxo de consolidação SIA ou e-SUS — branch SIHD é aditivo
</requirements>

## Subtasks

- [x] 5.1 Implementar `fetch_sih_rows(conn, competencia, estabelecimento_id)` retornando dicts com KPIs e array CID
- [x] 5.2 Adicionar chamada a `fetch_sih_rows()` em `consolidate_group()` e construir o bloco `hospitalar_sihd` no payload
- [x] 5.3 Expandir `ModuloSIHD` em `types/contrato.ts` com campos opcionais (competencia_sincronizada, total_aih, total_valor, pct_diarias_uti, taxa_mortalidade)
- [x] 5.4 Escrever testes pytest para `fetch_sih_rows()` e testes Vitest para o tipo expandido

## Implementation Details

Ver TechSpec § Integration Points (seção "Consolidation pipeline") para lógica de `fetch_sih_rows()` e como chamar dentro de `consolidate_group()`. Ver `sih-aih-schema-for-llm.md` § 4.5 para a CASE WHEN de capítulo CID.

Padrão de `_build_ambulatorial_sia()` em `consolidate_dashboard.py` / `etl_contract.py` é referência para estrutura de `_build_hospitalar_sihd()`.

A expansão de `ModuloSIHD` deve ser backward-compatible: todos os campos novos como `?` (opcional) para não quebrar dados_consolidados existentes sem SIH.

### Relevant Files

- `consolidate_dashboard.py` — arquivo a modificar; localizar `consolidate_group()` e `_build_ambulatorial_sia()`
- `simpa-frontend/src/types/contrato.ts` — `ModuloSIHD` interface a expandir (linha ~69–72)
- `sih-aih-schema-for-llm.md` — § 4.5 query capítulo CID, § 4.1 KPIs resumo, § 6 cálculos derivados (taxa_mortalidade, pct_diarias_uti)
- `tests/fixtures/contrato_v3_1_0.schema.json` — schema fixture a atualizar com novos campos ModuloSIHD
- `tests/test_integration.py` — padrão de testes Python

### Dependent Files

- `simpa-frontend/src/pages/Painel/` (task_08) — consome ModuloSIHD expandido
- `simpa-frontend/src/utils/painel/moduleStatusView.ts` (task_08) — lê status_importacao

### Related ADRs

- [ADR-001: Dual-Table Hybrid Storage](adrs/adr-001.md) — fetch_sih_rows lê de sih_internacoes (não de s_aih direto)

## Deliverables

- `consolidate_dashboard.py` atualizado com `fetch_sih_rows()` e bloco `hospitalar_sihd`
- `simpa-frontend/src/types/contrato.ts` com `ModuloSIHD` expandido
- `tests/test_consolidate_sihd.py` (pytest)
- `simpa-frontend/src/types/contrato.fixture.test.ts` atualizado (se necessário)

## Tests

- Unit tests:
  - [ ] `fetch_sih_rows(conn, '2025-01', None)` com mock PG retornando 0 rows → `{status_importacao: 'PENDING_AIH_FILE', internacoes_por_capitulo_cid: []}`
  - [ ] `fetch_sih_rows(conn, '2025-01', None)` com mock PG retornando rows válidos → status_importacao = 'OK', total_aih > 0
  - [ ] `taxa_mortalidade` calculado corretamente: qtd_aih com motivo_saida '31'+'32' / total_aih * 100
  - [ ] `pct_diarias_uti` calculado como SUM(total_diarias_uti) / SUM(total_diarias) * 100, protegido com NULLIF
  - [ ] `internacoes_por_capitulo_cid` agrupa por LEFT(diag_principal, 1) e retorna array com capitulo e descricao
  - [ ] `consolidate_group()` com SIHD sem dados não lança exceção — retorna PENDING_AIH_FILE
  - [ ] `ModuloSIHD` em contrato.ts aceita objeto com apenas status_importacao e internacoes_por_capitulo_cid (campos mínimos)
- Integration tests:
  - [ ] Payload completo de `consolidate_group()` inclui chave `modulos.hospitalar_sihd` com estrutura válida
  - [ ] Fixture contrato_v3_1_0 valida payload com campos opcionais de ModuloSIHD
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `python consolidate_dashboard.py --competencia 2025-01 --json-out` inclui `modulos.hospitalar_sihd` no JSON
- Badge "SIHD · AIH" no Painel mostra 'OK' após sync real (verificação manual)
- Consolidação SIA e e-SUS não regridem (testes existentes continuam verdes)
