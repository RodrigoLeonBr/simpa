# SIA — Regras de Importacao de Producao

Documento com as regras implementadas para importacao de producao SIA no SIMPA.

Escopo:

- `POST /api/sia/sincronizar`
- Script ETL `sync_sia_mysql.py`
- Tabelas de destino: `sia_sincronizacoes`, `sia_producao`
- Consulta analitica: `GET /api/sia/producao`

## 1) Objetivo do fluxo

Trazer producao ambulatorial do MySQL/XAMPP por competencia e persistir no PostgreSQL para:

- consulta analitica no modulo cadastros,
- consolidacao no painel (`consolidate_dashboard.py`),
- base para metricas/widges no cadastro de indicadores.

## 2) Endpoint e contrato

## `POST /api/sia/sincronizar`

Body:

- `competencia` (obrigatorio, `YYYY-MM`)
- `reimportar` (opcional, boolean)
- `executionId` (opcional, regex validada)

Autorizacao:

- `requirePlanningStaff`

Regras:

- se ja existir sincronizacao com status `ok` ou `parcial` para a competencia e `reimportar != true`, retorna `409` com `code = SIA_COMPETENCIA_JA_IMPORTADA`.
- com `reimportar=true`, permite reprocessamento da competencia.

Pos-sync:

- quando status final for `ok` ou `parcial`, API dispara consolidacao global:
  - `runConsolidation({ all: true })`

## 3) Telemetria de progresso

Fluxo suporta progresso por `executionId`:

- script emite eventos `SIA_PROGRESS ...` no stderr
- service Node parseia e guarda estado em memoria
- endpoint de leitura:
  - `GET /api/sia/sincronizar/progresso/:executionId`

Estados tipicos:

- `iniciando`
- `extracao_mysql`
- `transformacao`
- `gravar_postgres`
- `concluido` ou `erro`

## 4) Extracao no MySQL

Script `sync_sia_mysql.py`:

- consulta principal em `s_prd` com joins para:
  - `prestador`
  - `procedimento`
  - `cbo`
  - `s_rub`
- agrega por grao de extração e depois consolida para o grao da constraint de destino.

Campos extraidos (principais):

- `cnes` (a partir de `prd_uid`)
- `unidade`
- `codigo_sigtap`, `descricao`
- `cbo`
- `rubrica_codigo`, `rubrica_descricao`
- `idade`, `sexo`
- `quantidade`, `quantidade_apresentada`
- `valor_aprovado`, `valor_apresentado`

## 5) Transformacao e padronizacao

Regras principais:

- idade invalida (<0 ou >150) vira `NULL`
- `faixa_etaria` preserva grupo de idade original como texto
- sexo:
  - aceita `M`/`F`
  - fallback para `I` quando invalido/ausente
- `quantidade` e `quantidade_apresentada` -> inteiro
- `valor_aprovado` e `valor_apresentado` -> numerico

Consolidacao antes de gravar:

- `consolidar_para_carga()` agrupa no grao:
  - `cnes`, `codigo_sigtap`, `faixa_etaria`, `sexo`, `cbo`, `rubrica_codigo`
- soma metrica numerica para evitar duplicidade intra-sincronizacao.

## 6) Gravacao em PostgreSQL

## `sia_sincronizacoes`

Por competencia:

- cria/atualiza linha com status `pendente` no inicio
- ao final atualiza `status`, `erros`, `sincronizado_em`

## `sia_producao`

Insercao em lote com `execute_batch`:

- grava chunks (batch size configuravel)
- cada chunk usa savepoint:
  - chunk com erro faz rollback apenas daquele chunk
  - demais chunks continuam

Campos gravados (principais):

- `sincronizacao_id`, `competencia`
- `unidade`, `cnes`, `estabelecimento_id`
- `codigo_sigtap`, `descricao`
- `quantidade`, `quantidade_apresentada`
- `valor_aprovado`, `valor_apresentado`
- `faixa_etaria`, `sexo`, `cbo`, `rubrica`
- `dados_extras` (jsonb com `rubrica_codigo`, `rubrica_descricao` quando presentes)

## 7) Resolucao de estabelecimento por CNES

Durante gravacao:

- carrega mapa `estabelecimentos.codigo_externo -> estabelecimentos.id`
- tenta resolver `estabelecimento_id` por `cnes`

Metricas operacionais:

- `estabelecimentos_resolvidos`
- `orphan_cnes` (linhas com CNES sem match)

## 8) Reimportacao

Com `reimportar=true`:

- antes de inserir, faz `DELETE FROM sia_producao WHERE competencia = :competencia`
- em seguida grava nova versao dos dados da competencia.

## 9) Semantica de status final

- `ok`: todos os chunks inseridos sem erro
- `parcial`:
  - houve erro em parte dos chunks, mas parte foi gravada, ou
  - nao houve payload para inserir (caso de baixa/ausencia de dados)
- `erro`: falha total sem resultado util

## 10) API de consulta de producao

## `GET /api/sia/producao`

Filtros:

- `competencia` (`YYYY-MM`)
- `unidade` (ILIKE parcial)
- `codigo_sigtap` (igualdade)
- `estabelecimento_id` (igualdade)

Saida agregada por:

- `codigo_sigtap`, `descricao`
- `faixa_etaria` (tambem exposto como `grupo_idade_sia`)
- `sexo`, `cbo`

Medidas:

- `quantidade`
- `valor_aprovado`
- `quantidade_apresentada`
- `valor_apresentado`

Enriquecimento:

- `descricao_forma` (join com `formas_sia` por forma canonica)
- `descricao_cbo` (join com `cbos_sia` por CBO canonico)

## 11) Configuracoes relevantes

- `SIA_EXTRACT_BLOCK_SIZE` (extracao em blocos)
- `SIA_PG_BATCH_SIZE` (insert em lotes)
- `SIA_TABLE_*`, `SIA_COL_*` (mapeamento schema MySQL)
- `SIA_JOIN_CHARSET`, `SIA_JOIN_COLLATION`

## 12) Limitacoes e cuidados

- progresso e mantido em memoria no processo Node (nao distribuido entre replicas).
- dados podem ficar `parcial` por erro em subset de chunks.
- para recortes de painel e metas, preferir `estabelecimento_id` quando disponivel.

