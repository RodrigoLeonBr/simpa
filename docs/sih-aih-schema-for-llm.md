# Schema SIH/AIH — Guia para Geração de Relatórios e KPIs

> Documento técnico para uso por LLMs.  
> Banco: `producao` (MariaDB 10.4 / MySQL 5.7+)  
> Módulos: `/relatorios/aih` (internações) e `/relatorios/aih-pa` (procedimentos por internação)  
> Sistema de origem: **SIHD** (Sistema de Informações Hospitalares — módulo Decisor)

---

## 1. Visão Geral do Modelo

```
s_aih     ←──────→  prestador     (via s_aih.CNES          = prestador.re_cunid)
s_aih     ←──────→  procedimento  (via s_aih.PROC_PRINCIPAL = procedimento.codigo)
s_aih     ←──────→  s_rub         (via s_aih.FINANCIAMENTO  = s_rub.RUB_ID)
s_aih     ←──────→  forma         (via SUBSTRING(s_aih.PROC_PRINCIPAL,1,2/4/6))

s_aih_pa  ←──────→  s_aih         (via s_aih_pa.AIH + CNES + COMPETENCIA)
s_aih_pa  ←──────→  prestador     (via s_aih_pa.CNES              = prestador.re_cunid)
s_aih_pa  ←──────→  procedimento  (via s_aih_pa.PROC_DETALHADO     = procedimento.codigo)
s_aih_pa  ←──────→  cbo           (via s_aih_pa.CBO_PROFISSIONAL   = cbo.CBO)
s_aih_pa  ←──────→  s_rub         (via s_aih_pa.FINANCIAMENTO_DETALHE = s_rub.RUB_ID)
s_aih_pa  ←──────→  forma         (via SUBSTRING(s_aih_pa.PROC_DETALHADO,1,2/4/6))
```

**Tabela de cabeçalho:** `s_aih` — uma linha por internação (AIH).  
**Tabela de itens:** `s_aih_pa` — múltiplas linhas por AIH (um item por procedimento realizado).  
**Dimensões compartilhadas:** `prestador`, `procedimento`, `cbo`, `s_rub`, `forma` — mesmas do módulo SIA.

---

## 2. Tabelas — Schema Detalhado

### 2.1 `s_aih` — Resumo das Internações (cabeçalho AIH)

**Engine:** InnoDB | **Charset:** utf8mb4_unicode_ci  
**Origem:** arquivo `.txt` exportado da tabela `TB_HAIH` do SIHD  
**Formato de importação:** 18 colunas, separador `;`, sem linha de cabeçalho, decimal BR (vírgula)

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | bigint UNSIGNED | PK AUTO_INCREMENT |
| `AIH` | varchar(13) | Número da AIH — chave natural (`ah_num_aih`) |
| `CNES` | varchar(7) | CNES da unidade → `prestador.re_cunid` |
| `COMPETENCIA` | varchar(6) | Competência **AAAAMM** (ex: `202501`) |
| `DT_NASC` | varchar(8) | Data de nascimento **AAAAMMDD** (`ah_paciente_dt_nascimento`) |
| `IDADE` | int | Idade em anos completos na data da internação |
| `SEXO_PACIENTE` | varchar(1) | `M` ou `F` |
| `DT_INT` | varchar(8) | Data de internação **AAAAMMDD** (`ah_dt_internacao`) |
| `DT_SAIDA` | varchar(8) | Data de saída **AAAAMMDD** (`ah_dt_saida`) |
| `ESPECIALIDADE` | varchar(3) | Código de especialidade (`ah_especialidade`) |
| `PROC_PRINCIPAL` | varchar(10) | Procedimento principal 10 dígitos → `procedimento.codigo` |
| `DIAG_PRINCIPAL` | varchar(4) | CID-10 principal (`ah_diag_pri`) |
| `DIAG_SECUNDARIO` | varchar(4) | CID-10 secundário (`ah_diag_sec`) |
| `COMPLEXIDADE` | varchar(2) | Complexidade da internação |
| `FINANCIAMENTO` | varchar(2) | Código de financiamento → `s_rub.RUB_ID` |
| `ENFERMARIA` | varchar(4) | Código de enfermaria/leito |
| `CARATER_INTERNACAO` | varchar(2) | Caráter da internação (01 eletiva, 02 urgência, …) |
| `MOTIVO_SAIDA` | varchar(2) | Motivo de saída (`ah_mot_saida`) |
| `CID_OBITO` | varchar(4) | CID-10 do óbito, quando houver |
| `DIARIAS` | int | Total de diárias da internação |
| `DIARIAS_UTI` | int | Diárias em UTI |
| `VALOR_TOTAL_AIH` | decimal(12,2) | Valor total da AIH (pré-calculado: `SUM(TB_HPA.pa_valor)` no SIHD) |

**Índices:**
```sql
PRIMARY KEY (id)
UNIQUE KEY uk_aih (AIH, CNES, COMPETENCIA)   -- mesma AIH pode aparecer em competências diferentes
KEY idx_aih_cnes     (CNES)
KEY idx_aih_cmp      (COMPETENCIA)
KEY idx_aih_cnes_cmp (CNES, COMPETENCIA)
```

> A chave única é `(AIH, CNES, COMPETENCIA)` — o mesmo número de AIH pode existir em competências diferentes (internações longas que transitam entre meses).

---

### 2.2 `s_aih_pa` — Procedimentos por Internação (itens AIH)

**Engine:** InnoDB | **Charset:** utf8mb4_unicode_ci  
**Origem:** arquivo `.txt` exportado da tabela `TB_HPA` do SIHD  
**Formato de importação:** 8 colunas, separador `;`, sem linha de cabeçalho, decimal BR (vírgula)

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | bigint UNSIGNED | PK AUTO_INCREMENT |
| `AIH` | varchar(13) | Número da AIH → chave para JOIN com `s_aih.AIH` |
| `CNES` | varchar(7) | CNES da unidade → `prestador.re_cunid` |
| `COMPETENCIA` | varchar(6) | Competência **AAAAMM** |
| `PROC_DETALHADO` | varchar(10) | Código do procedimento realizado 10 dígitos → `procedimento.codigo` |
| `QUANTIDADE` | int | Quantidade produzida |
| `VALOR_ITEM` | decimal(12,2) | Valor do item (`pa_valor`) |
| `FINANCIAMENTO_DETALHE` | varchar(2) | Código de financiamento → `s_rub.RUB_ID` |
| `CBO_PROFISSIONAL` | varchar(6) | CBO do profissional → `cbo.CBO` |

**Índices:**
```sql
PRIMARY KEY (id)
KEY idx_aih_pa_aih      (AIH)
KEY idx_aih_pa_cnes     (CNES)
KEY idx_aih_pa_cmp      (COMPETENCIA)
KEY idx_aih_pa_cnes_cmp (CNES, COMPETENCIA)
```

---

### 2.3 Dimensões compartilhadas com SIA

Consultar `docs/sia-schema-for-llm.md` para schema completo de:
- `prestador` — unidades de saúde (JOIN via CNES)
- `procedimento` — tabela SUS (JOIN via código 10 dígitos)
- `cbo` — ocupações (JOIN via código CBO 6 dígitos)
- `s_rub` — rubricas/financiamento (JOIN via RUB_ID 2 dígitos aqui, diferente dos 4 do SIA)
- `forma` — hierarquia grupo/subgrupo/forma dos procedimentos SUS

---

## 3. Padrões de Query

### 3.1 Diferenças importantes em relação ao módulo SIA (`s_prd`)

| Aspecto | SIA (`s_prd`) | SIH (`s_aih` / `s_aih_pa`) |
|---|---|---|
| Campos numéricos | varchar — precisa de `CAST` | `int` / `decimal` — **sem CAST necessário** |
| Financiamento | `PRD_RUB` varchar(6), usar `LEFT(…,4)` | `FINANCIAMENTO` varchar(2) direto = `RUB_ID` |
| Collation tabelas | utf8mb4_general_ci (legado) | utf8mb4_unicode_ci (migration Laravel) |
| Procedimento | `prd_pa` | `PROC_PRINCIPAL` (s_aih) / `PROC_DETALHADO` (s_aih_pa) |
| Hierarquia gerada | Colunas `grupo`, `subgrupo`, `forma` STORED | SUBSTRING em runtime |
| Valor | Apresentado + Aprovado separados | `VALOR_TOTAL_AIH` pré-calculado (s_aih) |

### 3.2 Collation nos JOINs

`s_aih` e `s_aih_pa` usam `utf8mb4_unicode_ci`. As dimensões usam collations variadas:

```sql
-- prestador: utf8mb4_general_ci (MyISAM legado)
LEFT JOIN prestador pr
    ON sa.CNES COLLATE utf8mb4_unicode_ci = pr.re_cunid COLLATE utf8mb4_unicode_ci

-- procedimento: utf8mb4_general_ci (MyISAM legado)
LEFT JOIN procedimento pc
    ON sa.PROC_PRINCIPAL COLLATE utf8mb4_unicode_ci = pc.codigo COLLATE utf8mb4_unicode_ci

-- cbo: latin1_swedish_ci — pode precisar de CONVERT
LEFT JOIN cbo cb
    ON sp.CBO_PROFISSIONAL COLLATE utf8mb4_unicode_ci = cb.CBO COLLATE utf8mb4_unicode_ci

-- s_rub: utf8mb4_general_ci — FINANCIAMENTO (2 chars) = RUB_ID direto
LEFT JOIN s_rub sr
    ON sa.FINANCIAMENTO COLLATE utf8mb4_unicode_ci = sr.RUB_ID COLLATE utf8mb4_unicode_ci

-- forma: utf8mb4_general_ci — SEMPRE usar COLLATE utf8mb4_general_ci no JOIN
LEFT JOIN forma fg
    ON SUBSTRING(sa.PROC_PRINCIPAL,1,2) COLLATE utf8mb4_general_ci = fg.grupo COLLATE utf8mb4_general_ci
    AND fg.subgrupo COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sa.PROC_PRINCIPAL,1,2),'00') COLLATE utf8mb4_general_ci
    AND fg.forma    COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sa.PROC_PRINCIPAL,1,2),'0000') COLLATE utf8mb4_general_ci
```

### 3.3 JOIN entre s_aih e s_aih_pa

Use as três colunas para evitar ambiguidade (mesma AIH pode existir em competências diferentes):

```sql
s_aih sa
LEFT JOIN s_aih_pa sp
    ON sp.AIH         COLLATE utf8mb4_unicode_ci = sa.AIH         COLLATE utf8mb4_unicode_ci
    AND sp.CNES        COLLATE utf8mb4_unicode_ci = sa.CNES        COLLATE utf8mb4_unicode_ci
    AND sp.COMPETENCIA COLLATE utf8mb4_unicode_ci = sa.COMPETENCIA COLLATE utf8mb4_unicode_ci
```

### 3.4 Hierarquia de procedimentos (forma)

Igual ao SIA — código 10 dígitos tem estrutura:
```
P  R  O  C  _  _  P  R  O  C
│──┘  │────┘  │──────┘  │────┘
grupo subgrupo  forma    proc
 (2)    (4)      (6)      (10)
```

```sql
-- Só grupo (2 chars):
LEFT JOIN forma fg
    ON SUBSTRING(sa.PROC_PRINCIPAL,1,2) COLLATE utf8mb4_general_ci = fg.grupo COLLATE utf8mb4_general_ci
    AND fg.subgrupo COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sa.PROC_PRINCIPAL,1,2),'00') COLLATE utf8mb4_general_ci
    AND fg.forma    COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sa.PROC_PRINCIPAL,1,2),'0000') COLLATE utf8mb4_general_ci

-- Só subgrupo (4 chars):
LEFT JOIN forma fs
    ON SUBSTRING(sa.PROC_PRINCIPAL,1,4) COLLATE utf8mb4_general_ci = fs.subgrupo COLLATE utf8mb4_general_ci
    AND fs.forma COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sa.PROC_PRINCIPAL,1,4),'00') COLLATE utf8mb4_general_ci

-- Só forma (6 chars):
LEFT JOIN forma ff
    ON SUBSTRING(sa.PROC_PRINCIPAL,1,6) COLLATE utf8mb4_general_ci = ff.forma COLLATE utf8mb4_general_ci
```

### 3.5 Template de query — s_aih (cabeçalho)

```sql
SELECT
    /* Dimensões */
    CONCAT(SUBSTRING(sa.COMPETENCIA,5,2),'/',
           SUBSTRING(sa.COMPETENCIA,1,4))           AS competencia,
    sa.CNES,
    pr.re_cnome                                      AS prestador,
    sa.PROC_PRINCIPAL                                AS procedimento_codigo,
    pc.procedimento                                  AS procedimento_nome,
    SUBSTRING(sa.PROC_PRINCIPAL,1,2)                AS grupo_codigo,
    fg.descricao                                     AS grupo_descricao,
    sa.DIAG_PRINCIPAL                                AS cid_principal,
    sa.FINANCIAMENTO                                 AS financiamento_codigo,
    sr.RUB_DC                                        AS financiamento_descricao,
    sa.SEXO_PACIENTE,
    sa.MOTIVO_SAIDA,
    sa.COMPLEXIDADE,

    /* Métricas */
    COUNT(DISTINCT sa.AIH)                           AS qtd_aih,
    SUM(sa.DIARIAS)                                  AS total_diarias,
    SUM(sa.DIARIAS_UTI)                              AS total_diarias_uti,
    SUM(sa.VALOR_TOTAL_AIH)                          AS total_valor,
    AVG(sa.IDADE)                                    AS media_idade,
    AVG(sa.DIARIAS)                                  AS media_diarias

FROM s_aih sa
LEFT JOIN prestador   pr ON sa.CNES           COLLATE utf8mb4_unicode_ci = pr.re_cunid  COLLATE utf8mb4_unicode_ci
LEFT JOIN procedimento pc ON sa.PROC_PRINCIPAL COLLATE utf8mb4_unicode_ci = pc.codigo   COLLATE utf8mb4_unicode_ci
LEFT JOIN s_rub        sr ON sa.FINANCIAMENTO  COLLATE utf8mb4_unicode_ci = sr.RUB_ID   COLLATE utf8mb4_unicode_ci
LEFT JOIN forma        fg
    ON SUBSTRING(sa.PROC_PRINCIPAL,1,2) COLLATE utf8mb4_general_ci = fg.grupo COLLATE utf8mb4_general_ci
    AND fg.subgrupo COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sa.PROC_PRINCIPAL,1,2),'00') COLLATE utf8mb4_general_ci
    AND fg.forma    COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sa.PROC_PRINCIPAL,1,2),'0000') COLLATE utf8mb4_general_ci

WHERE sa.COMPETENCIA = '202501'         -- OBRIGATÓRIO
  -- AND sa.CNES = '2058790'            -- opcional
  -- AND sa.DIAG_PRINCIPAL LIKE 'F%'    -- opcional: por CID

GROUP BY
    sa.COMPETENCIA, sa.CNES, pr.re_cnome,
    sa.PROC_PRINCIPAL, pc.procedimento,
    SUBSTRING(sa.PROC_PRINCIPAL,1,2), fg.descricao,
    sa.DIAG_PRINCIPAL, sa.FINANCIAMENTO, sr.RUB_DC,
    sa.SEXO_PACIENTE, sa.MOTIVO_SAIDA, sa.COMPLEXIDADE

ORDER BY total_valor DESC;
```

### 3.6 Template de query — s_aih_pa (procedimentos)

```sql
SELECT
    CONCAT(SUBSTRING(sp.COMPETENCIA,5,2),'/',
           SUBSTRING(sp.COMPETENCIA,1,4))           AS competencia,
    sp.CNES,
    pr.re_cnome                                      AS prestador,
    sp.PROC_DETALHADO                                AS procedimento_codigo,
    pc.procedimento                                  AS procedimento_nome,
    SUBSTRING(sp.PROC_DETALHADO,1,2)                AS grupo_codigo,
    fg.descricao                                     AS grupo_descricao,
    sp.CBO_PROFISSIONAL                              AS cbo_codigo,
    cb.DS_CBO                                        AS cbo_descricao,
    sp.FINANCIAMENTO_DETALHE                         AS financiamento_codigo,
    sr.RUB_DC                                        AS financiamento_descricao,

    /* Métricas */
    COUNT(DISTINCT sp.AIH)                           AS qtd_aih_distintas,
    SUM(sp.QUANTIDADE)                               AS total_quantidade,
    SUM(sp.VALOR_ITEM)                               AS total_valor

FROM s_aih_pa sp
LEFT JOIN prestador   pr ON sp.CNES               COLLATE utf8mb4_unicode_ci = pr.re_cunid COLLATE utf8mb4_unicode_ci
LEFT JOIN procedimento pc ON sp.PROC_DETALHADO     COLLATE utf8mb4_unicode_ci = pc.codigo  COLLATE utf8mb4_unicode_ci
LEFT JOIN cbo          cb ON sp.CBO_PROFISSIONAL   COLLATE utf8mb4_unicode_ci = cb.CBO     COLLATE utf8mb4_unicode_ci
LEFT JOIN s_rub        sr ON sp.FINANCIAMENTO_DETALHE COLLATE utf8mb4_unicode_ci = sr.RUB_ID COLLATE utf8mb4_unicode_ci
LEFT JOIN forma        fg
    ON SUBSTRING(sp.PROC_DETALHADO,1,2) COLLATE utf8mb4_general_ci = fg.grupo COLLATE utf8mb4_general_ci
    AND fg.subgrupo COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sp.PROC_DETALHADO,1,2),'00') COLLATE utf8mb4_general_ci
    AND fg.forma    COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sp.PROC_DETALHADO,1,2),'0000') COLLATE utf8mb4_general_ci

WHERE sp.COMPETENCIA = '202501'         -- OBRIGATÓRIO
  -- AND sp.CNES = '2058790'
  -- AND sp.PROC_DETALHADO LIKE '03%'

GROUP BY
    sp.COMPETENCIA, sp.CNES, pr.re_cnome,
    sp.PROC_DETALHADO, pc.procedimento,
    SUBSTRING(sp.PROC_DETALHADO,1,2), fg.descricao,
    sp.CBO_PROFISSIONAL, cb.DS_CBO,
    sp.FINANCIAMENTO_DETALHE, sr.RUB_DC

ORDER BY total_valor DESC;
```

---

## 4. KPIs e Indicadores — Exemplos Prontos

### 4.1 Resumo de internações por competência

```sql
SELECT
    CONCAT(SUBSTRING(sa.COMPETENCIA,5,2),'/',
           SUBSTRING(sa.COMPETENCIA,1,4))     AS competencia,
    COUNT(DISTINCT sa.AIH)                    AS total_aih,
    COUNT(DISTINCT sa.CNES)                   AS qtd_prestadores,
    SUM(sa.DIARIAS)                           AS total_diarias,
    SUM(sa.DIARIAS_UTI)                       AS total_diarias_uti,
    SUM(sa.VALOR_TOTAL_AIH)                   AS total_valor,
    ROUND(AVG(sa.DIARIAS), 1)                 AS media_diarias_por_aih,
    ROUND(AVG(sa.VALOR_TOTAL_AIH), 2)         AS ticket_medio_aih,
    ROUND(SUM(sa.DIARIAS_UTI) * 100.0
          / NULLIF(SUM(sa.DIARIAS), 0), 2)    AS pct_diarias_uti
FROM s_aih sa
WHERE sa.COMPETENCIA = '202501'
GROUP BY sa.COMPETENCIA;
```

---

### 4.2 Ranking de prestadores por internações e valor

```sql
SELECT
    sa.CNES,
    pr.re_cnome                               AS prestador,
    COUNT(DISTINCT sa.AIH)                    AS qtd_aih,
    SUM(sa.DIARIAS)                           AS total_diarias,
    SUM(sa.DIARIAS_UTI)                       AS diarias_uti,
    SUM(sa.VALOR_TOTAL_AIH)                   AS total_valor,
    ROUND(AVG(sa.DIARIAS), 1)                 AS media_permanencia,
    ROUND(AVG(sa.VALOR_TOTAL_AIH), 2)         AS ticket_medio,
    ROUND(SUM(sa.VALOR_TOTAL_AIH) * 100.0
          / SUM(SUM(sa.VALOR_TOTAL_AIH)) OVER (), 2) AS participacao_pct
FROM s_aih sa
LEFT JOIN prestador pr ON sa.CNES COLLATE utf8mb4_unicode_ci = pr.re_cunid COLLATE utf8mb4_unicode_ci
WHERE sa.COMPETENCIA = '202501'
GROUP BY sa.CNES, pr.re_cnome
ORDER BY total_valor DESC;
```

---

### 4.3 Taxa de ocupação UTI por prestador

```sql
SELECT
    sa.CNES,
    pr.re_cnome                               AS prestador,
    COUNT(DISTINCT sa.AIH)                    AS total_aih,
    SUM(sa.DIARIAS)                           AS total_diarias,
    SUM(sa.DIARIAS_UTI)                       AS total_diarias_uti,
    COUNT(DISTINCT CASE WHEN sa.DIARIAS_UTI > 0 THEN sa.AIH END) AS aih_com_uti,
    ROUND(SUM(sa.DIARIAS_UTI) * 100.0
          / NULLIF(SUM(sa.DIARIAS), 0), 2)    AS pct_diarias_uti,
    ROUND(COUNT(DISTINCT CASE WHEN sa.DIARIAS_UTI > 0 THEN sa.AIH END) * 100.0
          / NULLIF(COUNT(DISTINCT sa.AIH), 0), 2) AS pct_aih_com_uti
FROM s_aih sa
LEFT JOIN prestador pr ON sa.CNES COLLATE utf8mb4_unicode_ci = pr.re_cunid COLLATE utf8mb4_unicode_ci
WHERE sa.COMPETENCIA = '202501'
GROUP BY sa.CNES, pr.re_cnome
HAVING total_aih > 0
ORDER BY pct_diarias_uti DESC;
```

---

### 4.4 Distribuição por diagnóstico (CID-10) — Top 20

```sql
SELECT
    sa.DIAG_PRINCIPAL                         AS cid,
    COUNT(DISTINCT sa.AIH)                    AS qtd_aih,
    SUM(sa.DIARIAS)                           AS total_diarias,
    SUM(sa.VALOR_TOTAL_AIH)                   AS total_valor,
    ROUND(AVG(sa.DIARIAS), 1)                 AS media_permanencia,
    ROUND(COUNT(DISTINCT sa.AIH) * 100.0
          / SUM(COUNT(DISTINCT sa.AIH)) OVER (), 2) AS participacao_pct
FROM s_aih sa
WHERE sa.COMPETENCIA = '202501'
  AND sa.DIAG_PRINCIPAL IS NOT NULL
  AND sa.DIAG_PRINCIPAL != ''
GROUP BY sa.DIAG_PRINCIPAL
ORDER BY qtd_aih DESC
LIMIT 20;
```

---

### 4.5 Distribuição por grupo de CID (capítulo)

```sql
SELECT
    LEFT(sa.DIAG_PRINCIPAL, 1)                AS capitulo_cid,
    CASE LEFT(sa.DIAG_PRINCIPAL, 1)
        WHEN 'A' THEN 'A — Doenças infecciosas e parasitárias'
        WHEN 'B' THEN 'B — Doenças infecciosas e parasitárias'
        WHEN 'C' THEN 'C — Neoplasias malignas'
        WHEN 'D' THEN 'D — Doenças do sangue / Neoplasias in situ'
        WHEN 'E' THEN 'E — Doenças endócrinas'
        WHEN 'F' THEN 'F — Transtornos mentais'
        WHEN 'G' THEN 'G — Doenças do sistema nervoso'
        WHEN 'H' THEN 'H — Doenças olhos/ouvidos'
        WHEN 'I' THEN 'I — Doenças circulatórias'
        WHEN 'J' THEN 'J — Doenças respiratórias'
        WHEN 'K' THEN 'K — Doenças digestivas'
        WHEN 'L' THEN 'L — Doenças da pele'
        WHEN 'M' THEN 'M — Doenças musculoesqueléticas'
        WHEN 'N' THEN 'N — Doenças geniturinárias'
        WHEN 'O' THEN 'O — Gravidez, parto e puerpério'
        WHEN 'P' THEN 'P — Afecções perinatais'
        WHEN 'Q' THEN 'Q — Malformações congênitas'
        WHEN 'R' THEN 'R — Sintomas e sinais inespecíficos'
        WHEN 'S' THEN 'S — Lesões e traumatismos'
        WHEN 'T' THEN 'T — Intoxicações e causas externas'
        WHEN 'V' THEN 'V/W/X/Y — Causas externas'
        WHEN 'Z' THEN 'Z — Fatores que influenciam a saúde'
        ELSE 'Outros / Ignorado'
    END                                       AS descricao_capitulo,
    COUNT(DISTINCT sa.AIH)                    AS qtd_aih,
    SUM(sa.DIARIAS)                           AS total_diarias,
    SUM(sa.VALOR_TOTAL_AIH)                   AS total_valor
FROM s_aih sa
WHERE sa.COMPETENCIA = '202501'
GROUP BY LEFT(sa.DIAG_PRINCIPAL, 1)
ORDER BY qtd_aih DESC;
```

---

### 4.6 Faixa etária dos internados

```sql
SELECT
    CASE
        WHEN sa.IDADE IS NULL OR sa.IDADE > 150 THEN 'Ignorado'
        WHEN sa.IDADE = 0   THEN 'Menor que 1 ano'
        WHEN sa.IDADE BETWEEN 1  AND 4  THEN '1 a 4 anos'
        WHEN sa.IDADE BETWEEN 5  AND 9  THEN '5 a 9 anos'
        WHEN sa.IDADE BETWEEN 10 AND 14 THEN '10 a 14 anos'
        WHEN sa.IDADE BETWEEN 15 AND 17 THEN '15 a 17 anos'
        WHEN sa.IDADE BETWEEN 18 AND 39 THEN '18 a 39 anos'
        WHEN sa.IDADE BETWEEN 40 AND 59 THEN '40 a 59 anos'
        WHEN sa.IDADE BETWEEN 60 AND 79 THEN '60 a 79 anos'
        WHEN sa.IDADE >= 80 THEN '80 anos ou mais'
    END                                       AS faixa_etaria,
    sa.SEXO_PACIENTE,
    COUNT(DISTINCT sa.AIH)                    AS qtd_aih,
    SUM(sa.DIARIAS)                           AS total_diarias,
    ROUND(AVG(sa.DIARIAS), 1)                 AS media_permanencia,
    SUM(sa.VALOR_TOTAL_AIH)                   AS total_valor
FROM s_aih sa
WHERE sa.COMPETENCIA = '202501'
GROUP BY faixa_etaria, sa.SEXO_PACIENTE
ORDER BY FIELD(faixa_etaria,
    'Menor que 1 ano','1 a 4 anos','5 a 9 anos','10 a 14 anos',
    '15 a 17 anos','18 a 39 anos','40 a 59 anos','60 a 79 anos',
    '80 anos ou mais','Ignorado'), sa.SEXO_PACIENTE;
```

---

### 4.7 Série histórica de internações mensais

```sql
SELECT
    sa.COMPETENCIA,
    CONCAT(SUBSTRING(sa.COMPETENCIA,5,2),'/',
           SUBSTRING(sa.COMPETENCIA,1,4))     AS mes_ano,
    COUNT(DISTINCT sa.AIH)                    AS qtd_aih,
    SUM(sa.DIARIAS)                           AS total_diarias,
    SUM(sa.DIARIAS_UTI)                       AS total_diarias_uti,
    SUM(sa.VALOR_TOTAL_AIH)                   AS total_valor,
    ROUND(AVG(sa.DIARIAS), 1)                 AS media_permanencia
FROM s_aih sa
WHERE sa.COMPETENCIA BETWEEN '202401' AND '202412'
  -- AND sa.CNES = '2058790'
GROUP BY sa.COMPETENCIA
ORDER BY sa.COMPETENCIA;
```

---

### 4.8 Permanência média e giro de leito por especialidade

```sql
SELECT
    sa.ESPECIALIDADE,
    COUNT(DISTINCT sa.AIH)                    AS qtd_aih,
    ROUND(AVG(sa.DIARIAS), 1)                 AS media_permanencia,
    ROUND(AVG(sa.DIARIAS_UTI), 2)             AS media_diarias_uti,
    SUM(sa.VALOR_TOTAL_AIH)                   AS total_valor,
    ROUND(AVG(sa.VALOR_TOTAL_AIH), 2)         AS custo_medio_aih
FROM s_aih sa
WHERE sa.COMPETENCIA = '202501'
  AND sa.ESPECIALIDADE IS NOT NULL
GROUP BY sa.ESPECIALIDADE
ORDER BY qtd_aih DESC;
```

---

### 4.9 Procedimentos mais realizados nas internações (s_aih_pa)

```sql
SELECT
    sp.PROC_DETALHADO                         AS procedimento_codigo,
    pc.procedimento                           AS procedimento_nome,
    SUBSTRING(sp.PROC_DETALHADO,1,2)          AS grupo,
    fg.descricao                              AS grupo_descricao,
    COUNT(DISTINCT sp.AIH)                    AS aih_distintas,
    SUM(sp.QUANTIDADE)                        AS total_quantidade,
    SUM(sp.VALOR_ITEM)                        AS total_valor,
    ROUND(AVG(sp.VALOR_ITEM / NULLIF(sp.QUANTIDADE, 0)), 2) AS valor_unitario_medio
FROM s_aih_pa sp
LEFT JOIN procedimento pc
    ON sp.PROC_DETALHADO COLLATE utf8mb4_unicode_ci = pc.codigo COLLATE utf8mb4_unicode_ci
LEFT JOIN forma fg
    ON SUBSTRING(sp.PROC_DETALHADO,1,2) COLLATE utf8mb4_general_ci = fg.grupo COLLATE utf8mb4_general_ci
    AND fg.subgrupo COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sp.PROC_DETALHADO,1,2),'00') COLLATE utf8mb4_general_ci
    AND fg.forma    COLLATE utf8mb4_general_ci = CONCAT(SUBSTRING(sp.PROC_DETALHADO,1,2),'0000') COLLATE utf8mb4_general_ci
WHERE sp.COMPETENCIA = '202501'
GROUP BY sp.PROC_DETALHADO, pc.procedimento, SUBSTRING(sp.PROC_DETALHADO,1,2), fg.descricao
ORDER BY total_valor DESC
LIMIT 20;
```

---

### 4.10 Motivo de saída — distribuição

```sql
SELECT
    sa.MOTIVO_SAIDA,
    CASE sa.MOTIVO_SAIDA
        WHEN '11' THEN 'Alta curado'
        WHEN '12' THEN 'Alta melhorado'
        WHEN '14' THEN 'Alta a pedido'
        WHEN '15' THEN 'Alta com previsão de retorno'
        WHEN '16' THEN 'Alta por evasão'
        WHEN '18' THEN 'Alta por outros motivos'
        WHEN '21' THEN 'Transferência para outro estabelecimento'
        WHEN '23' THEN 'Transferência para internação domiciliar'
        WHEN '31' THEN 'Óbito com declaração'
        WHEN '32' THEN 'Óbito sem declaração'
        WHEN '41' THEN 'Encerramento administrativo'
        WHEN '51' THEN 'Encerramento por absconsa'
        WHEN '61' THEN 'Alta por morte encefálica'
        ELSE CONCAT('Código ', sa.MOTIVO_SAIDA)
    END                                       AS descricao_motivo,
    COUNT(DISTINCT sa.AIH)                    AS qtd_aih,
    ROUND(COUNT(DISTINCT sa.AIH) * 100.0
          / SUM(COUNT(DISTINCT sa.AIH)) OVER (), 2) AS participacao_pct,
    SUM(sa.DIARIAS)                           AS total_diarias,
    SUM(sa.VALOR_TOTAL_AIH)                   AS total_valor
FROM s_aih sa
WHERE sa.COMPETENCIA = '202501'
GROUP BY sa.MOTIVO_SAIDA
ORDER BY qtd_aih DESC;
```

---

### 4.11 Comparativo AIH cabeçalho vs procedimentos (coerência)

```sql
SELECT
    sa.CNES,
    pr.re_cnome                               AS prestador,
    COUNT(DISTINCT sa.AIH)                    AS aih_cabecalho,
    COUNT(DISTINCT sp.AIH)                    AS aih_com_procedimentos,
    COUNT(DISTINCT sa.AIH)
    - COUNT(DISTINCT sp.AIH)                  AS aih_sem_procedimentos,
    SUM(sa.VALOR_TOTAL_AIH)                   AS valor_cabecalho,
    SUM(sp.VALOR_ITEM)                        AS valor_procedimentos,
    SUM(sa.VALOR_TOTAL_AIH) - SUM(sp.VALOR_ITEM) AS diferenca_valor
FROM s_aih sa
LEFT JOIN s_aih_pa sp
    ON sp.AIH          COLLATE utf8mb4_unicode_ci = sa.AIH         COLLATE utf8mb4_unicode_ci
    AND sp.CNES        COLLATE utf8mb4_unicode_ci = sa.CNES        COLLATE utf8mb4_unicode_ci
    AND sp.COMPETENCIA COLLATE utf8mb4_unicode_ci = sa.COMPETENCIA COLLATE utf8mb4_unicode_ci
LEFT JOIN prestador pr ON sa.CNES COLLATE utf8mb4_unicode_ci = pr.re_cunid COLLATE utf8mb4_unicode_ci
WHERE sa.COMPETENCIA = '202501'
GROUP BY sa.CNES, pr.re_cnome
ORDER BY aih_cabecalho DESC;
```

---

### 4.12 Pivot — internações por prestador e mês

```sql
SELECT
    sa.CNES,
    pr.re_cnome                                             AS prestador,
    SUM(CASE WHEN sa.COMPETENCIA='202410' THEN 1 ELSE 0 END) AS out_2024,
    SUM(CASE WHEN sa.COMPETENCIA='202411' THEN 1 ELSE 0 END) AS nov_2024,
    SUM(CASE WHEN sa.COMPETENCIA='202412' THEN 1 ELSE 0 END) AS dez_2024,
    SUM(CASE WHEN sa.COMPETENCIA='202501' THEN 1 ELSE 0 END) AS jan_2025,
    COUNT(DISTINCT sa.AIH)                                  AS total_periodo
FROM s_aih sa
LEFT JOIN prestador pr ON sa.CNES COLLATE utf8mb4_unicode_ci = pr.re_cunid COLLATE utf8mb4_unicode_ci
WHERE sa.COMPETENCIA BETWEEN '202410' AND '202501'
GROUP BY sa.CNES, pr.re_cnome
ORDER BY total_periodo DESC;
```

---

## 5. Regras e Armadilhas

| Regra | Detalhe |
|---|---|
| **Filtrar por COMPETENCIA SEMPRE** | Sem filtro varre toda a tabela |
| **Sem CAST** | `DIARIAS`, `DIARIAS_UTI`, `QUANTIDADE`, `VALOR_ITEM`, `VALOR_TOTAL_AIH` são `int`/`decimal` — soma direta |
| **FINANCIAMENTO = RUB_ID direto** | 2 chars apenas (diferente do SIA que usa 4 chars de PRD_RUB) |
| **JOIN s_aih ↔ s_aih_pa** | Usar as 3 colunas: AIH + CNES + COMPETENCIA |
| **Forma: COLLATE utf8mb4_general_ci** | s_aih/s_aih_pa = unicode_ci, forma = general_ci — obrigatório no JOIN |
| **VALOR_TOTAL_AIH é pré-calculado** | Soma de TB_HPA.pa_valor feita no SIHD. Pode divergir de SUM(s_aih_pa.VALOR_ITEM) por filtragem na origem |
| **DT_NASC / DT_INT / DT_SAIDA são varchar** | Formato AAAAMMDD. Para calcular dias: `DATEDIFF(STR_TO_DATE(DT_SAIDA,'%Y%m%d'), STR_TO_DATE(DT_INT,'%Y%m%d'))` |
| **IDADE > 150 = inválido** | Filtrar com `WHERE sa.IDADE <= 150` ou `AND sa.IDADE IS NOT NULL` |
| **Sem FK físicas** | LEFT JOIN por padrão; pode haver AIH em s_aih_pa sem registro em s_aih |
| **Chave única (AIH, CNES, COMPETENCIA)** | Mesmo número de AIH em competências diferentes = registros distintos válidos |

---

## 6. Cálculos Derivados Úteis

```sql
-- Permanência média em dias (via datas)
DATEDIFF(
    STR_TO_DATE(sa.DT_SAIDA, '%Y%m%d'),
    STR_TO_DATE(sa.DT_INT,   '%Y%m%d')
) AS dias_internacao_calculado

-- Custo por diária
sa.VALOR_TOTAL_AIH / NULLIF(sa.DIARIAS, 0) AS custo_por_diaria

-- Percentual UTI
sa.DIARIAS_UTI / NULLIF(sa.DIARIAS, 0) * 100 AS pct_uti

-- Óbitos (motivo_saida 31 ou 32)
SUM(CASE WHEN sa.MOTIVO_SAIDA IN ('31','32') THEN 1 ELSE 0 END) AS qtd_obitos

-- Taxa de mortalidade
ROUND(
    SUM(CASE WHEN sa.MOTIVO_SAIDA IN ('31','32') THEN 1 ELSE 0 END) * 100.0
    / NULLIF(COUNT(DISTINCT sa.AIH), 0)
, 2) AS taxa_mortalidade_pct

-- Média de procedimentos por internação
COUNT(sp.id) / NULLIF(COUNT(DISTINCT sp.AIH), 0) AS media_procedimentos_por_aih
```

---

## 7. Checklist para Novos Relatórios/KPIs

- [ ] Tem filtro de `COMPETENCIA` (ou intervalo `BETWEEN`)?
- [ ] JOIN s_aih ↔ s_aih_pa usa AIH + CNES + COMPETENCIA?
- [ ] JOINs com `forma` usam `COLLATE utf8mb4_general_ci`?
- [ ] `FINANCIAMENTO` comparado direto com `RUB_ID` (sem LEFT)?
- [ ] `NULLIF` nos denominadores de divisão?
- [ ] `IDADE > 150` tratado como inválido?
- [ ] Datas (DT_NASC, DT_INT, DT_SAIDA) convertidas com `STR_TO_DATE(…,'%Y%m%d')` antes de calcular diferenças?
- [ ] `GROUP BY` inclui todos os campos não-agregados do SELECT?
