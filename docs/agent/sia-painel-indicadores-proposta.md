# Proposta de Indicadores SIA — Painel MAC, OCI e PATE

Documento de referência para gestores e desenvolvedores.  
**Implementação:** `migration_014_sia_painel_indicadores.sql` → catálogo `painel_metricas_catalogo` + widgets `painel_widgets` (perfil **MAC**, layout **A**).

Fontes: [`sia-schema-for-llm.md`](../../sia-schema-for-llm.md), [`importacao-esus-dicionario-dados.md`](importacao-esus-dicionario-dados.md), [`sia-importacao-producao-dicionario-dados.md`](sia-importacao-producao-dicionario-dados.md).

---

## 1. Objetivo

Monitorar produção ambulatorial SIA/SUS com recortes **mensal**, **quadrimestral** (padrão SUS: jan–abr, mai–ago, set–dez) e **anual**, comparando com períodos anteriores — alinhado a boas práticas de gestão financeira e produção assistencial, ao acompanhamento de **OCI** (Ofertas de Cuidados Integrados) e aos indicadores do **PATE** (Programa Agora Tem Especialistas, ex-PMAE).

---

## 2. Arquitetura de dados

```
MySQL s_prd (XAMPP)  →  sync_sia_mysql.py  →  sia_producao (PG)
                                                    ↓
                              painel_metricas_catalogo (fonte_tipo = sia)
                                                    ↓
                              painel_widgets (perfil MAC, layout A)
                                                    ↓
                              GET /api/painel-layout?perfil=MAC
```

**Grão analítico:** `sia_producao` por competência, CNES/estabelecimento, procedimento SIGTAP, CBO, rubrica, faixa etária e sexo.

**Filtros de escopo:** `:competencia`, `:estabelecimento_id` (equipe não se aplica ao SIA).

---

## 3. Indicadores por periodicidade

### 3.1 Mensal (mês corrente + Δ mês anterior)

| Chave | Indicador | Formato | Comparação |
|-------|-----------|---------|------------|
| `sia.producao_qtd_aprovada` | Procedimentos aprovados | número | `delta_config`: competência anterior |
| `sia.producao_valor_aprovado` | Valor aprovado | moeda | idem |
| `sia.taxa_aprovacao_qtd_pct` | Taxa aprovação (qtd) | % | fixo (denominador interno) |
| `sia.taxa_glosa_valor_pct` | Taxa glosa financeira | % | fixo |
| `sia.producao_mac_valor` | Produção MAC (rubrica 0301) | moeda | competência anterior |
| `pate.ambulatorial_valor_mes` | PATE ambulatorial (0301/0602/0604) | moeda | competência anterior |

**Sparkline:** `sia.historico_mensal_qtd` / `sia.historico_mensal_valor` (12 meses).

### 3.2 Quadrimestral (SUS)

| Chave | Indicador | Uso |
|-------|-----------|-----|
| `sia.historico_quadrimestral_valor` | Série Q1–Q3 por ano | gráfico tendência |
| `sia.variacao_quadrimestre_anterior_pct` | Δ% valor vs quadrimestre anterior | card comparativo |

Quadrimestres: **Q1** jan–abr · **Q2** mai–ago · **Q3** set–dez.

### 3.3 Anual (YTD)

| Chave | Indicador | Uso |
|-------|-----------|-----|
| `sia.historico_anual_valor` | Acumulado por ano civil (5 anos) | gráfico longo prazo |
| `sia.variacao_ano_anterior_pct` | Δ% YTD vs mesmo recorte ano anterior | card estratégico |

---

## 4. Indicadores financeiros e de produção (melhores práticas)

| Dimensão | Métrica | Interpretação |
|----------|---------|---------------|
| **Volume** | qtd aprovada, ranking procedimentos | capacidade instalada, demanda |
| **Receita SUS** | valor aprovado, por rubrica | mix de financiamento |
| **Eficiência** | taxa aprovação, taxa glosa | qualidade da faturação |
| **MAC vs AB** | rubricas 0301 vs 0101 | perfil ambulatorial especializado |
| **Ranking** | unidades, rubricas | equidade e concentração |

Widgets seed: 16 cards/gráficos no perfil MAC (ver migration 014).

---

## 5. OCI — Ofertas de Cuidados Integrados

Referência normativa: Manual PMAE (MS, 2024), Guia OCI SES-PB, NGC.

### 5.1 Implementados (proxy via SIA)

| Widget | Métrica | Lógica |
|--------|---------|--------|
| Exames diagnósticos | `sia.grupo_diagnostico_qtd` | SIGTAP grupo `02` |
| Consultas especializadas | `sia.consultas_especializadas_qtd` | subgrupo `0303` |
| Produção cirúrgica | `sia.grupo_cirurgico_qtd` | grupo `04` (métrica no catálogo) |

### 5.2 Placeholders (lacunas de dados)

| Chave | Indicador PMAE/NGC | Status |
|-------|-------------------|--------|
| `sia.oci_alcance_meta_par_pct` | #4 Alcance meta PAR (> 85%) | **ativo** — usa `metas_oci_par` |
| `sia.oci_apac_producao_qtd` | Produção APAC | **ativo** — usa `sia_producao.apac_num` |
| `sia.apac_distintas_mes` | APAC distintas | **ativo** |
| `sia.oci_absenteismo_pct` | #2 Absenteísmo (< 20%) | placeholder — requer SISREG |

**ETL:** `sync_sia_mysql.py` persiste `PRD_APANUM` → `sia_producao.apac_num`.

**Cadastro metas:** `/cadastros/metas-oci-par` → tabela `metas_oci_par`.

---

## 6. PATE — Programa Agora Tem Especialistas

O PATE (Portaria GM/MS nº 7.266/2025) consolida PMAE/PNRF. Indicadores de monitoramento oficial:

| # | Indicador PATE/PMAE | Periodicidade | Meta | Status SIMPA |
|---|---------------------|---------------|------|--------------|
| 1 | Taxa consultas agendadas p/ UBS | mensal | — | placeholder (SISREG) |
| 2 | Taxa absenteísmo por OCI | mensal | < 20% | placeholder |
| 3 | Consultas acima capacidade | mensal | — | placeholder |
| 4 | Alcance meta produção PAR | trimestral | > 85% | placeholder |
| 5 | Tempo realização OCI | mensal | — | placeholder (APAC datas) |
| 6 | Produção ambulatorial SIA | mensal | — | **implementado** |
| 7 | Exames diagnóstico (grupo 02) | mensal | — | **implementado** |
| 8 | Consultas especializadas (0303) | mensal | — | **implementado** |

Widgets PATE no Painel MAC: `pate_ambulatorial_valor`, `pate_trend_ambulatorial`, cards OCI.

---

## 7. Cadastro `/cadastros/indicadores-painel`

Após aplicar a migration:

1. **Catálogo:** 24 métricas `fonte_tipo = sia` + 3 placeholders OCI + 4 métricas `pate.*`
2. **Widgets:** 17 widgets perfil **MAC** / layout **A**
3. **UI:** seletor de perfil (APS / MAC / Hospitalar) na página de cadastro
4. **Preview:** POST `/api/cadastros/painel-widgets/preview` com competência real pós-sync SIA

### Aplicar migration

```powershell
Get-Content migration_014_sia_painel_indicadores.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
```

Ou dev local:

```powershell
psql -h localhost -p 5433 -U postgres -d simpa -f migration_014_sia_painel_indicadores.sql
```

---

## 8. Metas sugeridas (referência para pactuação local)

Valores ilustrativos — ajustar com PAR municipal/estadual e produção histórica.

| Indicador | Meta sugerida | Periodicidade |
|-----------|---------------|---------------|
| Taxa aprovação quantidade | ≥ 95% | mensal |
| Taxa glosa financeira | ≤ 5% | mensal |
| Variação quadrimestral valor | ≥ 0% (crescimento) | quadrimestral |
| OCI alcance PAR | ≥ 85% | quadrimestral |
| OCI absenteísmo | < 20% | mensal |
| Produção MAC | meta PAR ou média 4 quadrimestres anteriores + 5% | mensal |

---

## 9. Roadmap

1. **Fase 1 (entregue):** métricas SIA + widgets MAC + metas PAR + APAC no ETL
2. **Fase 2 (entregue):** Painel MAC Layout A dinâmico (`usePainelLayout` + `catalogView` ready)
3. **Fase 3:** integração SISREG → absenteísmo e filas
4. **Fase 4:** Layouts B/C MAC e catálogo OCI por procedimento SIGTAP

---

*Última atualização: 2026-06-28*
