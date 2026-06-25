# Schema SIA — Guia para Geração de Relatórios e KPIs

> Documento técnico para uso por LLMs.  
> Banco: `producao` (MariaDB 10.4 / MySQL 5.7+)  
> Módulo: `/relatorios` — Produção Hospitalar SIA (Sistema de Informações Ambulatoriais)

---

## 1. Visão Geral do Modelo

```
s_prd  ←──────→  prestador      (via s_prd.prd_uid  = prestador.re_cunid)
s_prd  ←──────→  procedimento   (via s_prd.prd_pa   = procedimento.codigo)
s_prd  ←──────→  cbo            (via s_prd.prd_cbo  = cbo.CBO)
s_prd  ←──────→  s_rub          (via s_prd.PRD_RUB  = s_rub.RUB_ID)
s_prd  ←──────→  forma          (via SUBSTRING(s_prd.prd_pa,1,2/4/6) = forma.grupo/subgrupo/forma)
procedimento ←→  forma          (via SUBSTRING(procedimento.codigo,1,6))
```

**Tabela central:** `s_prd` — 5.9 milhões de registros de produção ambulatorial.  
Todas as outras tabelas são dimensões/lookups.  
**Não há Foreign Keys formais.** Integridade referencial é lógica, não física.

---

## 2. Tabelas — Schema Detalhado

### 2.1 `s_prd` — Produção SIA (tabela de fatos)

**Engine:** MyISAM | **Charset:** utf8mb4_general_ci

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | bigint UNSIGNED | PK AUTO_INCREMENT | Identificador interno |
| `prd_uid` | varchar(7) | NOT NULL | CNES da unidade produtora → `prestador.re_cunid` |
| `prd_cmp` | varchar(6) | NOT NULL | Competência **AAAAMM** (ex: `202501` = Jan/2025) |
| `prd_flh` | char(3) | NOT NULL | Folha |
| `prd_seq` | char(2) | NOT NULL | Sequência |
| `prd_pa` | varchar(10) | NOT NULL | Código do procedimento SUS 10 dígitos → `procedimento.codigo` |
| `prd_cbo` | varchar(8) | NOT NULL | CBO do profissional → `cbo.CBO` |
| `PRD_IDADE` | int(3) | NULL | Idade do paciente (pode ter valores > 150 = inválido) |
| `PRD_QT_P` | int(6) | NULL | **Quantidade apresentada** (CAST AS UNSIGNED antes de somar) |
| `PRD_QT_A` | int(6) | NULL | **Quantidade aprovada** |
| `PRD_VL_P` | decimal(15,2) | NULL | **Valor apresentado** (CAST AS DECIMAL(15,2)) |
| `PRD_VL_A` | decimal(15,2) | NULL | **Valor aprovado** |
| `PRD_MVM` | varchar(6) | `''` | Data de movimento AAAAMM |
| `PRD_ORG` | char(3) | `''` | Órgão emissor |
| `PRD_FLPA` | char(1) | `''` | Flag erro PA |
| `PRD_FLCBO` | char(1) | `''` | Flag erro CBO |
| `PRD_FLCA` | char(1) | `''` | Flag erro caráter |
| `PRD_FLIDA` | char(1) | `''` | Flag erro idade |
| `PRD_FLQT` | char(1) | `''` | Flag erro quantidade |
| `PRD_FLER` | char(1) | `''` | Flag erro geral |
| `PRD_APANUM` | varchar(13) | `''` | Número APAC vinculada |
| `PRD_CNSMED` | varchar(15) | NULL | CNS do profissional |
| `PRD_RMS` | varchar(4) | `''` | RMS/CNAE |
| `PRD_CNPJ` | varchar(14) | `''` | CNPJ da unidade |
| `PRD_NFIS` | varchar(6) | `''` | Nota fiscal |
| `PRD_RUB` | varchar(6) | `''` | Rubrica/financiamento → `s_rub.RUB_ID` (primeiros 4 chars) |
| `PRD_CPX` | char(1) | `''` | Complexidade |
| `PRD_TPFIN` | char(1) | `''` | Tipo de financiamento |
| `PRD_CIDPRI` | varchar(6) | `''` | CID principal |
| `PRD_CIDSEC` | varchar(6) | `''` | CID secundário |
| `PRD_CIDCAS` | varchar(6) | `''` | CID causa |
| `grupo` | varchar(2) | GENERATED STORED | `LEFT(prd_pa, 2)` — primeiros 2 dígitos do procedimento |
| `subgrupo` | varchar(4) | GENERATED STORED | `LEFT(prd_pa, 4)` |
| `forma` | varchar(6) | GENERATED STORED | `LEFT(prd_pa, 6)` |

**Índices:**
```sql
PRIMARY KEY (id)
KEY idx_composite (prd_uid, prd_cmp, prd_flh, prd_seq)
KEY idx_prd_uid (prd_uid)
KEY idx_prd_cmp (prd_cmp)        -- fundamental para filtrar por competência
KEY idx_prd_pa  (prd_pa)
KEY idx_prd_cbo (prd_cbo)
KEY idx_grupo   (grupo)
KEY idx_subgrupo(subgrupo)
KEY idx_forma   (forma)
```

> ⚠️ **SEMPRE filtrar por `prd_cmp`** antes de qualquer query — sem esse filtro a query varre 5.9M registros.

---

### 2.2 `prestador` — Unidades de Saúde

**Engine:** MyISAM | **Charset:** utf8mb4_general_ci

| Coluna | Tipo | Descrição |
|---|---|---|
| `re_cunid` | varchar(7) | **PK lógica** — CNES da unidade |
| `re_cnome` | varchar(35) | Nome da unidade |
| `re_tipo` | char(1) | Tipo de unidade |
| `cnpj` | varchar(14) | CNPJ |
| `area` | int(11) | Área de atuação |
| `tipouni` | char(1) | Tipo de unidade (M/P/etc) |
| `relatorio` | varchar(40) | Tipo de relatório/grupo |
| `ativo` | tinyint(1) | 1 = ativo, 0 = inativo |

```sql
-- JOIN padrão:
LEFT JOIN prestador pr ON sp.prd_uid COLLATE utf8mb4_unicode_ci = pr.re_cunid COLLATE utf8mb4_unicode_ci
```

---

### 2.3 `procedimento` — Tabela SUS de Procedimentos

**Engine:** MyISAM | **Charset:** utf8mb4_general_ci

| Coluna | Tipo | Descrição |
|---|---|---|
| `codigo` | varchar(10) | **PK** — código SUS de 10 dígitos (ex: `0303170204`) |
| `procedimento` | varchar(63) | Nome/descrição do procedimento |
| `PA_TOTAL` | decimal(12,2) | Valor unitário do procedimento |
| `RUB_TOTAL` | varchar(4) | Rubrica financeira |
| `RUB_DC` | varchar(40) | Descrição da rubrica |
| `PA_RUB` | varchar(4) | Rubrica PA |
| `PA_ID` | varchar(9) | Identificador alternativo |
| `FINANCIAMENTO` | varchar(60) | Tipo de financiamento |

```sql
-- JOIN padrão:
LEFT JOIN procedimento pc ON sp.prd_pa COLLATE utf8mb4_unicode_ci = pc.codigo COLLATE utf8mb4_unicode_ci
```

---

### 2.4 `cbo` — Classificação Brasileira de Ocupações

**Engine:** InnoDB | **Charset:** latin1_swedish_ci

| Coluna | Tipo | Descrição |
|---|---|---|
| `CBO` | varchar(6) | **PK lógica** — código CBO (ex: `225125`) |
| `DS_CBO` | varchar(120) | Descrição da ocupação |

```sql
-- JOIN padrão:
LEFT JOIN cbo cb ON sp.prd_cbo COLLATE utf8mb4_unicode_ci = cb.CBO COLLATE utf8mb4_unicode_ci
```

> ⚠️ charset `latin1` — pode exigir COLLATE em JOINs se o DB connection usar utf8mb4.

---

### 2.5 `forma` — Hierarquia de Procedimentos SUS

**Engine:** InnoDB | **Charset:** utf8mb4_general_ci

| Coluna | Tipo | Descrição |
|---|---|---|
| `id_registro` | int(11) | **PK** AUTO_INCREMENT |
| `grupo` | varchar(2) | Ex: `03` = Procedimentos Clínicos |
| `subgrupo` | varchar(4) | Ex: `0303` = Consultas e Atendimentos |
| `forma` | varchar(6) | Ex: `030317` = forma de organização |
| `descricao` | varchar(100) | Descrição do nível |

**Lógica de hierarquia:** o código SUS de 10 dígitos (`prd_pa`) tem estrutura:
```
0  3  0  3  1  7  0  2  0  4
│──┘  │────┘  │──────┘  │────┘
grupo subgrupo  forma    procedimento
 (2)    (4)      (6)       (10)
```

**JOINs triplos necessários** para mostrar todos os níveis simultaneamente:
```sql
-- Grupo (2 chars)
LEFT JOIN forma fg ON SUBSTRING(sp.prd_pa,1,2) COLLATE utf8mb4_general_ci = fg.grupo COLLATE utf8mb4_general_ci
          AND fg.subgrupo COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sp.prd_pa,1,2),'00') COLLATE utf8mb4_general_ci
          AND fg.forma    COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sp.prd_pa,1,2),'0000') COLLATE utf8mb4_general_ci

-- Subgrupo (4 chars)
LEFT JOIN forma fs ON SUBSTRING(sp.prd_pa,1,4) COLLATE utf8mb4_general_ci = fs.subgrupo COLLATE utf8mb4_general_ci
          AND fs.forma COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sp.prd_pa,1,4),'00') COLLATE utf8mb4_general_ci

-- Forma de organização (6 chars)
LEFT JOIN forma ff ON SUBSTRING(sp.prd_pa,1,6) COLLATE utf8mb4_general_ci = ff.forma COLLATE utf8mb4_general_ci
```

> ⚠️ `forma` usa `utf8mb4_general_ci` mas `s_prd` foi criado com `utf8mb4_unicode_ci` via migrations Laravel — sempre use `COLLATE utf8mb4_general_ci` nas condições de JOIN com `forma`.

---

### 2.6 `s_rub` — Rubricas / Tipos de Financiamento

**Engine:** MyISAM | **Charset:** utf8mb4_general_ci

| Coluna | Tipo | Descrição |
|---|---|---|
| `RUB_ID` | char(4) | **PK lógica** — código da rubrica (ex: `0602`) |
| `RUB_DC` | char(40) | Descrição (ex: `MAC - MÉDIA/ALTA COMPLEXIDADE`) |
| `RUB_TOTAL` | char(2) | Indicador de total |

**Vínculo com s_prd:**
```sql
-- PRD_RUB tem 6 chars, RUB_ID tem 4 chars — usar apenas os 4 primeiros
LEFT JOIN s_rub sr ON LEFT(sp.PRD_RUB, 4) COLLATE utf8mb4_unicode_ci = sr.RUB_ID COLLATE utf8mb4_unicode_ci
```

---

## 3. Padrões de Query Obrigatórios

### 3.1 CAST em campos numéricos

Campos numéricos em `s_prd` são declarados como `int` ou `decimal` mas **podem ter anomalias** — sempre use CAST:

```sql
-- Quantidades (inteiros sem sinal)
SUM(CAST(sp.PRD_QT_P AS UNSIGNED))   -- quantidade apresentada
SUM(CAST(sp.PRD_QT_A AS UNSIGNED))   -- quantidade aprovada

-- Valores monetários
SUM(CAST(sp.PRD_VL_P AS DECIMAL(15,2)))  -- valor apresentado
SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2)))  -- valor aprovado

-- Valor unitário da tabela procedimento
CAST(pc.PA_TOTAL AS DECIMAL(15,2))
```

### 3.2 Competência

`prd_cmp` é string `AAAAMM`. Para exibição legível:
```sql
CONCAT(SUBSTRING(sp.prd_cmp,1,4), '-', SUBSTRING(sp.prd_cmp,5,2)) AS competencia
-- Resultado: '2025-01'
```

Para filtros de intervalo entre competências (ex: Jan/2024 a Dez/2024):
```sql
WHERE sp.prd_cmp BETWEEN '202401' AND '202412'
```

### 3.3 Template de query base

```sql
SELECT
    /* Dimensões */
    sp.prd_cmp                                      AS competencia,
    sp.prd_uid                                      AS cnes,
    pr.re_cnome                                     AS prestador,
    sp.prd_pa                                       AS procedimento_codigo,
    pc.procedimento                                 AS procedimento_nome,
    SUBSTRING(sp.prd_pa,1,2)                        AS grupo_codigo,
    fg.descricao                                    AS grupo_descricao,
    sp.prd_cbo                                      AS cbo_codigo,
    cb.DS_CBO                                       AS cbo_descricao,
    LEFT(sp.PRD_RUB,4)                              AS rubrica_codigo,
    sr.RUB_DC                                       AS rubrica_descricao,

    /* Métricas */
    SUM(CAST(sp.PRD_QT_P AS UNSIGNED))              AS qtd_apresentada,
    SUM(CAST(sp.PRD_QT_A AS UNSIGNED))              AS qtd_aprovada,
    SUM(CAST(sp.PRD_VL_P AS DECIMAL(15,2)))         AS valor_apresentado,
    SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2)))         AS valor_aprovado,
    SUM(CAST(sp.PRD_QT_P AS UNSIGNED)
        * CAST(pc.PA_TOTAL AS DECIMAL(15,2)))       AS valor_calculado_tabela

FROM s_prd sp
LEFT JOIN prestador  pr ON sp.prd_uid COLLATE utf8mb4_unicode_ci = pr.re_cunid COLLATE utf8mb4_unicode_ci
LEFT JOIN procedimento pc ON sp.prd_pa COLLATE utf8mb4_unicode_ci = pc.codigo COLLATE utf8mb4_unicode_ci
LEFT JOIN cbo         cb ON sp.prd_cbo COLLATE utf8mb4_unicode_ci = cb.CBO COLLATE utf8mb4_unicode_ci
LEFT JOIN s_rub       sr ON LEFT(sp.PRD_RUB,4) COLLATE utf8mb4_unicode_ci = sr.RUB_ID COLLATE utf8mb4_unicode_ci
LEFT JOIN forma       fg ON SUBSTRING(sp.prd_pa,1,2) COLLATE utf8mb4_general_ci = fg.grupo COLLATE utf8mb4_general_ci
              AND fg.subgrupo COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sp.prd_pa,1,2),'00') COLLATE utf8mb4_general_ci
              AND fg.forma    COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sp.prd_pa,1,2),'0000') COLLATE utf8mb4_general_ci

WHERE sp.prd_cmp = '202501'          -- OBRIGATÓRIO: sempre filtrar por competência
  -- AND sp.prd_uid = '2058790'      -- opcional: filtrar por CNES
  -- AND sp.prd_pa = '0303170204'    -- opcional: filtrar por procedimento
  -- AND sp.prd_cbo = '225125'       -- opcional: filtrar por CBO

GROUP BY
    sp.prd_cmp, sp.prd_uid, pr.re_cnome,
    sp.prd_pa, pc.procedimento,
    SUBSTRING(sp.prd_pa,1,2), fg.descricao,
    sp.prd_cbo, cb.DS_CBO,
    LEFT(sp.PRD_RUB,4), sr.RUB_DC

ORDER BY valor_aprovado DESC;
```

---

## 4. KPIs e Indicadores — Exemplos Prontos

### 4.1 Produção total por competência

```sql
SELECT
    sp.prd_cmp                                     AS competencia,
    COUNT(DISTINCT sp.prd_uid)                     AS qtd_prestadores,
    COUNT(DISTINCT sp.prd_pa)                      AS qtd_procedimentos_distintos,
    SUM(CAST(sp.PRD_QT_P AS UNSIGNED))             AS total_qtd_apresentada,
    SUM(CAST(sp.PRD_QT_A AS UNSIGNED))             AS total_qtd_aprovada,
    SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2)))        AS total_valor_aprovado,
    ROUND(
        SUM(CAST(sp.PRD_QT_A AS UNSIGNED)) * 100.0
        / NULLIF(SUM(CAST(sp.PRD_QT_P AS UNSIGNED)), 0)
    , 2)                                           AS taxa_aprovacao_pct
FROM s_prd sp
WHERE sp.prd_cmp = '202501'
GROUP BY sp.prd_cmp;
```

---

### 4.2 Ranking de prestadores por valor aprovado

```sql
SELECT
    sp.prd_uid                                     AS cnes,
    pr.re_cnome                                     AS prestador,
    SUM(CAST(sp.PRD_QT_A AS UNSIGNED))             AS qtd_aprovada,
    SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2)))        AS valor_aprovado,
    ROUND(
        SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2))) * 100.0
        / SUM(SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2)))) OVER ()
    , 2)                                           AS participacao_pct
FROM s_prd sp
LEFT JOIN prestador pr ON sp.prd_uid COLLATE utf8mb4_unicode_ci = pr.re_cunid COLLATE utf8mb4_unicode_ci
WHERE sp.prd_cmp = '202501'
GROUP BY sp.prd_uid, pr.re_cnome
ORDER BY valor_aprovado DESC
LIMIT 20;
```

---

### 4.3 Produção por grupo de procedimento (hierarquia)

```sql
SELECT
    SUBSTRING(sp.prd_pa,1,2)                       AS grupo_codigo,
    fg.descricao                                    AS grupo_descricao,
    COUNT(DISTINCT sp.prd_pa)                       AS qtd_procedimentos,
    SUM(CAST(sp.PRD_QT_A AS UNSIGNED))             AS qtd_aprovada,
    SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2)))        AS valor_aprovado
FROM s_prd sp
LEFT JOIN forma fg
    ON SUBSTRING(sp.prd_pa,1,2) COLLATE utf8mb4_general_ci = fg.grupo COLLATE utf8mb4_general_ci
    AND fg.subgrupo COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sp.prd_pa,1,2),'00') COLLATE utf8mb4_general_ci
    AND fg.forma    COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sp.prd_pa,1,2),'0000') COLLATE utf8mb4_general_ci
WHERE sp.prd_cmp BETWEEN '202401' AND '202412'
GROUP BY SUBSTRING(sp.prd_pa,1,2), fg.descricao
ORDER BY valor_aprovado DESC;
```

---

### 4.4 Série histórica mensal (evolução ao longo do tempo)

```sql
SELECT
    sp.prd_cmp                                     AS competencia,
    CONCAT(SUBSTRING(sp.prd_cmp,5,2),'/',
           SUBSTRING(sp.prd_cmp,1,4))              AS mes_ano,
    SUM(CAST(sp.PRD_QT_P AS UNSIGNED))             AS qtd_apresentada,
    SUM(CAST(sp.PRD_QT_A AS UNSIGNED))             AS qtd_aprovada,
    SUM(CAST(sp.PRD_VL_P AS DECIMAL(15,2)))        AS valor_apresentado,
    SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2)))        AS valor_aprovado
FROM s_prd sp
WHERE sp.prd_cmp BETWEEN '202401' AND '202412'
  -- AND sp.prd_uid = '2058790'     -- opcional: filtrar por unidade
GROUP BY sp.prd_cmp
ORDER BY sp.prd_cmp;
```

---

### 4.5 Taxa de glosa (quantidade e valor)

```sql
SELECT
    sp.prd_uid                                      AS cnes,
    pr.re_cnome                                     AS prestador,
    SUM(CAST(sp.PRD_QT_P AS UNSIGNED))              AS qtd_apresentada,
    SUM(CAST(sp.PRD_QT_A AS UNSIGNED))              AS qtd_aprovada,
    SUM(CAST(sp.PRD_QT_P AS UNSIGNED))
    - SUM(CAST(sp.PRD_QT_A AS UNSIGNED))            AS qtd_glosada,
    SUM(CAST(sp.PRD_VL_P AS DECIMAL(15,2)))         AS valor_apresentado,
    SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2)))         AS valor_aprovado,
    SUM(CAST(sp.PRD_VL_P AS DECIMAL(15,2)))
    - SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2)))       AS valor_glosado,
    ROUND(
        (SUM(CAST(sp.PRD_VL_P AS DECIMAL(15,2)))
         - SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2)))) * 100.0
        / NULLIF(SUM(CAST(sp.PRD_VL_P AS DECIMAL(15,2))), 0)
    , 2)                                            AS taxa_glosa_pct
FROM s_prd sp
LEFT JOIN prestador pr ON sp.prd_uid COLLATE utf8mb4_unicode_ci = pr.re_cunid COLLATE utf8mb4_unicode_ci
WHERE sp.prd_cmp = '202501'
GROUP BY sp.prd_uid, pr.re_cnome
HAVING taxa_glosa_pct > 0
ORDER BY taxa_glosa_pct DESC;
```

---

### 4.6 Top procedimentos por volume

```sql
SELECT
    sp.prd_pa                                       AS procedimento_codigo,
    pc.procedimento                                 AS procedimento_nome,
    CAST(pc.PA_TOTAL AS DECIMAL(15,2))              AS valor_unitario,
    SUM(CAST(sp.PRD_QT_A AS UNSIGNED))             AS qtd_aprovada,
    SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2)))        AS valor_aprovado
FROM s_prd sp
LEFT JOIN procedimento pc ON sp.prd_pa COLLATE utf8mb4_unicode_ci = pc.codigo COLLATE utf8mb4_unicode_ci
WHERE sp.prd_cmp = '202501'
GROUP BY sp.prd_pa, pc.procedimento, pc.PA_TOTAL
ORDER BY qtd_aprovada DESC
LIMIT 20;
```

---

### 4.7 Produção por tipo de financiamento (rubrica)

```sql
SELECT
    LEFT(sp.PRD_RUB, 4)                            AS rubrica_codigo,
    sr.RUB_DC                                       AS rubrica_descricao,
    SUM(CAST(sp.PRD_QT_A AS UNSIGNED))             AS qtd_aprovada,
    SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2)))        AS valor_aprovado,
    COUNT(DISTINCT sp.prd_uid)                      AS qtd_prestadores
FROM s_prd sp
LEFT JOIN s_rub sr ON LEFT(sp.PRD_RUB,4) COLLATE utf8mb4_unicode_ci = sr.RUB_ID COLLATE utf8mb4_unicode_ci
WHERE sp.prd_cmp = '202501'
GROUP BY LEFT(sp.PRD_RUB,4), sr.RUB_DC
ORDER BY valor_aprovado DESC;
```

---

### 4.8 Matriz pivot — produção mensal por prestador

```sql
SELECT
    sp.prd_uid                                      AS cnes,
    pr.re_cnome                                     AS prestador,
    SUM(CASE WHEN sp.prd_cmp = '202410' THEN CAST(sp.PRD_VL_A AS DECIMAL(15,2)) ELSE 0 END) AS out_2024,
    SUM(CASE WHEN sp.prd_cmp = '202411' THEN CAST(sp.PRD_VL_A AS DECIMAL(15,2)) ELSE 0 END) AS nov_2024,
    SUM(CASE WHEN sp.prd_cmp = '202412' THEN CAST(sp.PRD_VL_A AS DECIMAL(15,2)) ELSE 0 END) AS dez_2024,
    SUM(CASE WHEN sp.prd_cmp = '202501' THEN CAST(sp.PRD_VL_A AS DECIMAL(15,2)) ELSE 0 END) AS jan_2025,
    SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2)))        AS total_periodo
FROM s_prd sp
LEFT JOIN prestador pr ON sp.prd_uid COLLATE utf8mb4_unicode_ci = pr.re_cunid COLLATE utf8mb4_unicode_ci
WHERE sp.prd_cmp BETWEEN '202410' AND '202501'
GROUP BY sp.prd_uid, pr.re_cnome
ORDER BY total_periodo DESC;
```

---

### 4.9 Faixa etária dos atendimentos

```sql
SELECT
    CASE
        WHEN CAST(sp.PRD_IDADE AS SIGNED) > 150 THEN 'Ignorado'
        WHEN CAST(sp.PRD_IDADE AS SIGNED) = 0   THEN 'Menor que 1 ano'
        WHEN CAST(sp.PRD_IDADE AS SIGNED) <= 9  THEN '1 a 9 anos'
        WHEN CAST(sp.PRD_IDADE AS SIGNED) BETWEEN 10 AND 17 THEN '10 a 17 anos'
        WHEN CAST(sp.PRD_IDADE AS SIGNED) BETWEEN 18 AND 59 THEN '18 a 59 anos'
        WHEN CAST(sp.PRD_IDADE AS SIGNED) >= 60 THEN '60 anos ou mais'
        ELSE 'Ignorado'
    END                                            AS faixa_etaria,
    SUM(CAST(sp.PRD_QT_A AS UNSIGNED))            AS qtd_aprovada,
    SUM(CAST(sp.PRD_VL_A AS DECIMAL(15,2)))       AS valor_aprovado
FROM s_prd sp
WHERE sp.prd_cmp = '202501'
  AND CAST(sp.PRD_IDADE AS SIGNED) <= 150         -- excluir idades inválidas
GROUP BY faixa_etaria
ORDER BY FIELD(faixa_etaria,
    'Menor que 1 ano','1 a 9 anos','10 a 17 anos',
    '18 a 59 anos','60 anos ou mais','Ignorado');
```

---

## 5. Regras e Armadilhas

| Regra | Detalhe |
|---|---|
| **Filtrar por competência SEMPRE** | 5.9M registros sem filtro = timeout garantido |
| **CAST em PRD_QT_* e PRD_VL_*** | Evitar overflow e erros de agregação |
| **JOINs com COLLATE** | `s_prd` (unicode_ci) × `forma`, `prestador`, `cbo`, `s_rub` (general_ci) — usar COLLATE explícito |
| **PRD_RUB tem 6 chars, RUB_ID tem 4** | Usar `LEFT(sp.PRD_RUB, 4)` no JOIN com `s_rub` |
| **prd_uid vs re_cunid** | Ambos são varchar — não são inteiros apesar de serem numéricos |
| **PRD_IDADE > 150 = inválido** | Filtrar ou tratar com CASE WHEN |
| **Sem FK físicas** | Pode haver registros órfãos — usar LEFT JOIN, não INNER JOIN por padrão |
| **Collation CBO** | `cbo` usa `latin1_swedish_ci` — pode precisar de conversão em comparações |
| **prd_cmp é string lexicográfica** | `BETWEEN '202401' AND '202412'` funciona corretamente para intervalos dentro do mesmo ano |

---

## 6. Valores de Referência

### Tipos de financiamento comuns (s_rub)

| RUB_ID | Descrição típica |
|---|---|
| `0101` | Atenção Básica |
| `0301` | MAC - Média/Alta Complexidade |
| `0602` | Faec |
| `0604` | Tratamento Fora do Domicílio |

### Grupos de procedimento (forma.grupo)

| grupo | Descrição típica |
|---|---|
| `01` | Ações de Promoção e Prevenção em Saúde |
| `02` | Procedimentos com Finalidade Diagnóstica |
| `03` | Procedimentos Clínicos |
| `04` | Procedimentos Cirúrgicos |
| `05` | Transplantes de Órgãos, Tecidos e Células |
| `06` | Medicamentos |
| `07` | Órteses, Próteses e Materiais Especiais |
| `08` | Ações Complementares da Atenção à Saúde |

---

## 7. Checklist para Gerar Novos Relatórios

- [ ] Tem filtro de `prd_cmp` (competência)?
- [ ] Usou `CAST` em todos os campos numéricos de `s_prd`?
- [ ] JOINs com `COLLATE` onde necessário?
- [ ] `LEFT(PRD_RUB, 4)` no JOIN com `s_rub`?
- [ ] `NULLIF` no denominador de divisões (evitar divisão por zero)?
- [ ] `GROUP BY` inclui todos os campos não-agregados do SELECT?
- [ ] Faixa etária trata `PRD_IDADE > 150` como inválido?
