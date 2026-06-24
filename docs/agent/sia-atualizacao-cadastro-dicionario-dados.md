# SIA — Dicionario de Dados (Atualizacao de Cadastro)

Base de referencia para gestor, desenvolvedores e LLMs criarem indicadores em:

- `/cadastros/indicadores-painel`
- Indicadores e metas no menu de cadastro

Escopo deste documento:

- dados de cadastro sincronizados do MySQL SIA
- como interpretar e consultar essas tabelas para metricas

## 1) Tabelas principais do dominio

## 1.1 `estabelecimentos`

Espelho de prestador (MySQL), com campos SIMPA.

Campos mais relevantes:

- `id` (PK)
- `codigo_externo` (UNIQUE) — chave de negocio (CNES/unidade no contexto)
- `nome`, `cnpj`, `re_tipo`, `tipouni`, `area`, `relatorio`
- `perfil` (`APS`, `MAC`, `Hospitalar`, `Misto`, `Outro`)
- `perfil_editado` (boolean)
- `status` (`ativo`/`inativo`)
- `sincronizado_em`

Interpretacao:

- para recortes de indicador por unidade, use `id` como chave tecnica e `codigo_externo` como chave de interoperabilidade.
- `perfil_editado=true` significa override humano do perfil.

## 1.2 `procedimentos`

Catalogo SIGTAP utilizado como referencia.

Campos mais relevantes:

- `id` (PK)
- `codigo_sigtap` (UNIQUE)
- `descricao`
- `pa_total`, `rubrica`, `pa_id`, `financiamento`
- `fonte` (esperado `mysql_sync` para espelho SIA)
- `status`
- `sincronizado_em`

Interpretacao:

- para indicadores de cobertura de cadastro de procedimento, filtre `status='ativo'`.
- para evitar mistura com registros nao espelhados, use `fonte='mysql_sync'` quando necessario.

## 1.3 `formas_sia`

Espelho da tabela MySQL `forma`.

Campos:

- `id` (PK)
- `codigo_grupo` (2 chars)
- `codigo_subgrupo` (4 chars)
- `codigo_forma` (UNIQUE, 6 chars canonicos)
- `descricao`
- `status`
- `sincronizado_em`

Interpretacao:

- join canonicamente por 6 caracteres de forma (derivado de SIGTAP/procedimento).
- para indicadores analiticos, considerar apenas `status='ativo'` salvo se analise historica exigir inativos.

## 1.4 `cbos_sia`

Espelho da tabela MySQL `cbo`.

Campos:

- `id` (PK)
- `codigo_cbo` (UNIQUE, 6 chars canonicos)
- `descricao`
- `status`
- `sincronizado_em`

Interpretacao:

- join por CBO canonico de 6 caracteres.

## 1.5 `rubricas_sia`

Espelho da tabela MySQL `s_rub`.

Campos:

- `codigo_rubrica` (PK, 4 chars canonicos)
- `descricao`
- `status`
- `sincronizado_em`

Interpretacao:

- dicionario de rubrica para enriquecer visoes de producao SIA por classificacao.

## 1.6 `cadastros_sincronizacoes`

Auditoria por execucao de sync de cadastro.

Campos:

- `id`
- `status`
- contadores:
  - `estab_inseridos`, `estab_atualizados`, `estab_inativados`
  - `proc_inseridos`, `proc_atualizados`, `proc_inativados`
  - `forma_inseridos`, `forma_atualizados`, `forma_inativados`
  - `cbo_inseridos`, `cbo_atualizados`, `cbo_inativados`
  - `rubrica_inseridos`, `rubrica_atualizados`, `rubrica_inativados`
- `erro`
- `sincronizado_em`

Interpretacao:

- base para KPI de qualidade operacional do ETL (ex.: taxa de atualizacao, taxa de inativacao).

## 2) Relacoes e joins recomendados

- `estabelecimentos.id` <-> fatos/visoes que guardam `estabelecimento_id`
- `formas_sia.codigo_forma` <-> forma derivada de `codigo_sigtap` (6 chars)
- `cbos_sia.codigo_cbo` <-> CBO canonico (6 chars)
- `rubricas_sia.codigo_rubrica` <-> rubrica canonica (4 chars)

Observacao:

- para producao SIA, o projeto usa expressao canonica para join em `cadastroReferenciaService`.

## 3) Padrões de acesso para indicadores

## 3.1 Cobertura de espelho de cadastro

```sql
SELECT
  SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END) AS ativos,
  COUNT(*) AS total
FROM formas_sia;
```

## 3.2 Evolucao operacional do sync

```sql
SELECT
  sincronizado_em,
  status,
  estab_atualizados,
  proc_atualizados,
  forma_atualizados,
  cbo_atualizados,
  rubrica_atualizados
FROM cadastros_sincronizacoes
ORDER BY sincronizado_em DESC
LIMIT 30;
```

## 3.3 Taxa de inativacao por execucao

```sql
SELECT
  id,
  sincronizado_em,
  status,
  (estab_inativados + proc_inativados + forma_inativados + cbo_inativados + rubrica_inativados) AS total_inativados
FROM cadastros_sincronizacoes
ORDER BY sincronizado_em DESC
LIMIT 30;
```

## 3.4 Qualidade de mapeamento de estabelecimentos usados em SIA

Exemplo para cruzar com producao:

```sql
SELECT
  COUNT(*) FILTER (WHERE sp.estabelecimento_id IS NOT NULL) AS com_estabelecimento,
  COUNT(*) FILTER (WHERE sp.estabelecimento_id IS NULL) AS sem_estabelecimento
FROM sia_producao sp
WHERE sp.competencia = DATE '2026-01-01';
```

## 4) Como transformar em metrica de painel

Para inserir em `painel_metricas_catalogo`, definir:

- `fonte_tipo`:
  - `consolidado` quando vier de `dados_consolidados`
  - `sia` quando vier de `sia_producao`
  - `placeholder` quando ainda nao houver SQL final
- `agregacao`:
  - `valor_unico`, `sum`, `historico`, `ranking_unidade`, etc.
- `sql_template`:
  - sempre com parametros `:competencia`, `:estabelecimento_id`, `:equipe_id` quando aplicavel

Checklist minimo:

1. escolher a chave correta (ID vs codigo canonicamente normalizado)
2. explicitar filtro de `status` (ativo/inativo)
3. validar em ao menos uma competencia recente com dados reais

## 5) Regras de interpretacao obrigatorias

- preferir IDs (`estabelecimento_id`) para recorte analitico.
- nao assumir que inativado = removido historicamente; pode ser ausencia no snapshot atual.
- para joins de referencia SIA, aplicar canonizacao de codigo antes de comparar.

## 6) Tabelas de apoio que impactam cadastro SIA

- `equipes`:
  - pode receber `estabelecimento_id` (migration 004)
  - usada por recortes de painel/metas, mesmo nao sendo sincronizada diretamente da mesma forma que procedimentos.
- `metas_financiamento`:
  - recebe `estabelecimento_id` (migration 004), habilitando metas por estabelecimento.

