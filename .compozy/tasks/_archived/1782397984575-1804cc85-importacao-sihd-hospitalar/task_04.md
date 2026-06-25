---
status: completed
title: "sihProducaoService.js — queries sih_internacoes e sih_procedimentos"
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 04: sihProducaoService.js — queries sih_internacoes e sih_procedimentos

## Overview

Cria `services/sihProducaoService.js` com funções de consulta às tabelas `sih_internacoes` e `sih_procedimentos` do PostgreSQL, suportando filtros por competencia, cnes e estabelecimento_id. Essas funções alimentam os endpoints GET `/api/sih/internacoes` e `/api/sih/procedimentos` criados em task_03, e também são usadas pelo consolidador em task_05 como fonte de KPIs do módulo hospitalar.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implementar `listInternacoes({ competencia, cnes, estabelecimentoId })` que faz SELECT em sih_internacoes com WHERE dinâmico por filtros
- MUST implementar `listProcedimentos({ competencia, cnes, estabelecimentoId })` que faz SELECT em sih_procedimentos com WHERE dinâmico
- MUST aceitar competencia no formato `YYYY-MM` e converter para DATE (`YYYY-MM-01`) no WHERE
- MUST aceitar estabelecimentoId como número inteiro; se presente, adiciona `AND estabelecimento_id = $N`
- MUST fazer JOIN de sih_internacoes com `rubricas_sia` (financiamento 2-char = codigo_rubrica) para retornar descricao_financiamento — LEFT JOIN, nullable
- MUST fazer JOIN de sih_procedimentos com `cbos_sia` (cbo_profissional = codigo_cbo) para descricao_cbo — LEFT JOIN, nullable
- MUST retornar campos em camelCase nas respostas (converter snake_case do PG)
- SHOULD usar `services/db.js` query helper (padrão do projeto)
</requirements>

## Subtasks

- [x] 4.1 Implementar `listInternacoes()` com WHERE dinâmico e JOIN rubricas_sia
- [x] 4.2 Implementar `listProcedimentos()` com WHERE dinâmico e JOIN cbos_sia
- [x] 4.3 Implementar `getSihSummary(competencia, estabelecimentoId)` retornando KPIs agregados (total_aih, total_valor, pct_diarias_uti, taxa_mortalidade) para uso pelo consolidador
- [x] 4.4 Implementar `listInternacoesPorCapituloCid(competencia, estabelecimentoId)` agrupando por LEFT(diag_principal, 1) para `internacoes_por_capitulo_cid`
- [x] 4.5 Escrever testes Jest com mock PG

## Implementation Details

Espelha `services/siaProducaoService.js`. Ver TechSpec § Core Interfaces para assinatura de `listInternacoes` e `listProcedimentos`. `getSihSummary` e `listInternacoesPorCapituloCid` alimentam task_05 (consolidador).

Nota sobre financiamento: `sih_internacoes.financiamento` é 2 chars → JOIN `LEFT JOIN rubricas_sia rs ON si.financiamento = rs.codigo_rubrica` (não LEFT(…,4) como no SIA).

### Relevant Files

- `simpa-backend/src/services/siaProducaoService.js` — modelo de listProducao() com WHERE dinâmico e JOIN dimensões
- `simpa-backend/src/services/db.js` — query helper padrão do projeto
- `migration_013_sih_tabelas.sql` (task_01) — schema das tabelas consultadas
- `migration_011_rubricas_sia.sql` — schema de rubricas_sia (codigo_rubrica 4-char? verificar — para SIHD é 2-char, pode precisar de ajuste)

### Dependent Files

- `simpa-backend/src/routes/sih.js` (task_03) — importa listInternacoes e listProcedimentos
- `consolidate_dashboard.py` (task_05) — usa getSihSummary e listInternacoesPorCapituloCid via PG direto (não via API)

### Related ADRs

- [ADR-001: Dual-Table Hybrid Storage](adrs/adr-001.md) — justifica tabelas separadas consultadas aqui

## Deliverables

- `simpa-backend/src/services/sihProducaoService.js`
- `simpa-backend/tests/sihProducaoService.test.js` (Jest)

## Tests

- Unit tests:
  - [ ] `listInternacoes({ competencia: '2025-01' })` gera WHERE `competencia = '2025-01-01'`
  - [ ] `listInternacoes({ competencia: '2025-01', estabelecimentoId: 5 })` adiciona `AND estabelecimento_id = 5`
  - [ ] `listInternacoes({ cnes: '2058790' })` adiciona `AND cnes = '2058790'`
  - [ ] `listProcedimentos({})` sem filtros retorna rows sem WHERE (ou WHERE 1=1)
  - [ ] `getSihSummary('2025-01', null)` retorna objeto com total_aih, total_valor, pct_diarias_uti, taxa_mortalidade
  - [ ] `listInternacoesPorCapituloCid('2025-01', null)` retorna array com campo capitulo (1 char) e qtd_aih
  - [ ] JOIN rubricas_sia usa `si.financiamento = rs.codigo_rubrica` (2 chars) — não LEFT(financiamento, 4)
- Integration tests:
  - [ ] Filtro por estabelecimento_id = NULL não exclui linhas com estabelecimento_id NULL (LEFT JOIN pattern)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `GET /api/sih/internacoes?competencia=2025-01` retorna array (alimentado por task_03)
- `GET /api/sih/procedimentos?competencia=2025-01` retorna array
