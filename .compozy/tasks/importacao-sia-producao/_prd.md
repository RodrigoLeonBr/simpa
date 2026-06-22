# PRD — Importação SIA Produção (MySQL/XAMPP)

**Feature:** `importacao-sia-producao`  
**Version:** 1.1  
**Date:** 2026-06-21  
**Status:** Accepted  
**Parent product:** SIMPA — Secretaria de Saúde de Americana/SP  
**Inputs:** [`_idea.md`](_idea.md), [`consultasia/docs/sia-schema-for-llm.md`](../../../consultasia/docs/sia-schema-for-llm.md), estado atual `sync_sia_mysql.py`

---

## Overview

O SIMPA unifica dados de saúde municipal para gestores e planejamento. Os **cadastros SIA** (estabelecimentos, procedimentos, forma, CBO) já são espelhados do MySQL/XAMPP com botão manual em Cadastros. Falta completar o fluxo de **produção ambulatorial**: importar a tabela de fatos `s_prd` por competência, persistir em PostgreSQL e refletir no Painel (módulo `ambulatorial_sia`).

Hoje existe código esqueleto (`sync_sia_mysql.py`, API `/api/sia/sincronizar`, tabelas `sia_sincronizacoes`/`sia_producao`), mas não está alinhado ao schema real de 5.9M registros, não resolve vínculo com estabelecimentos sincronizados, não tem interface operacional e não entrega métricas apresentado/aprovado nem rubrica de financiamento.

**Beneficiários primários:** equipe de Planejamento que dispara sync e valida produção MAC.  
**Beneficiários secundários:** gestores que consomem Painel e futuros relatórios SIA.

---

## Goals

1. **Importar produção SIA por competência** do MySQL (`s_prd`) para PostgreSQL de forma confiável e repetível.
2. **Vincular produção a estabelecimentos** já sincronizados (CNES → `estabelecimentos.codigo_externo`).
3. **Alimentar o consolidador dashboard** para que `ambulatorial_sia` mostre dados reais após sync.
4. **Dar controle manual ao planejamento** — escolher **ano e mês** da importação, ver histórico e status (ok/parcial/erro).
5. **Minimizar volume em PostgreSQL** — totalizar no MySQL campos descartados (folha, sequência, flags, APAC, etc.) antes de gravar.
6. **Preservar gates de qualidade** — testes pytest/Jest/Playwright verdes; sem regressão em cadastros e-SUS.

**MVP = Phase 1.** Sync de uma competência + histórico + Painel reflete produção.

---

## User Stories

### Planejamento / Gestor Secretaria

- Como **analista de planejamento**, quero **escolher ano e mês** (ex.: jan/2025) e importar só aquela competência do MySQL para que o Painel MAC deixe de mostrar “pendente” ou dados vazios.
- Como **analista**, quero que o sistema **some folhas/sequências e descarte campos administrativos** que não usamos, para não inflar o banco PostgreSQL.
- Como **analista**, quero ver quando foi a última sync por competência e quantos registros entraram, para auditar falhas.
- Como **analista**, quero que unidades sejam reconhecidas pelo CNES já cadastrado, não só pelo nome, para filtros do Painel baterem com estabelecimentos.
- Como **analista**, se escolher uma competência **já importada**, quero aviso claro e opção de **reimportar substituindo** os dados, para não duplicar produção no PostgreSQL.
- Como **analista**, quero **reimportar cadastros** (forma, CBO, procedimento, rubrica) do MySQL com um clique, sabendo que o sync atualiza registros existentes sem duplicar.

### Gestor (consumidor)

- Como **gestor**, ao abrir o Painel com competência sincronizada, quero ver produção ambulatorial coerente com o billing municipal.
- Como **gestor**, se o MySQL/XAMPP estiver indisponível, quero mensagem clara em português, não erro técnico.

### Desenvolvedor / Agente

- Como **desenvolvedor**, quero queries de extração documentadas conforme schema SIA (CAST, COLLATE, filtro `prd_cmp`) para evitar timeout e joins silenciosamente vazios.

---

## Core Features

### F1 — Extração MySQL conforme schema SIA (Phase 1, MVP)

- **O quê:** Query de `s_prd` + joins `prestador`, `procedimento`, `cbo`, `s_rub` (LEFT), com CAST em métricas e COLLATE explícito.
- **Por quê:** Schema real exige filtro por competência e tratamento de collation; joins sem COLLATE retornam zeros.
- **Comportamento:** Sync sempre recebe competência `YYYY-MM`; converte para `AAAAMM` no MySQL.

### F2 — Agregação gerencial e persistência enxuta (Phase 1, MVP)

- **O quê:** No MySQL, `GROUP BY` + `SUM(CAST(...))` no grão gerencial; gravar só o agregado em `sia_producao`.
- **Grão:** competência × CNES × procedimento × faixa etária × sexo × CBO × rubrica.
- **Métricas somadas:** quantidade/valor apresentado e aprovado (`PRD_QT_P/A`, `PRD_VL_P/A`).
- **Colunas s_prd excluídas:** folha (`prd_flh`), sequência (`prd_seq`), órgão emissor, flags de erro (`PRD_FL*`), APAC, CNS médico, CNPJ, NF, CID secundário/causa — ver ADR-002.
- **Por quê:** `s_prd` raw tem folha×sequência por linha; agregar reduz PG em ordens de magnitude.
- **Comportamento:** Re-sync da mesma competência substitui dados (idempotente).

### F3 — Resolução estabelecimento_id (Phase 1, MVP)

- **O quê:** Colunas `cnes` e `estabelecimento_id` em `sia_producao`; resolver FK na gravação.
- **Por quê:** Painel filtra por `estabelecimento_id`; nome de unidade varia.
- **Comportamento:** CNES sem match em cadastro → `estabelecimento_id` NULL, mantém nome; log de órfãos no resultado do sync.

### F4 — API, autorização e gate de reimportação (Phase 1, MVP)

- **O quê:** `POST /api/sia/sincronizar` com `{ competencia, reimportar? }`; se competência já importada (status ok/parcial) e `reimportar !== true` → **409** com metadados; com `reimportar: true` → DELETE produção da competência + reimportar.
- **O quê (check):** `GET /api/sia/sincronizacoes/existe?competencia=YYYY-MM` para UI consultar sem gravar.
- **Por quê:** Evitar duplicação acidental e dar controle explícito ao operador (ADR-003).
- **Comportamento:** Sucesso dispara consolidador; resposta JSON com contadores.

### F5 — UI operacional com seletor ano/mês e confirmação (Phase 1, MVP)

- **O quê:** Banner: seletor ano/mês, botão importar, **ConfirmDialog** se competência já existir.
- **Comportamento:** Primeira importação direta; reimportação só após confirmar substituição.

### F8 — Cadastros de referência: forma, CBO, procedimento, rubrica (Phase 1, MVP)

- **O quê:** Garantir reimport MySQL→PG de **forma**, **cbos_sia**, **procedimentos** (já em `sync_cadastros_mysql.py`) e adicionar **rubricas_sia** espelhando `s_rub` (ADR-004).
- **Comportamento cadastros:** UPSERT idempotente — reexecutar sync atualiza sem duplicar linhas.
- **Comportamento produção:** Antes da primeira importação de uma competência, UI sugere “Atualizar cadastros SIA” se última sync cadastros > N dias ou rubricas vazias.

### F6 — Rubricas enriquecidas na API produção (Phase 2)

- **O quê:** Espelhar `s_rub` ou persistir rubrica em coluna/`dados_extras`; enriquecer API produção.
- **Por quê:** KPIs por financiamento (MAC, AB, FAEC) exigem `PRD_RUB`.
- **Comportamento:** Relatórios futuros filtram por rubrica.

### F7 — Sync multi-mês e relatórios (Phase 3)

- **O quê:** `--meses N` via API; página Relatórios SIA básica ou widgets Painel.
- **Por quê:** Análise histórica e ranking prestadores.
- **Comportamento:** Progresso por competência; não bloquear UI.

---

## User Experience

### Fluxo principal — Planejamento

1. Usuário abre **Cadastros** (ou módulo dedicado SIA).
2. Vê última sync de **cadastros** e de **produção** separadamente.
3. Escolhe **ano/mês** no seletor → clica **Importar produção SIA**.
4. UI mostra loading; ao concluir, toast com linhas agregadas gravadas + status.
5. Gestor abre **Painel** na mesma competência → badge SIA “Conectado” / produção populada.

### Requisitos UX

- Copy em português brasileiro.
- Competência no formato `YYYY-MM` consistente com resto do SIMPA.
- `data-testid` para Playwright.
- Não confundir “Atualizar cadastros do SIA” com “Sincronizar produção SIA”.

---

## High-Level Technical Constraints

- MySQL read-only (XAMPP); PostgreSQL como destino.
- Reutilizar `etl_db.py`, padrão spawn Python do backend.
- Compatível com contrato dashboard **v3.1.0** (`modulos.ambulatorial_sia`).
- Cadastros devem estar sincronizados antes da produção (estabelecimentos/procedimentos).
- Performance: sync de uma competência municipal em tempo aceitável (< few minutes target; batch insert).
- Sem alterar sync e-SUS ou Importação de-para.

---

## Non-Goals (Out of Scope)

- Replicar linhas raw de `s_prd` (folha, sequência, flags, APAC, CNS médico, NF, CID sec/causa).
- Importar histórico completo 5.9M sem escolha de competência.
- SIHD / hospitalização.
- Sync automático agendado (cron) no MVP.
- Reescrever módulo Importação e-SUS.
- Alterar roles JWT além de alinhar SIA sync a `requirePlanningStaff`.

---

## Phased Rollout Plan

### Phase 1 — MVP

**Inclui:** F1, F2, F3, F4, F5; migration PG; batch insert; testes; docs agent.

**Critérios de sucesso:**

- Sync `2025-01` (ou competência disponível no XAMPP) grava >0 registros em `sia_producao`.
- `estabelecimento_id` preenchido para CNES conhecidos.
- Painel mostra produção após consolidar.
- UI permite disparar sync; histórico visível.
- pytest + Jest verdes.

### Phase 2 — Rubricas e métricas glosa

**Inclui:** F6; API produção com rubrica; testes KPI glosa.

### Phase 3 — Multi-mês e relatórios

**Inclui:** F7; UI relatórios ou integração widgets Painel SIA.

---

## Success Metrics

| Métrica | Baseline | Alvo MVP |
|---------|----------|----------|
| Produção no Painel após sync | Vazio / PENDING | Dados agregados por competência |
| Tempo sync 1 competência | N/A (não operacional) | < 5 min ambiente dev |
| Linhas PG vs raw MySQL | 1:1 (se existisse) | Redução ≥90% via agregação |
| CNES resolvidos | 0% (só nome) | >90% dos prestadores ativos |
| Testes automatizados | Parcial | 100% pass |

---

## Risks and Mitigations

| Risco | Mitigação |
|-------|-----------|
| Timeout MySQL sem filtro competência | Obrigar `prd_cmp` na query |
| Collation silenciosa | COLLATE explícito conforme schema doc |
| Volume insert lento | `execute_batch` / COPY |
| CNES órfão | LEFT JOIN + contador no JSON resultado |
| MySQL down | Status `MySQL_XAMPP_UNAVAILABLE` + UI degradada |

---

## Architecture Decision Records

- [ADR-001: Sync por competência com agregação no ETL](adrs/adr-001.md)
- [ADR-002: Seleção de campos s_prd e grão de agregação](adrs/adr-002.md)
- [ADR-003: Gate de reimportação por competência](adrs/adr-003.md)
- [ADR-004: Espelho rubricas_sia](adrs/adr-004.md)

---

## Open Questions

1. Competência default na UI: mês anterior ou último do filtro Painel?
2. Phase 2: `PRD_CIDPRI` entra em relatório clínico?
3. Expor preview dry-run na UI ou só CLI `--json-out`?

---

*Próximo passo: TechSpec e tasks via Compozy.*
