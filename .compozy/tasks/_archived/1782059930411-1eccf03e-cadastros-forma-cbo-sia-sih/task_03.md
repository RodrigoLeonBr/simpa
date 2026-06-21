---
status: completed
title: Normalização de códigos forma/cbo e inativação segura
type: backend
complexity: medium
dependencies:
  - task_02
---

# Task 03: Normalização de códigos forma/cbo e inativação segura

## Overview

Garantir qualidade dos dados espelhados por meio de normalização de códigos (`forma` e `cbo`) e proteção contra inativações indevidas por snapshots inválidos.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST canonicalize `codigo_forma` as 6 chars and infer `grupo/subgrupo` when needed
- MUST canonicalize `codigo_cbo` as 6 chars
- MUST handle `prd_cbo` incompatibility (8 chars) by documented truncation/pad rule
- MUST keep empty-snapshot protection before mass inactivation
- MUST log/skip invalid rows instead of crashing full sync
</requirements>

## Subtasks
- [x] 03.1 Implementar `normalize_forma_row`
- [x] 03.2 Implementar `normalize_cbo_row`
- [x] 03.3 Regras de validação e descarte seguro de linhas inválidas
- [x] 03.4 Proteção adicional contra inativação por snapshot inconsistente

## Deliverables
- normalizadores e regras de segurança no `sync_cadastros_mysql.py`
- testes unitários de corner cases

## Tests
- Unit tests:
  - [x] Forma com código curto é normalizada corretamente
  - [x] CBO com espaços/padding é normalizado
  - [x] Linha inválida não derruba o processamento
  - [x] Snapshot vazio não inativa massa
- Integration tests:
  - [x] Comparar contagem pré e pós sync em cenário parcial

## Success Criteria
- Dados persistidos com códigos consistentes e sem inativação indevida
