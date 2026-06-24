# Importacao e-SUS (`/importacao`) — Regras Implementadas

Este documento consolida o comportamento atual do fluxo de importacao e-SUS no SIMPA, para manutencao por desenvolvedores e uso por agentes/LLMs.

## 1) Escopo funcional

- Entrada: arquivos CSV exportados do e-SUS APS.
- Orquestracao: API Node (`simpa-backend`) chama parser Python (`parse_esus_csv.py`) e, apos escrita, consolidacao (`consolidate_dashboard.py`).
- Saidas principais:
  - `esus_cargas` (metadados da carga/importacao)
  - `esus_indicadores_raw` (linhas analiticas em formato EAV + JSONB)
  - `populacao_cadastrada` (somente para `cadastro_individual`)
  - `dados_consolidados` (payload final do painel)

## 2) Tipos de relatorio aceitos

No parser, o titulo (linha 7 do CSV) e mapeado para `tipo_relatorio`:

- `atendimento_individual`
- `atendimento_domiciliar`
- `atendimento_odontologico`
- `atividade_coletiva`
- `marcadores_consumo_alimentar`
- `procedimentos_individualizados`
- `cadastro_individual`

Se o titulo nao for reconhecido, o parser falha com erro de validacao.

## 3) Endpoints e papeis

### `POST /api/importacao/preview`
- Recebe `files[]`.
- Analisa metadados sem gravar carga final.
- Enriquecimento via de-para (`importMappingService.enrichPreviewItem`):
  - resolve estabelecimento/equipe quando possivel;
  - retorna sugestoes de estabelecimento quando pendente;
  - detecta conflitos com importacao `"Todas"`.

### `POST /api/importacao/upload`
- Requer `requirePlanningStaff`.
- Recebe `files[]` + `resolucoes` (JSON array), uma resolucao por arquivo.
- Para cada arquivo:
  1. valida metadados,
  2. resolve de-para (`resolveForUpload`),
  3. move arquivo para `uploads/esus/{ano}/{mes}/{slug_unidade}/`,
  4. executa parser em modo `--pg-write`,
  5. atualiza `arquivo_path/hash_arquivo` em `esus_cargas`,
  6. dispara consolidacao para o recorte (preferencia por IDs).

### Outros endpoints do modulo
- `GET /api/importacao/cargas` (historico)
- `POST /api/importacao/:id/reprocessar`
- `PUT /api/importacao/:id/substituir`
- `DELETE /api/importacao/:id`
- CRUD de de-para: `GET/POST/PUT/DELETE /api/importacao/mapeamentos`

## 4) Regras do preview (status de mapeamento)

Cada arquivo retorna `mapeamento_status`:

- `pending`
  - quando nao existe mapeamento de unidade, ou
  - quando existe unidade mas nao ha resolucao de equipe suficiente.
- `resolved`
  - quando estabelecimento e equipe estao resolvidos para upload.
- `blocked`
  - quando ha conflito com cargas `"Todas"` vs cargas por equipe na mesma competencia/estabelecimento.

Campos relevantes no preview:

- `esus_unidade`, `esus_equipe_codigo`, `esus_equipe_nome`
- `estabelecimento_id`, `equipe_id` (se resolvidos)
- `sugestoes_estabelecimento` (ranking textual)
- `conflito_todas` (`exists`, `cargas_ids`, `requires_confirm`)
- `ja_importado`

## 5) Regras de de-para e equipe

## Unidade
- Registry persistente: `esus_import_mapeamentos`.
- Chave de unidade (sem equipe): `esus_unidade_label` com indice unico parcial ativo.

## Equipe
- Para equipe especifica, usa preferencialmente `esus_equipe_codigo`.
- Quando `equipe = "Todas"`:
  - cria/usa equipe sintetica com codigo `TODAS-{estabelecimento_id}`.

## Persistencia opcional do de-para
- No upload, se `salvar_mapeamento=true`, gravacao/atualizacao e feita no registry.
- `ultimo_uso_em` e atualizado quando o mapeamento e utilizado.

## 6) Regra de conflito "Todas"

A regra evita convivencia incoerente entre dados agregados e segmentados no mesmo recorte:

- Entrada `"Todas"`:
  - bloqueia se ja houver cargas por equipe no mesmo `estabelecimento_id + competencia`.
- Entrada por equipe:
  - detecta se existe carga `"Todas"` no mesmo `estabelecimento_id + competencia`.
  - exige `confirmar_remocao_todas=true`.
  - quando confirmado, remove cargas/consolidado de `"Todas"` antes de prosseguir.

## 7) Escrita no banco e idempotencia

## `esus_cargas`
- UPSERT por IDs quando `estabelecimento_id/equipe_id` existem:
  - `uq_esus_cargas_ids (tipo_relatorio, competencia, estabelecimento_id, equipe_id)`.
- Compatibilidade legado:
  - UNIQUE texto em `(tipo_relatorio, competencia, unidade, equipe_nome)`.

## `esus_indicadores_raw`
- Uma linha por `(carga_id, secao, descricao)`.
- `valores` em JSONB (campos normalizados).
- UPSERT por unique `(carga_id, secao, descricao)`.

## `populacao_cadastrada`
- Apenas para `tipo_relatorio = cadastro_individual`.
- Snapshot por `(competencia, estabelecimento_id)`.

## 8) Consolidacao apos upload

A API executa `consolidate_dashboard.py --pg-write`:

- modo por IDs quando resolucao trouxe `estabelecimento_id + equipe_id`,
- fallback legado por texto (`competencia + unidade + equipe`) quando necessario.

Resultado e salvo em `dados_consolidados`.

## 9) Significado de "rej." no historico

No historico de cargas (`/importacao`), `"/ X rej."` significa:

- valor de `esus_cargas.registros_nao_identificados`,
- extraido da secao `"Resumo de producao"` do proprio CSV do e-SUS.

Importante:

- o sistema atual armazena o total rejeitado, nao o detalhe linha-a-linha da rejeicao.
- status `"Parcial"` e exibido quando `registros_nao_identificados > 0`.

## 10) Arquivo fisico e rastreabilidade

Para cada upload:

- `arquivo_origem`: nome original
- `arquivo_path`: caminho salvo no servidor
- `hash_arquivo`: SHA-256 do arquivo armazenado

Substituicao de carga (`PUT /:id/substituir`) troca arquivo e reprocessa.

## 11) Falhas e codigos comuns

- `400`: payload invalido (ex.: `resolucoes` ausente, `estabelecimento_id` ausente).
- `409`: conflito de regra `"Todas"`.
- `422`: erro de parse/validacao por arquivo.

## 12) Limitacoes atuais

- Nao ha persistencia estruturada do "motivo detalhado" das rejeicoes do e-SUS, apenas contagem agregada.
- O fluxo depende de mapeamento correto unidade/equipe para operar em modo ID-based pleno.
- Linhas legadas sem FK em `esus_cargas` e `dados_consolidados` ainda podem coexistir.

