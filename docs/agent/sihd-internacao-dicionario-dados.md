# SIHD — Dicionário de Dados (Internações / AIH)

Documento de referência para gestores, desenvolvedores e LLMs criarem indicadores em:

- `/cadastros/indicadores-painel` (métricas `fonte_tipo = 'sih'`)
- Painel perfil **Hospitalar** (Layout A)
- SQL customizado de widgets

Foco: tabelas **PostgreSQL do SIMPA** que resumem o SIHD Decisor (`s_aih` + `s_aih_pa` no MySQL).

Schema MySQL de origem (ConsultaSIA): [`docs/sih-aih-schema-for-llm.md`](../sih-aih-schema-for-llm.md).  
Pipeline: `sync_sih_mysql.py` ← `/importacao` (Importar internações SIHD).

---

## 1) Visão do modelo

```
MySQL (ConsultaSIA)                    PostgreSQL (SIMPA)
─────────────────                      ─────────────────
s_aih  (1 linha = 1 AIH)        ──►    sih_aih            (grão AIH — analítico)
                                ──►    sih_internacoes    (grão gerencial agregado)
s_aih_pa (N linhas / AIH)       ──►    sih_procedimentos  (grão gerencial agregado)

                                       sih_sincronizacoes (1 linha / competência)
```

| Tabela PG | Origem MySQL | Grão | Quando usar |
|-----------|--------------|------|-------------|
| `sih_aih` | `s_aih` (sem GROUP BY) | **1 linha = 1 AIH** × CNES × competência | Filtros por número AIH, datas, caráter, óbito, permanência real, máscara dígito AIH |
| `sih_internacoes` | `s_aih` (GROUP BY) | Grupo: CNES × proc × CID × complexidade × financiamento × motivo × sexo | Totais/médias rápidos (AIH, diárias, valor) sem precisar do número AIH |
| `sih_procedimentos` | `s_aih_pa` (GROUP BY) | Grupo: CNES × proc detalhado × CBO × financiamento | Volume e valor de procedimentos/itens |
| `sih_sincronizacoes` | — | 1 linha / competência | Saúde do pipeline; totais do histórico de importação |

**Regra prática para Indicadores do Painel**

- Precisa de **contagem de internações (AIH)** simples → `SUM(sih_internacoes.qtd_aih)` **ou** `COUNT(*)` em `sih_aih` (equivalentes se sync completa).
- Precisa de **máscara no número AIH**, datas, caráter, CID óbito, permanência → **`sih_aih`**.
- Precisa de **procedimentos / HPA** → `sih_procedimentos` (`SUM(total_quantidade)`, `SUM(total_valor_item)`, `SUM(qtd_linhas)`).

---

## 2) Pipeline e competência

| Etapa | Detalhe |
|-------|---------|
| Origem | Arquivos TXT SIHD → MySQL `s_aih` / `s_aih_pa` (via ConsultaSIA) |
| Sync SIMPA | `POST /api/sih/sincronizar` → `sync_sih_mysql.py --pg-write` |
| Competência MySQL | `VARCHAR(6)` **AAAAMM** (`202603`) |
| Competência PG | `DATE` primeiro dia do mês (`2026-03-01`) |
| Param Painel | `:competencia::date` (sempre date) |
| Reimport | DELETE filhos da sync + INSERT; `UNIQUE(competencia)` em `sih_sincronizacoes` |
| CNES → estabelecimento | `estabelecimentos.codigo_externo = cnes`; sem match → `estabelecimento_id` NULL + `orphan_cnes++` |

---

## 3) `sih_sincronizacoes`

Controle de importação por competência.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | bigint PK | ID da sync |
| `competencia` | date UNIQUE | Mês de referência (`YYYY-MM-01`) |
| `status` | varchar | `ok` \| `parcial` \| `erro` \| `pendente` |
| `qtd_aih` | int | Linhas em `sih_aih` (cabeçalhos AIH brutos) |
| `qtd_internacoes` | int | Linhas em `sih_internacoes` (**grupos** agregados, não AIHs) |
| `qtd_procedimentos` | int | Após mig. 025: total de **linhas brutas HPA** (`SUM(qtd_linhas)`); histórico de `/importacao` usa esse significado |
| `orphan_cnes` | int | CNES sem match em `estabelecimentos` |
| `erros` | int | Chunks/linhas com falha na gravação |
| `sincronizado_em` | timestamp | Momento da sync |

Não usar `qtd_internacoes` / contagem de grupos como “total de internações” em KPI — use `qtd_aih` ou `SUM(sih_internacoes.qtd_aih)`.

---

## 4) `sih_aih` — grão AIH (recomendado para indicadores finos)

Espelho analítico de `s_aih`. **Uma linha por AIH × CNES × competência.**

Único: `(sincronizacao_id, aih, cnes)`.

| Campo | Tipo | Origem MySQL | Descrição / uso em KPI |
|-------|------|--------------|-------------------------|
| `id` | bigint PK | — | Surrogate |
| `sincronizacao_id` | bigint FK | — | → `sih_sincronizacoes` ON DELETE CASCADE |
| `competencia` | date | `COMPETENCIA` | Filtro Painel `:competencia::date` |
| `aih` | varchar(13) | `AIH` | Número da AIH. Máscara: `SUBSTRING(aih FROM 5 FOR 1)` (ex. `'5'` = eletiva PATE). Índice `idx_sih_aih_digito5` |
| `cnes` | varchar(7) | `CNES` | CNES da unidade |
| `estabelecimento_id` | int FK | — | → `estabelecimentos.id` (nullable se órfão) |
| `proc_principal` | varchar(10) | `PROC_PRINCIPAL` | Procedimento principal SIGTAP (10 dígitos) |
| `diag_principal` | varchar(4) | `DIAG_PRINCIPAL` | CID-10 principal. Capítulo: `LEFT(diag_principal, 1)` |
| `diag_secundario` | varchar(4) | `DIAG_SECUNDARIO` | CID-10 secundário |
| `cid_obito` | varchar(4) | `CID_OBITO` | Preenchido em óbito; KPI mortalidade: `cid_obito IS NOT NULL AND cid_obito <> ''` |
| `carater_internacao` | varchar(2) | `CARATER_INTERNACAO` | Ver §7 (01 eletivo, 02 urgência, …) |
| `complexidade` | varchar(2) | `COMPLEXIDADE` | Complexidade da internação |
| `financiamento` | varchar(2) | `FINANCIAMENTO` | Rubrica 2 chars → `rubricas_sia.codigo_rubrica` **direto** (não `LEFT(…,4)` como no SIA) |
| `motivo_saida` | varchar(2) | `MOTIVO_SAIDA` | Motivo de saída / alta |
| `sexo` | varchar(1) | `SEXO_PACIENTE` | `M` / `F` |
| `especialidade` | varchar(3) | `ESPECIALIDADE` | Código especialidade SIHD |
| `idade` | int | `IDADE` | Idade em anos na internação |
| `dt_internacao` | date | `DT_INT` | AAAAMMDD → DATE |
| `dt_saida` | date | `DT_SAIDA` | AAAAMMDD → DATE |
| `diarias` | int | `DIARIAS` | Diárias da AIH |
| `diarias_uti` | int | `DIARIAS_UTI` | Diárias UTI |
| `valor_total` | numeric(15,2) | `VALOR_TOTAL_AIH` | Valor total da AIH (pré-calculado no SIHD) |

**Permanência real (dias):** quando datas existem:

```sql
(sa.dt_saida - sa.dt_internacao)
```

(métrica seed `sih.permanencia_media_real`).

Campos MySQL **não** espelhados no PG (ainda): `DT_NASC`, `ENFERMARIA`.

---

## 5) `sih_internacoes` — grão gerencial (totais rápidos)

Agregação de `s_aih` no sync. **Não** contém o número da AIH.

Grão UNIQUE:  
`sincronizacao_id × cnes × proc_principal × diag_principal × complexidade × financiamento × motivo_saida × sexo`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | bigint PK | Surrogate |
| `sincronizacao_id` | bigint FK | → sync |
| `competencia` | date | Mês |
| `cnes` | varchar(7) | CNES |
| `estabelecimento_id` | int FK | Estabelecimento (nullable) |
| `proc_principal` | varchar(10) | Procedimento principal do grupo |
| `diag_principal` | varchar(4) | CID principal do grupo |
| `complexidade` | varchar(2) | |
| `financiamento` | varchar(2) | Rubrica 2 chars |
| `motivo_saida` | varchar(2) | |
| `sexo` | varchar(1) | |
| `qtd_aih` | int | **COUNT(DISTINCT AIH)** no grupo — use `SUM(qtd_aih)` para total de internações |
| `total_diarias` | int | Soma de diárias |
| `total_diarias_uti` | int | Soma diárias UTI |
| `total_valor` | numeric(15,2) | Soma `VALOR_TOTAL_AIH` |
| `media_idade` | numeric(5,2) | Média de idade no grupo |
| `media_diarias` | numeric(5,2) | Média de diárias no grupo |

Exemplo KPI (seed `sih.total_aih`):

```sql
SELECT COALESCE(SUM(si.qtd_aih), 0)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
```

---

## 6) `sih_procedimentos` — itens HPA agregados

Agregação de `s_aih_pa`.

Grão UNIQUE:  
`sincronizacao_id × cnes × proc_detalhado × cbo_profissional × financiamento_detalhe`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | bigint PK | Surrogate |
| `sincronizacao_id` | bigint FK | → sync |
| `competencia` | date | Mês |
| `cnes` | varchar(7) | CNES |
| `estabelecimento_id` | int FK | Estabelecimento (nullable) |
| `proc_detalhado` | varchar(10) | Procedimento realizado (SIGTAP 10 dígitos) |
| `cbo_profissional` | varchar(6) | CBO → `cbos_sia.codigo_cbo` |
| `financiamento_detalhe` | varchar(2) | Rubrica do item → `rubricas_sia.codigo_rubrica` |
| `qtd_aih_distintas` | int | COUNT(DISTINCT AIH) no grupo |
| `total_quantidade` | int | **SUM(QUANTIDADE)** do MySQL (produção) |
| `total_valor_item` | numeric(15,2) | **SUM(VALOR_ITEM)** |
| `qtd_linhas` | int | **COUNT(*)** linhas brutas `s_aih_pa` no grupo (mig. 025). Histórico `/importacao` = `SUM(qtd_linhas)` |

| Precisa de… | Use |
|-------------|-----|
| Volume produzido (qtd SUS) | `SUM(total_quantidade)` |
| Valor aprovado/apresentado itens | `SUM(total_valor_item)` |
| Contagem de linhas HPA (como ConsultaSIA) | `SUM(qtd_linhas)` |
| Nº de grupos gerenciais | `COUNT(*)` — **evitar** em KPI de negócio |

---

## 7) Domínios de códigos (resumo SIHD)

### 7.1 `carater_internacao` (`sih_aih`)

| Código | Significado SIHD |
|--------|------------------|
| `01` | Eletivo |
| `02` | Urgência |
| `03` | Acidente no trajeto para o trabalho |
| `04` | Outros tipos de acidentes de trabalho |
| `05` | Outros tipos de acidentes |
| `06` | Pós-parto normal / cesárea |

### 7.2 `sexo`

| Código | Significado |
|--------|-------------|
| `M` | Masculino |
| `F` | Feminino |

### 7.3 `financiamento` / `financiamento_detalhe`

- 2 caracteres = `rubricas_sia.codigo_rubrica` (mesmo padrão `RUB_ID` do MySQL `s_rub`).
- **Não** aplicar `LEFT(codigo, 4)` (isso é SIA/`PRD_RUB`).

```sql
LEFT JOIN rubricas_sia rs ON si.financiamento = rs.codigo_rubrica
```

### 7.4 Hierarquia de procedimento (forma)

Grupo / subgrupo / forma a partir dos 10 dígitos (igual SIA):

```sql
LEFT(proc_principal, 2)  -- grupo
LEFT(proc_principal, 4)  -- subgrupo
LEFT(proc_principal, 6)  -- forma → formas_sia.codigo_forma
```

### 7.5 Máscara no número AIH

O 5º caractere do número AIH é usado em filtros locais (ex. eletiva PATE):

```sql
SUBSTRING(sa.aih FROM 5 FOR 1) = '5'
```

---

## 8) Joins úteis (PG)

```
sih_aih / sih_internacoes / sih_procedimentos
    ├─ estabelecimento_id → estabelecimentos.id
    │     (alternativa: cnes = estabelecimentos.codigo_externo)
    ├─ financiamento / financiamento_detalhe → rubricas_sia.codigo_rubrica
    ├─ LEFT(proc_*, 6) → formas_sia.codigo_forma
    └─ cbo_profissional → cbos_sia.codigo_cbo   (só procedimentos)
```

Filtro padrão de widget (obrigatório no `sql_template`):

```sql
WHERE *.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR *.estabelecimento_id = :estabelecimento_id::bigint)
```

`:competencia` e `:estabelecimento_id` são injetados pelo runtime do Painel.

---

## 9) Qual tabela escolher — árvore rápida

```
Indicador de internação?
├─ Precisa de AIH individual / datas / caráter / óbito / máscara dígito?
│     └─ SIM → sih_aih
│     └─ NÃO → sih_internacoes (SUM(qtd_aih), SUM(total_valor), …)
└─ Indicador de procedimento / valor HPA?
      └─ sih_procedimentos
```

---

## 10) Exemplos SQL para Indicadores do Painel

### 10.1 Total de AIH (`sih_aih`)

```sql
SELECT COUNT(*)::bigint AS valor
FROM sih_aih sa
WHERE sa.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sa.estabelecimento_id = :estabelecimento_id::bigint)
```

### 10.2 % óbito com CID (`sih.pct_obito_cid`)

```sql
SELECT ROUND(
  100.0 * COUNT(*) FILTER (
    WHERE sa.cid_obito IS NOT NULL AND TRIM(sa.cid_obito) <> ''
  ) / NULLIF(COUNT(*), 0),
  2
)::numeric AS valor
FROM sih_aih sa
WHERE sa.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sa.estabelecimento_id = :estabelecimento_id::bigint)
```

### 10.3 Internações por caráter (ranking)

```sql
SELECT COALESCE(sa.carater_internacao, '?') AS unidade,
       COUNT(*)::bigint AS valor
FROM sih_aih sa
WHERE sa.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sa.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY sa.carater_internacao
ORDER BY valor DESC
LIMIT 10
```

### 10.4 Top capítulos CID (`sih_internacoes`)

```sql
SELECT LEFT(si.diag_principal, 1) AS unidade,
       SUM(si.qtd_aih)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
  AND si.diag_principal IS NOT NULL
  AND si.diag_principal <> ''
GROUP BY LEFT(si.diag_principal, 1)
ORDER BY valor DESC
LIMIT 10
```

### 10.5 Volume de procedimentos (quantidade SUS)

```sql
SELECT COALESCE(SUM(sp.total_quantidade), 0)::bigint AS valor
FROM sih_procedimentos sp
WHERE sp.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
```

### 10.6 Sparkline mensal (12 meses)

```sql
SELECT to_char(sa.competencia, 'YYYY-MM') AS competencia,
       COUNT(*)::bigint AS valor
FROM sih_aih sa
WHERE sa.competencia >= (:competencia::date - INTERVAL '11 months')
  AND sa.competencia <= :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sa.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY sa.competencia
ORDER BY sa.competencia
LIMIT 12
```

Mais exemplos na UI: `simpa-frontend/src/utils/painelWidgetSqlExamples.ts` (grupo `sih`).

---

## 11) Armadilhas frequentes

| Erro | Correto |
|------|---------|
| Contar `COUNT(*)` em `sih_internacoes` como “nº de AIHs” | `SUM(qtd_aih)` ou `COUNT(*)` em `sih_aih` |
| Usar `qtd_procedimentos` da sync como “grupos” em KPI de volume | Depende do indicador: linhas HPA = `SUM(qtd_linhas)`; produção = `SUM(total_quantidade)` |
| `LEFT(financiamento, 4)` | Join direto 2 chars com `rubricas_sia` |
| Comparar competência `202603` (MySQL) no PG | Usar `DATE '2026-03-01'` / `:competencia::date` |
| Filtrar só por `cnes` texto no Painel | Preferir `:estabelecimento_id` (runtime do widget) |
| Esperar `DT_NASC` / `ENFERMARIA` no PG | Ainda só no MySQL `s_aih` |

---

## 12) Migrations relacionadas

| Arquivo | Conteúdo |
|---------|----------|
| `migration_013_sih_tabelas.sql` | `sih_sincronizacoes`, `sih_internacoes`, `sih_procedimentos` + seeds widgets |
| `migration_020_sih_aih.sql` | `sih_aih` + `qtd_aih` na sync |
| `migration_023_sih_aih_campos.sql` | caráter, diag secundário, CID óbito, datas |
| `migration_024_sih_aih_widgets.sql` | métricas permanência / óbito / caráter |
| `migration_025_sih_proc_qtd_linhas.sql` | `sih_procedimentos.qtd_linhas` |

---

## 13) Referências

- API: [backend-api.md](backend-api.md) (seção SIHD)
- Schema resumido: [database.md](database.md#sihd-migration-013)
- Origem MySQL detalhada: [sih-aih-schema-for-llm.md](../sih-aih-schema-for-llm.md)
- Cadastro widgets: [cadastros.md](cadastros.md#workflow-painel-widgets-dinamicos)
- ETL: `sync_sih_mysql.py`
