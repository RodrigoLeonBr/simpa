# Painel de Indicadores (`/indicadores`) — Catálogo, Fontes e Avaliação no Banco

Documento operacional para administradores, desenvolvedores e LLMs. Descreve a rota **`/indicadores`** (Componente Qualidade APS + IGM SUS Paulista), distinta de **`/cadastros/indicadores-painel`** (widgets dinâmicos do Painel).

**Relacionados:** [importacao-esus-dicionario-dados.md](importacao-esus-dicionario-dados.md) · [importacao-esus-regras.md](importacao-esus-regras.md) · [frontend.md](frontend.md#indicadores) · [etl-python.md](etl-python.md)

---

## 1) Visão geral

| Aspecto | Detalhe |
|---------|---------|
| Rota UI | `/indicadores` → `IndicadoresPage` |
| API | `GET /api/v1/dashboard?competencia=YYYY-MM` (+ filtros unidade/equipe) |
| Contrato | `ContratoDashboard.indicadores_qualidade[]` (`versao_schema: 3.1.0`) |
| Catálogo canônico | `INDICADORES_QUALIDADE_CATALOG` em `etl_contract.py` (13 indicadores) |
| Persistência | `dados_consolidados.dados_conteudo` (JSONB) |
| Metas pactuadas (futuro) | tabelas `indicadores` + `metas_financiamento` (migration 003) |

### Fluxo de dados

```
CSV e-SUS (+ cadastro individual) ──► esus_cargas / esus_indicadores_raw / populacao_cadastrada
                                              │
                                              ▼
                              consolidate_dashboard.py + etl_contract.build_payload()
                                              │
                                              ▼
                              dados_consolidados.dados_conteudo.indicadores_qualidade[]
                                              │
                                              ▼
                              dashboardService.js ──► IndicadoresPage (React)
```

### O que a tela mostra hoje

- **Catálogo lateral:** lista os 13 indicadores com código, nome curto e valor executado formatado.
- **Detalhe:** numerador, denominador, fonte, periodicidade, meta e status (atingida / próxima / abaixo / **não apurado**).
- **Série histórica (12 meses):** usa `indicador.historico` quando existir; **senão gera série sintética** a partir de `exec` (`qualidadeView.ts`).
- **Comparação entre unidades:** usa `indicador.porUnidade` quando existir; **senão distribui valores sintéticos** entre unidades APS.

**Importante:** com `exec = null` e `meta = null` (estado atual no banco), a UI exibe "—" e status **Não apurado**. Gráficos e ranking por unidade podem estar vazios ou sintéticos.

---

## 2) Contrato `IndicadorQualidade`

Tipo em `simpa-frontend/src/types/contrato.ts`:

| Campo | Tipo | Uso |
|-------|------|-----|
| `cod` | string | Código estável (ex.: `C1`, `B4`, `IGM-PN`) |
| `nomeCurto` | string | Label no catálogo |
| `nome` | string | Título longo |
| `categoria` | string | `Componente Qualidade APS` ou `IGM SUS Paulista` |
| `meta` | number \| null | Meta regulamentada (proporção 0–1, ex.: 0.50 = 50%) |
| `exec` | number \| null | Valor executado (mesma escala que `meta`) |
| `num` | string | Numerador exibido (número ou `"—"`) |
| `den` | string \| number | Denominador exibido (número ou `"—"`) |
| `fonte` | string | Relatório e-SUS / sistema de origem |
| `periodicidade` | string | Quadrimestral ou Mensal |
| `porUnidade?` | array | Drill-down real por unidade |
| `historico?` | array | Série real `{ competencia, exec }` |
| `den_nota?` | string | Apenas B4 — ressalva de aproximação |

Geração em `_build_indicadores_qualidade()` (`etl_contract.py`):

- Sempre emite os **13** itens do catálogo.
- `meta`, `exec` e `num` ficam **`null` / `"—"`** — **ainda não calculados**.
- `den` vem de `_denominadores(pop_row)` quando há cadastro individual; caso contrário `"—"`.

---

## 3) Catálogo completo (13 indicadores)

Origem normativa: Componente Qualidade da APS (Portarias MS — fórmulas **devem ser confirmadas** com a Secretaria antes de travar em código). Nomes abaixo seguem o catálogo SIMPA.

### Legenda de status no banco (avaliação 2026-06-24, ambiente Docker local)

| Símbolo | Significado |
|---------|-------------|
| ✅ | Dado bruto disponível no PG para calcular |
| ⚠️ | Parcial (denominador ou proxy; numerador ausente) |
| ❌ | Sem carga e-SUS / sem implementação |

**Resumo global (competência 2026-01):**

| Métrica | Valor |
|---------|-------|
| Linhas `dados_consolidados` | 28 (todas com FK) |
| Snapshots `populacao_cadastrada` | 26 |
| Soma `cidadaos_ativos` | 90.145 |
| Indicadores com `exec` preenchido | **0 / 364** (28 × 13) |
| Indicadores com `den` numérico | **~24 unidades × 6 códigos** (C1, B4, IGM-*) |
| `indicadores` / `metas_financiamento` | **0 registros** (tabelas vazias) |
| `atendimento_odontologico` importado | **0 cargas** |
| `atendimento_individual` importado | **1 carga** (2026-05, unidade teste) |

---

### C1 — Acesso e Vínculo

| | |
|--|--|
| **Nome curto** | Acesso e Vínculo |
| **Categoria** | Componente Qualidade APS |
| **Periodicidade** | Quadrimestral |
| **Fonte declarada** | Relatório de Atendimento Individual |
| **Intento regulatório** | Proporção de 1ªs consultas **programadas** vs. demanda espontânea (acesso/vínculo na APS). |
| **Status SIMPA** | ⚠️ Denominador populacional OK; numerador/exec/meta não calculados. |
| **Denominador hoje** | `populacao_cadastrada.cidadaos_ativos` por `(competencia, estabelecimento_id)` |
| **Numerador (proposto)** | Atendimentos classificados como consulta programada / cuidado continuado no CSV de atendimento individual. |

**Tabelas:** `esus_cargas`, `esus_indicadores_raw`, `populacao_cadastrada`, `dados_consolidados`.

**Query — denominador (já implementado no ETL):**

```sql
SELECT cidadaos_ativos
FROM populacao_cadastrada
WHERE competencia = DATE '2026-01-01'
  AND estabelecimento_id = :estabelecimento_id;
```

**Query — numerador candidato (requer importação `atendimento_individual` por unidade/equipe):**

```sql
SELECT COALESCE(SUM((r.valores->>'quantidade')::bigint), 0) AS numerador
FROM esus_cargas c
JOIN esus_indicadores_raw r ON r.carga_id = c.id
WHERE c.competencia = DATE '2026-01-01'
  AND c.estabelecimento_id = :estabelecimento_id
  AND c.equipe_id = :equipe_id
  AND c.tipo_relatorio = 'atendimento_individual'
  AND r.secao = 'Tipo de atendimento'
  AND r.descricao IN (
    'Consulta agendada programada / Cuidado continuado',
    'Consulta agendada'
  );
```

**Query — proxy espontânea (denominador alternativo da razão, não populacional):**

```sql
SELECT COALESCE(SUM((r.valores->>'quantidade')::bigint), 0)
FROM esus_cargas c
JOIN esus_indicadores_raw r ON r.carga_id = c.id
WHERE c.competencia = DATE '2026-01-01'
  AND c.estabelecimento_id = :estabelecimento_id
  AND c.tipo_relatorio = 'atendimento_individual'
  AND r.secao = 'Tipo de atendimento'
  AND r.descricao IN ('Consulta no dia', 'Atendimento de urgência');
```

**Cálculo proposto:** `exec = numerador / (numerador + demanda_espontanea)` ou fórmula oficial MS vigente; persistir `num`, `den`, `exec`, `meta` (de `metas_financiamento`).

**Gap no banco:** quase nenhuma carga `atendimento_individual` em 2026-01 (apenas 1 carga em 2026-05 em unidade de teste). **Importar relatórios por equipe** antes de apurar C1.

---

### B1 — 1ª consulta odontológica programada

| | |
|--|--|
| **Fonte declarada** | Relatório de Atendimento Odontológico |
| **Intento** | Cobertura de 1ª consulta odontológica programada na APS (eSB). |
| **Status SIMPA** | ❌ Sem cargas `atendimento_odontologico`; `den = "—"`. |

**Tabelas:** `esus_cargas` (`tipo_relatorio = 'atendimento_odontologico'`), `esus_indicadores_raw`.

**Query candidata (após importação odonto):**

```sql
-- Ajustar secao/descricao conforme layout do CSV e-SUS da Secretaria
SELECT COALESCE(SUM((r.valores->>'quantidade')::bigint), 0)
FROM esus_cargas c
JOIN esus_indicadores_raw r ON r.carga_id = c.id
WHERE c.competencia = :competencia
  AND c.estabelecimento_id = :estabelecimento_id
  AND c.tipo_relatorio = 'atendimento_odontologico'
  AND r.secao = 'Tipo de atendimento'  -- confirmar com CSV real
  AND r.descricao ILIKE '%1%consulta%programad%';
```

**Denominador:** população elegível (cadastro odontológico ou faixa etária) — **não vem de `populacao_cadastrada` genérico**; definir com normativa MS.

**Gap:** importar `atendimento_odontologico` + mapear seções do CSV.

---

### B2 — Tratamentos odontológicos concluídos

| | |
|--|--|
| **Fonte** | Atendimento Odontológico |
| **Status** | ❌ Igual B1 — sem cargas odonto. |

**Query candidata:** filtrar conduta/desfecho ou indicador específico de “tratamento concluído” no raw odonto (mapear após primeiro CSV real).

---

### B3 — Taxa de exodontias

| | |
|--|--|
| **Fonte** | Procedimentos Individualizados |
| **Intento** | Proporção de exodontias sobre procedimentos odontológicos (meta MS limita taxa máxima). |
| **Status** | ⚠️ Existem 7 cargas `procedimentos_individualizados` em 2026-01; numerador por código SIGTAP não consolidado. |

**Query — numerador (códigos SIGTAP de exodontia — confirmar lista MS):**

```sql
SELECT COALESCE(SUM((r.valores->>'quantidade')::bigint), 0)
FROM esus_cargas c
JOIN esus_indicadores_raw r ON r.carga_id = c.id
WHERE c.competencia = DATE '2026-01-01'
  AND c.estabelecimento_id = :estabelecimento_id
  AND c.tipo_relatorio = 'procedimentos_individualizados'
  AND (
    r.secao LIKE '%SIGTAP%'
    OR r.secao LIKE 'Outros procedimentos%'
  )
  AND (
    r.descricao LIKE '0414020%'   -- exemplo: exodontia simples
    OR r.descricao ILIKE '%exodont%'
  );
```

**Denominador:** total de procedimentos odontológicos individualizados (mesma competência/unidade).

**Gap:** catalogar códigos SIGTAP odonto vigentes; agregar por `estabelecimento_id` + `equipe_id`.

---

### B4 — Escovação supervisionada (6 a 12 anos)

| | |
|--|--|
| **Fonte** | Atividade Coletiva |
| **Intento** | Cobertura de escovação dental supervisionada em crianças 6–12 anos. |
| **Status** | ⚠️ Denominador aproximado OK; numerador = 0 no banco. |

**Denominador hoje (ETL):** soma das faixas `"05 a 09 anos"` + `"10 a 14 anos"` em `populacao_cadastrada.faixa_etaria` (proxy 6–12; ver `den_nota`).

**Soma municipal 2026-01:** 10.841 (denominador agregado nas 24 unidades com dado).

**Query — numerador:**

```sql
SELECT COALESCE(SUM((r.valores->>'quantidade')::bigint), 0)
FROM esus_cargas c
JOIN esus_indicadores_raw r ON r.carga_id = c.id
WHERE c.competencia = DATE '2026-01-01'
  AND c.estabelecimento_id = :estabelecimento_id
  AND c.tipo_relatorio = 'atividade_coletiva'
  AND r.secao = 'Práticas em saúde'
  AND r.descricao = 'Escovação dental supervisionada';
```

**Resultado atual:** 0 participantes em escovação em 2026-01 (dado existe na estrutura, produção zerada).

**Cálculo:** `exec = numerador / denominador_faixa_etaria`.

---

### B5 — Procedimentos preventivos odontológicos

| | |
|--|--|
| **Fonte** | Procedimentos Individualizados |
| **Status** | ⚠️ Cargas procedimentos existem; mapeamento SIGTAP preventivos pendente. |

**Query candidata:** somar quantidades em `Outros procedimentos (SIGTAP)` / seções odonto com códigos preventivos (flúor, selante, etc.).

---

### B6 — ART (Tratamento Restaurador Atraumático)

| | |
|--|--|
| **Fonte** | Procedimentos Individualizados |
| **Status** | ⚠️ Idem B5 — filtrar código SIGTAP ART (ex.: `0101020058`). |

---

### M1 — Média de atendimentos eMulti

| | |
|--|--|
| **Fonte** | Relatórios Individual + Coletiva |
| **Intento** | Média de atendimentos por pessoa acompanhada pela eMulti. |
| **Status** | ❌ `den = "—"`; seções `eMulti / Polo` existem no raw de atendimento individual, mas sem cargas massivas. |

**Query candidata — atendimentos eMulti:**

```sql
SELECT COALESCE(SUM((r.valores->>'quantidade')::bigint), 0)
FROM esus_cargas c
JOIN esus_indicadores_raw r ON r.carga_id = c.id
WHERE c.tipo_relatorio = 'atendimento_individual'
  AND r.secao = 'eMulti / Polo'
  AND c.competencia = :competencia
  AND c.estabelecimento_id = :estabelecimento_id;
```

**Denominador:** pessoas únicas acompanhadas pela eMulti (pode exigir cadastro ou indicador específico — não disponível só com agregados atuais).

---

### M2 — Ações interprofissionais compartilhadas

| | |
|--|--|
| **Fonte** | Atividade Coletiva |
| **Status** | ⚠️ Dados coletivos importados (17 cargas); mapear prática/tema “interprofissional” no raw. |

**Query candidata:** filtrar `Práticas em saúde` ou `Temas para saúde` conforme nomenclatura e-SUS local.

---

### IGM-APS — Cobertura APS

| | |
|--|--|
| **Categoria** | IGM SUS Paulista |
| **Periodicidade** | Mensal |
| **Fonte declarada** | Cadastro territorial e-SUS |
| **Status** | ⚠️ Denominador = `cidadaos_ativos`; numerador/exec não calculados. |

**Denominador hoje:** igual C1 (`populacao_cadastrada.cidadaos_ativos`).

**Numerador proposto:** cidadãos com vínculo ativo e acompanhamento (pode usar cadastro individual + regra territorial MS/IGM) ou numerador específico quando a Secretaria definir.

**Cálculo placeholder:** `exec = numerador_vinculados / cidadaos_ativos`.

---

### IGM-PN — Pré-natal 7+ consultas

| | |
|--|--|
| **Fonte** | Atendimento Individual |
| **Status** | ⚠️ Denominador gestantes OK; numerador ausente. |

**Denominador hoje (ETL):**

```sql
-- Equivalente em populacao_cadastrada:
-- condicoes_saude->'gestante'->>'sim'
SELECT (condicoes_saude->'gestante'->>'sim')::int
FROM populacao_cadastrada
WHERE competencia = DATE '2026-01-01'
  AND estabelecimento_id = :estabelecimento_id;
```

**Soma municipal 2026-01:** 433 gestantes (`Está gestante = Sim`).

**Numerador proposto:** gestantes com ≥ 7 consultas de pré-natal — **requer** dado longitudinal (não está em agregado simples do CSV mensal); possível via ficha individual / indicador pré-calculado no e-SUS ou integração futura.

---

### IGM-VAC — Cobertura vacinal (< 1 ano)

| | |
|--|--|
| **Fonte declarada** | Sistema de imunização (parcial Fase 1) |
| **Status** | ⚠️ Denominador faixa `< 1 ano` OK; vacinação não integrada. |

**Denominador hoje:** faixa `"Menos de 01 ano"` (M + F) em `faixa_etaria`.

**Soma municipal 2026-01:** 1.545 crianças.

**Numerador:** doses/cobertura vacinal — **não há tabela SI-PNI** no SIMPA; `exec` permanece null até integração ou proxy e-SUS.

---

### IGM-ICSAP — Internações sensíveis à APS

| | |
|--|--|
| **Fonte declarada** | e-SUS + SIHD (parcial Fase 1) |
| **Status** | ⚠️ Denominador populacional OK; SIHD não importado (`hospitalar_sihd.status_importacao = PENDING_AIH_FILE`). |

**Denominador:** `cidadaos_ativos` (proxy populacional).

**Numerador proposto:** internações por condições sensíveis (lista CID ICSAP) / população × fator — requer **`sihd`/AIH** ou tabulação externa.

---

## 4) Tabelas PostgreSQL relevantes

| Tabela | Papel em `/indicadores` |
|--------|-------------------------|
| `dados_consolidados` | **Fonte da API** — array `indicadores_qualidade` pronto para UI |
| `populacao_cadastrada` | Denominadores C1, IGM-APS, IGM-ICSAP, IGM-PN, IGM-VAC, B4 |
| `esus_cargas` | Metadados por tipo de relatório / competência / FK unidade-equipe |
| `esus_indicadores_raw` | Numeradores brutos (seções `Tipo de atendimento`, `Práticas em saúde`, SIGTAP, etc.) |
| `indicadores` | Catálogo relacional (codigo, numerador_expr, denominador_expr) — **vazio hoje** |
| `metas_financiamento` | Metas por competência/unidade — **vazio hoje** |
| `sia_producao` | Produção ambulatorial; útil para Tabela SUS / emendas, **não** para os 13 indicadores de qualidade atuais |
| `painel_metricas_catalogo` | Métricas do **Painel** (`/`), não do catálogo fixo de `/indicadores` |

### Ler indicadores já consolidados

```sql
SELECT
  dc.competencia,
  dc.estabelecimento_id,
  dc.unidade,
  elem->>'cod'   AS cod,
  elem->>'exec'  AS exec,
  elem->>'meta'  AS meta,
  elem->>'num'   AS num,
  elem->>'den'   AS den
FROM dados_consolidados dc,
     jsonb_array_elements(dc.dados_conteudo->'indicadores_qualidade') elem
WHERE dc.competencia = DATE '2026-01-01'
ORDER BY dc.unidade, cod;
```

### Inventário de cargas e-SUS (2026-01)

| `tipo_relatorio` | Cargas | Uso nos indicadores |
|------------------|--------|---------------------|
| `cadastro_individual` | 26 | Denominadores populacionais |
| `atividade_coletiva` | 17 | B4, M2 |
| `procedimentos_individualizados` | 7 | B3, B5, B6 |
| `atendimento_individual` | 0 | C1, IGM-PN, M1 |
| `atendimento_odontologico` | 0 | B1, B2 |

---

## 5) Implementação no código

| Artefato | Responsabilidade |
|----------|------------------|
| `etl_contract.py` → `INDICADORES_QUALIDADE_CATALOG` | Catálogo fixo (13 itens) |
| `etl_contract.py` → `_denominadores()` | Denominadores a partir de `pop_row` |
| `etl_contract.py` → `_build_indicadores_qualidade()` | Monta array do contrato |
| `consolidate_dashboard.py` → `fetch_pop_row()` | Lê `populacao_cadastrada` por FK |
| `consolidate_dashboard.py` → `build_payload()` | Passa `pop_row` ao ETL |
| `dashboardService.js` | Repassa `indicadores_qualidade` do JSON |
| `IndicadoresPage` | UI catálogo + detalhe |
| `metas/metasView.ts` → `enrichIndicador()` | Formatação meta/status |
| `indicadores/qualidadeView.ts` | Histórico e ranking (**fallback sintético**) |

### Reconsolidar após importar cadastro individual

```powershell
python consolidate_dashboard.py --competencia 2026-01 --pg-write
# ou todas as combinações:
python consolidate_dashboard.py --all --pg-write
```

Sem `estabelecimento_id` no path legado, `fetch_pop_row` retorna `None` e todos os `den` ficam `"—"`.

---

## 6) Roadmap de cálculo (prioridade sugerida)

| Prioridade | Indicador | Pré-requisito | Esforço |
|------------|-----------|---------------|---------|
| 1 | **B4** | Já tem den + raw coletivo | Baixo — implementar numerador + `exec` no ETL |
| 2 | **C1** | Import massivo `atendimento_individual` | Médio — mapear Tipo de atendimento |
| 3 | **B3/B5/B6** | Tabela códigos SIGTAP odonto | Médio |
| 4 | **IGM-PN** | Definir numerador 7+ consultas | Alto — dado longitudinal |
| 5 | **B1/B2** | Import `atendimento_odontologico` | Médio |
| 6 | **M1/M2** | Cargas individual + coletiva eMulti | Médio |
| 7 | **IGM-VAC** | Integração SI-PNI ou proxy | Alto |
| 8 | **IGM-ICSAP** | Import SIHD / AIH | Alto |

### Metas regulamentadas

1. Popular `indicadores` com os 13 códigos + expressões versionadas.
2. Inserir metas em `metas_financiamento` por competência/origem (`Componente Qualidade APS` / `IGM SUS Paulista`).
3. No ETL, resolver `meta` por `(cod, competencia, estabelecimento_id)` antes de gravar JSON.
4. Preencher `historico` e `porUnidade` com queries reais (eliminar fallback sintético da UI).

---

## 7) Diferença: `/indicadores` vs `/cadastros/indicadores-painel`

| | `/indicadores` | `/cadastros/indicadores-painel` |
|--|----------------|----------------------------------|
| Catálogo | Fixo em `etl_contract.py` (13) | Dinâmico em `painel_metricas_catalogo` |
| Consumo | Página dedicada + `/metas` | Widgets do Painel (`/`) |
| Cálculo | Consolidado em `indicadores_qualidade` | `painelMetricsService` + SQL template |
| Governança | Código Python + recon solidação | CRUD planning staff + discovery raw |

---

## 8) Checklist para LLM implementar um indicador

1. Confirmar fórmula MS/Secretaria para a competência.
2. Identificar `tipo_relatorio`, `secao`, `descricao` no CSV (consultar `esus_indicadores_raw` DISTINCT).
3. Escrever SQL de numerador/denominador parametrizado por `competencia`, `estabelecimento_id`, `equipe_id`.
4. Implementar cálculo em `etl_contract.py` (ou serviço dedicado) preenchendo `num`, `den`, `exec`.
5. Buscar `meta` de `metas_financiamento` ou constante configurável.
6. Rodar `consolidate_dashboard.py --pg-write` e validar JSON.
7. Adicionar teste em `tests/test_etl_contract_denominadores.py` ou novo arquivo por indicador.
8. Se drill-down real for necessário, preencher `porUnidade` / `historico` no payload (UI deixa de usar dados sintéticos).

---

*Última avaliação de banco: 2026-06-24 · PostgreSQL Docker `simpa-postgres-1` · Competências com consolidado: 2026-01 (28), 2026-05 (2).*
