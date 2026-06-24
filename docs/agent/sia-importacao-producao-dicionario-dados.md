# SIA — Dicionario de Dados (Importacao de Producao)

Documento de referencia para gestor, desenvolvedores e LLMs criarem indicadores em:

- `/cadastros/indicadores-painel`
- Indicadores e metas do menu cadastro

Foco:

- dados de producao SIA importados do MySQL
- semantica de campos
- como consultar e interpretar para metricas

## 1) Tabelas centrais

## 1.1 `sia_sincronizacoes`

Controle por competencia.

Campos:

- `id` (PK)
- `competencia` (UNIQUE)
- `status` (`pendente`, `ok`, `parcial`, `erro`)
- `registros` (linhas apos transformacao/consolidacao para carga)
- `erros` (linhas/chunks com falha na gravacao)
- `sincronizado_em`

Uso analitico:

- KPI de saude do pipeline (sucesso, parcialidade, tendencia de erros).
- base para gate de reimportacao por competencia.

## 1.2 `sia_producao`

Fato principal de producao ambulatorial.

Campos relevantes:

- `id` (PK)
- `sincronizacao_id` (FK -> `sia_sincronizacoes.id`)
- `competencia`
- `unidade` (texto legado)
- `cnes`
- `estabelecimento_id` (FK opcional -> `estabelecimentos.id`)
- `codigo_sigtap`, `descricao`
- `quantidade`
- `quantidade_apresentada`
- `valor_aprovado`
- `valor_apresentado`
- `faixa_etaria`
- `sexo` (`M`, `F`, `I`)
- `cbo`
- `rubrica`
- `dados_extras` (jsonb)

Constraint de grao:

- `uq_sia_producao_grupo_cnes`
  - UNIQUE NULLS NOT DISTINCT em:
    - `sincronizacao_id`, `cnes`, `codigo_sigtap`, `faixa_etaria`, `sexo`, `cbo`, `rubrica`

Interpretacao:

- representa producao consolidada no grao util para analise por procedimento/demografia/cbo/rubrica.
- `estabelecimento_id` pode ser nulo quando nao houve match de CNES (`orphan_cnes`).

## 1.3 Tabelas de referencia para enriquecimento de producao

## `formas_sia`

- chave: `codigo_forma` (6 chars)
- usada para derivar `descricao_forma` via codigo de procedimento (`codigo_sigtap` -> forma canonica)

## `cbos_sia`

- chave: `codigo_cbo` (6 chars)
- usada para derivar `descricao_cbo` a partir de `sia_producao.cbo` canonizado

## `rubricas_sia`

- chave: `codigo_rubrica` (4 chars)
- permite mapear classificacoes de rubrica em analises especificas

## 1.4 Tabelas relacionadas de contexto

- `estabelecimentos`:
  - resolve identidade por `codigo_externo` (CNES/unidade de origem)
- `dados_consolidados`:
  - destino de consolidacao pos-sync para consumo do dashboard
- `painel_metricas_catalogo` / `painel_widgets`:
  - governanca de metricas e widgets que podem consumir dados SIA

## 2) Regras de interpretacao dos campos

- `competencia`: usar primeiro dia do mes (`YYYY-MM-01`).
- `faixa_etaria`: grupo do SIA normalizado no ETL (texto).
- `sexo`:
  - `M` masculino
  - `F` feminino
  - `I` ignorado/indeterminado/nao informado
- `quantidade` vs `quantidade_apresentada`:
  - manter ambos para analise de diferenca aprovado/apresentado.
- `valor_aprovado` vs `valor_apresentado`:
  - idem para valores financeiros.
- `dados_extras`:
  - pode carregar `rubrica_codigo` e `rubrica_descricao` para rastreabilidade.

## 3) Padrões de consulta para indicadores

## 3.1 Volume total por competencia

```sql
SELECT
  competencia,
  SUM(quantidade) AS quantidade_total,
  SUM(quantidade_apresentada) AS quantidade_apresentada_total,
  SUM(valor_aprovado) AS valor_aprovado_total,
  SUM(valor_apresentado) AS valor_apresentado_total
FROM sia_producao
WHERE competencia BETWEEN DATE '2026-01-01' AND DATE '2026-06-01'
GROUP BY competencia
ORDER BY competencia;
```

## 3.2 Ranking por estabelecimento (com fallback textual)

```sql
SELECT
  COALESCE(est.nome, sp.unidade) AS estabelecimento,
  sp.estabelecimento_id,
  SUM(sp.quantidade) AS quantidade_total
FROM sia_producao sp
LEFT JOIN estabelecimentos est ON est.id = sp.estabelecimento_id
WHERE sp.competencia = DATE '2026-01-01'
GROUP BY COALESCE(est.nome, sp.unidade), sp.estabelecimento_id
ORDER BY quantidade_total DESC
LIMIT 10;
```

## 3.3 Enriquecimento por forma e CBO

```sql
SELECT
  sp.codigo_sigtap,
  sp.cbo,
  SUM(sp.quantidade) AS quantidade_total,
  fs.descricao AS descricao_forma,
  cs.descricao AS descricao_cbo
FROM sia_producao sp
LEFT JOIN formas_sia fs
  ON fs.codigo_forma = LEFT(TRIM(sp.codigo_sigtap), 6)
 AND fs.status = 'ativo'
LEFT JOIN cbos_sia cs
  ON cs.codigo_cbo = CASE
      WHEN LENGTH(TRIM(sp.cbo)) >= 6 THEN LEFT(TRIM(sp.cbo), 6)
      ELSE LPAD(TRIM(sp.cbo), 6, '0')
    END
 AND cs.status = 'ativo'
WHERE sp.competencia = DATE '2026-01-01'
GROUP BY sp.codigo_sigtap, sp.cbo, fs.descricao, cs.descricao
ORDER BY quantidade_total DESC;
```

## 3.4 Cobertura de resolucao de CNES para cadastro

```sql
SELECT
  COUNT(*) AS total_linhas,
  COUNT(*) FILTER (WHERE estabelecimento_id IS NOT NULL) AS resolvidas,
  COUNT(*) FILTER (WHERE estabelecimento_id IS NULL) AS orfas
FROM sia_producao
WHERE competencia = DATE '2026-01-01';
```

## 4) Como publicar no cadastro de indicadores

Ao criar metrica em `painel_metricas_catalogo`:

1. definir `fonte_tipo = 'sia'`
2. declarar agregacao coerente (`sum`, `historico`, `ranking_unidade`, etc.)
3. escrever `sql_template` parametrizado com:
   - `:competencia`
   - `:estabelecimento_id` (quando aplicavel)
   - `:equipe_id` (se houver recorte correlato)
4. validar consistencia entre:
   - `quantidade` e `quantidade_apresentada`
   - `valor_aprovado` e `valor_apresentado`

## 5) Cuidados para interpretacao gerencial

- `status='parcial'` em sincronizacao indica que parte dos dados pode ter falhado na carga.
- ausencia de `estabelecimento_id` nao implica ausencia de producao; pode ser falta de match CNES->cadastro.
- para comparacao historica, sempre normalizar competencia por data e nao por string livre.

## 6) Indicadores candidatos (exemplos de negocio)

- percentual de glosa por competencia:
  - `1 - (SUM(valor_aprovado) / NULLIF(SUM(valor_apresentado),0))`
- cobertura de cadastro resolvido:
  - `resolvidas / total_linhas`
- producao por faixa etaria e sexo
- producao por forma/cbo (descricao enriquecida)

