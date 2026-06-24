# Dicionario de Dados — Importacao e-SUS e Base para Indicadores

Documento de referencia para gestor, desenvolvedores e LLMs criarem indicadores em:

- `/cadastros/indicadores-painel` (cadastro de metricas/widgets)
- Indicadores e metas no dominio de cadastros/painel

Foco: tabelas e campos usados pelo pipeline de importacao e-SUS e pelo consumo analitico.

## 1) Visao de fluxo de dados

1. CSV e-SUS -> parser (`parse_esus_csv.py`)
2. Persistencia:
   - `esus_cargas` (metadados da importacao)
   - `esus_indicadores_raw` (linhas por secao/descricao + `valores` JSONB)
   - `populacao_cadastrada` (somente `cadastro_individual`)
3. Consolidacao (`consolidate_dashboard.py`) -> `dados_consolidados`
4. Indicadores do painel:
   - catalogo em `painel_metricas_catalogo`
   - composicao visual em `painel_widgets`

## 2) Tabelas principais e campos

## 2.1 `esus_cargas`
Uma linha por arquivo importado.

Campos-chave:

- `id` (PK)
- `tipo_relatorio`
- `competencia`, `periodo_inicio`, `periodo_fim`
- `unidade`, `equipe_codigo`, `equipe_nome` (legado textual)
- `estabelecimento_id`, `equipe_id` (dimensoes autoritativas)
- `registros_identificados`, `registros_nao_identificados`
- `arquivo_origem`, `arquivo_path`, `hash_arquivo`
- `importado_em`

Indices/regras relevantes:

- UNIQUE legado: `(tipo_relatorio, competencia, unidade, equipe_nome)`
- UNIQUE ID-based (parcial): `(tipo_relatorio, competencia, estabelecimento_id, equipe_id)` quando IDs nao nulos

Interpretacao:

- `registros_nao_identificados` e o total de rejeicoes apresentado no historico (`rej.`).
- Para analise confiavel por unidade/equipe, preferir sempre recortes por `estabelecimento_id/equipe_id`.

## 2.2 `esus_indicadores_raw`
Tabela EAV com granularidade por secao/descricao do relatorio.

Campos-chave:

- `id` (PK)
- `carga_id` (FK -> `esus_cargas.id`)
- `secao`
- `descricao`
- `ordem`
- `valores` (JSONB)

Regra:

- UNIQUE `(carga_id, secao, descricao)` com upsert.

Interpretacao:

- `valores` contem colunas normalizadas do CSV (ex.: `quantidade`, `masculino`, `feminino`, etc.).
- Esta e a principal fonte para descoberta de metricas novas.

## 2.3 `populacao_cadastrada`
Snapshot agregado do relatorio `cadastro_individual`.

Campos-chave:

- `id` (PK)
- `carga_id` (FK -> `esus_cargas.id`, `ON DELETE CASCADE`)
- `estabelecimento_id` (FK -> `estabelecimentos.id`)
- `competencia`
- `cidadaos_ativos`, `saidas`
- `sexo_masculino`, `sexo_feminino`
- `faixa_etaria` (JSONB array)
- `condicoes_saude` (JSONB objeto)
- `raca_cor`, `sociodemografico`, `extras` (JSONB)
- `importado_em`

Regras:

- UNIQUE `(carga_id)`
- UNIQUE `(competencia, estabelecimento_id)`

Interpretacao para indicadores:

- Base principal para denominadores populacionais (ex.: cobertura, prevalencias, recortes sociodemograficos).
- `extras` preserva secoes nao mapeadas explicitamente.

## 2.4 `esus_import_mapeamentos`
Registry de de-para e-SUS -> cadastro.

Campos-chave:

- `id` (PK)
- `esus_unidade_label`
- `esus_equipe_codigo`, `esus_equipe_nome`
- `estabelecimento_id` (FK)
- `equipe_id` (FK)
- `status` (`ativo`/`inativo`)
- `criado_por`, `atualizado_por`
- `criado_em`, `atualizado_em`, `ultimo_uso_em`

Indices/regras relevantes:

- UNIQUE parcial unidade-only ativa
- UNIQUE parcial por `estabelecimento_id + esus_equipe_codigo` ativo

Uso:

- Resolve vinculacao de upload e preview.
- Importante para governanca e repetibilidade do processo.

## 2.5 `dados_consolidados`
Payload final consumido pela API de dashboard.

Campos-chave:

- `id` (PK)
- `competencia`
- `unidade`, `equipe` (legado textual de exibicao)
- `estabelecimento_id`, `equipe_id` (IDs autoritativos)
- `versao_schema`
- `dados_conteudo` (JSONB)
- `atualizado_em`

Indices/regras:

- UNIQUE legado `(competencia, unidade, equipe)`
- UNIQUE ID-based parcial `(competencia, estabelecimento_id, equipe_id)` quando IDs nao nulos

Uso:

- Fonte para cards/series/rankings ja consolidados.
- Evita recomputar logica complexa quando o indicador ja existe no contrato final.

## 2.6 Tabelas de suporte para indicadores do painel

### `painel_metricas_catalogo`
Catalogo governado de metricas executaveis.

Campos-chave:

- `id`, `chave` (unica), `label`, `descricao`
- `fonte_tipo` (`esus_raw`, `sia`, `consolidado`, `meta`, `placeholder`)
- `tipo_relatorio`, `secao`, `descricao_linha`, `campo_json`, `agregacao`
- `sql_template` (query parametrizada)
- `status`, `ocorrencias`, `descoberto_em`, `ultima_carga_em`

### `painel_widgets`
Composicao visual por perfil/layout.

Campos-chave:

- `id`, `slug`, `perfil`, `layout`, `ordem`, `tipo`
- `titulo`, `subtitulo`, `formato`
- `metrica_id`, `spark_metrica_id`
- `fonte_config`, `spark_config`, `delta_config`, `sql_preview`
- `status`

## 3) Relacoes principais (join path)

- `esus_cargas.id` -> `esus_indicadores_raw.carga_id`
- `esus_cargas.id` -> `populacao_cadastrada.carga_id`
- `esus_cargas.estabelecimento_id` -> `estabelecimentos.id`
- `esus_cargas.equipe_id` -> `equipes.id`
- `dados_consolidados.estabelecimento_id` -> `estabelecimentos.id`
- `dados_consolidados.equipe_id` -> `equipes.id`
- `painel_widgets.metrica_id` -> `painel_metricas_catalogo.id`

## 4) Como acessar e interpretar para construir indicadores

## 4.1 Indicador direto de `esus_indicadores_raw`
Quando existe linha clara no CSV.

Padrao:

- filtrar `esus_cargas` por `competencia`, `tipo_relatorio`, `estabelecimento_id`/`equipe_id`;
- join com `esus_indicadores_raw` por `carga_id`;
- extrair `valores->>'campo'`.

Exemplo:

```sql
SELECT (r.valores->>'quantidade')::bigint AS valor
FROM esus_cargas c
JOIN esus_indicadores_raw r ON r.carga_id = c.id
WHERE c.competencia = DATE '2026-01-01'
  AND c.estabelecimento_id = 123
  AND c.equipe_id = 456
  AND c.tipo_relatorio = 'atendimento_individual'
  AND r.secao = 'Resumo de produção'
  AND r.descricao = 'Registros identificados'
LIMIT 1;
```

## 4.2 Indicador por consolidado
Quando o dado ja e entregue pronto no JSON de contrato.

Exemplo:

```sql
SELECT
  (dc.dados_conteudo->'kpis_gerais'->>'total_atendimentos_aps')::bigint AS valor
FROM dados_consolidados dc
WHERE dc.competencia = DATE '2026-01-01'
  AND dc.estabelecimento_id = 123
  AND dc.equipe_id = 456
LIMIT 1;
```

## 4.3 Indicador com denominador populacional
Quando precisa taxa/prevalencia sobre populacao cadastrada.

Exemplo (estrutura):

```sql
WITH num AS (
  SELECT COALESCE(SUM((r.valores->>'quantidade')::numeric), 0) AS numerador
  FROM esus_cargas c
  JOIN esus_indicadores_raw r ON r.carga_id = c.id
  WHERE c.competencia = DATE '2026-01-01'
    AND c.estabelecimento_id = 123
    AND c.equipe_id = 456
    AND c.tipo_relatorio = 'procedimentos_individualizados'
    AND r.secao = '...'
    AND r.descricao = '...'
),
den AS (
  SELECT cidadaos_ativos::numeric AS denominador
  FROM populacao_cadastrada
  WHERE competencia = DATE '2026-01-01'
    AND estabelecimento_id = 123
)
SELECT
  numerador,
  denominador,
  CASE WHEN denominador > 0 THEN (numerador / denominador) * 100 ELSE NULL END AS taxa_percentual
FROM num, den;
```

## 5) Regras de interpretacao obrigatorias para metricas

- Preferir IDs (`estabelecimento_id`, `equipe_id`) em vez de texto (`unidade`, `equipe_nome`).
- Para `rej.` no historico, usar `esus_cargas.registros_nao_identificados`.
- Nao assumir detalhamento de rejeicao por linha (nao persistido hoje).
- Em comparacoes mensais, normalizar competencia para primeiro dia do mes.
- Ao criar metrica no catalogo, definir explicitamente:
  - `fonte_tipo`
  - `agregacao`
  - `campo_json`
  - `sql_template` com parametros `:competencia`, `:estabelecimento_id`, `:equipe_id`.

## 6) Checklist rapido para cadastrar novo indicador (`/cadastros/indicadores-painel`)

1. Confirmar fonte:
   - `esus_indicadores_raw`, `populacao_cadastrada` ou `dados_consolidados`.
2. Validar chave de negocio:
   - `tipo_relatorio + secao + descricao + campo_json` (quando raw).
3. Definir agregacao:
   - `valor_unico`, `sum`, `avg`, `historico`, `ranking_unidade`, etc.
4. Escrever `sql_template` parametrizado.
5. Testar em competencia real com e sem filtro de equipe.
6. Publicar via `painel_metricas_catalogo` e vincular em `painel_widgets` quando aplicavel.

## 7) Observacoes de governanca

- `esus_import_mapeamentos` deve ser tratado como base de governanca da vinculação.
- Indicadores novos devem priorizar rastreabilidade (query explicita + fonte declarada).
- Se o indicador depender de regra nao representada no schema atual, registrar lacuna antes de publicar widget.

