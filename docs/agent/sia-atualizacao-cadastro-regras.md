# SIA — Regras de Atualizacao de Cadastro

Documento operacional das regras implementadas para atualizar cadastros vindos do MySQL/XAMPP (SIA) no SIMPA.

Escopo principal:

- `POST /api/cadastros/sincronizar`
- Script ETL `sync_cadastros_mysql.py`
- Tabelas espelho: `estabelecimentos`, `procedimentos`, `formas_sia`, `cbos_sia`, `rubricas_sia`
- Auditoria: `cadastros_sincronizacoes`

## 1) Objetivo do fluxo

Atualizar no PostgreSQL os cadastros de referencia do SIA de forma:

- idempotente (upsert por chave de negocio),
- segura contra snapshot inconsistente,
- com trilha de auditoria por execucao,
- sem permitir edicao manual desses cadastros via CRUD da API.

## 2) Endpoint e autorizacao

## `POST /api/cadastros/sincronizar`

- Middleware: `requirePlanningStaff`
- Acao:
  - dispara `cadastrosSync.sincronizar()`
  - chama Python `sync_cadastros_mysql.py --pg-write`
  - retorna resumo por entidade (`estabelecimentos`, `procedimentos`, `formas`, `cbos`, `rubricas`)

Bloqueios e erros relevantes:

- lock de concorrencia in-memory em Node:
  - se ja houver sync em andamento, retorna erro `409` ("Sincronizacao de cadastros ja em andamento")
- timeout configuravel:
  - `CADASTRO_SYNC_TIMEOUT_MS` (default 300000 ms)

## 3) Fontes no MySQL e extracao

O script le tabelas do MySQL (nomes default, com override por env):

- `prestador`
- `procedimento`
- `forma`
- `cbo`
- `s_rub`

As colunas de origem podem ser sobrescritas por variaveis `SIA_COL_*`/`SIA_TABLE_*`.

## 4) Normalizacao e regras de mapeamento

## Estabelecimentos

- chave de negocio: `codigo_externo` (espelho de `re_cunid`)
- `perfil` e derivado por `tipouni` via `derive_perfil`:
  - `1 -> APS`
  - `2 -> MAC`
  - `3 -> Hospitalar`
  - default `Outro`
- `status` vem de ativo/inativo no MySQL (`map_ativo_to_status`)

Regra critica:

- se `estabelecimentos.perfil_editado = true`, o sync nao sobrescreve o `perfil` manual.

## Procedimentos

- chave de negocio: `codigo_sigtap`
- `fonte` sempre gravada como `mysql_sync`
- colunas auxiliares de financiamento/rubrica sao atualizadas por upsert

## Formas

- chave de negocio: `codigo_forma` (canonico 6 chars)
- derivacoes:
  - `codigo_grupo` (2 chars)
  - `codigo_subgrupo` (4 chars)
- normalizacao:
  - pad a esquerda para codigos curtos,
  - truncamento para codigos longos.

## CBOs

- chave de negocio: `codigo_cbo` (canonico 6 chars)
- mesma logica de canonizacao (pad/truncate)

## Rubricas

- chave de negocio: `codigo_rubrica` (canonico 4 chars)
- mesma logica de canonizacao

## 5) Idempotencia (upsert)

Todas as entidades sao gravadas com `INSERT ... ON CONFLICT DO UPDATE`:

- `estabelecimentos` por `codigo_externo`
- `procedimentos` por `codigo_sigtap`
- `formas_sia` por `codigo_forma`
- `cbos_sia` por `codigo_cbo`
- `rubricas_sia` por `codigo_rubrica`

Resultado:

- reexecucoes para o mesmo snapshot nao duplicam dados;
- mudancas de descricao/status sao refletidas por update.

## 6) Regras de inativacao

Entidades ausentes no snapshot podem ser inativadas no PG.

## Estabelecimentos e procedimentos

- inativacao por diferenca de chave vs snapshot
- para procedimentos, apenas `fonte = 'mysql_sync'` entra no escopo de inativacao

## Formas, CBOs e rubricas

Protecoes adicionais:

- guard de snapshot minimo: `CADASTRO_SNAPSHOT_MIN_RATIO` (default `0.25`)
  - se snapshot estiver muito pequeno vs base ativa, inativacao em massa e bloqueada
- se houve linhas invalidas ignoradas na normalizacao (`skipped_rows > 0`), inativacao e desabilitada na entidade

## Snapshot vazio

- fluxo evita inativacao em massa quando nao ha snapshot valido.

## 7) Dry-run vs write

Script suporta:

- `--dry-run`: calcula contagens sem persistir
- `--pg-write`: grava dados e auditoria

No endpoint HTTP produtivo, o modo usado e `--pg-write`.

## 8) Auditoria e historico

Cada execucao salva em `cadastros_sincronizacoes`:

- status (`ok`, `parcial`, `erro`)
- contadores por entidade (`inserted`, `updated`, `inactivated`)
- mensagem de erro (quando houver)

API de consulta:

- `GET /api/cadastros/sincronizacoes`
- `GET /api/cadastros/sincronizacoes/ultima`

## 9) Semantica de status

- `ok`: processou sem erro de linha ignorada e sem falha critica
- `parcial`:
  - quando houve linhas invalidas ignoradas no snapshot (`skipped`)
  - pode manter dados aproveitados com parte descartada
- `erro`: falha de conectividade/extracao/processamento sem resultado confiavel

## 10) Regras de API read-only para referencia SIA

As tabelas espelho de referencia SIA sao somente leitura na API:

- `/api/cadastros/formas` e `/api/cadastros/cbos`
  - `POST/PUT/DELETE` retornam `405`
- mensagem orienta uso de `POST /api/cadastros/sincronizar`

## 11) Campos de configuracao relevantes

- `CADASTRO_SYNC_TIMEOUT_MS`
- `CADASTRO_SNAPSHOT_MIN_RATIO`
- `CADASTRO_PERFIL_MAP`
- `SIA_TABLE_*`, `SIA_COL_*` (origem MySQL)

## 12) Limitacoes e cuidados

- lock de concorrencia do Node e por processo (nao e lock distribuido entre multiplas instancias).
- alteracoes manuais em tabelas espelho podem ser sobrescritas no proximo sync.
- indicadores devem preferir joins por codigos canonicos (`codigo_forma`, `codigo_cbo`, `codigo_rubrica`) e considerar `status = 'ativo'`.

