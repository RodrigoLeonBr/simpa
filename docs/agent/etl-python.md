# ETL Python

Scripts na **raiz** do repositório. Invocados via `child_process` no Node ou CLI direto.

## Fluxo de dados

```
CSV e-SUS → parse_esus_csv.py → esus_cargas / raw tables
                              → consolidate_dashboard.py → dados_consolidados (JSONB)

MySQL SIA (produção agregada por competência) → sync_sia_mysql.py → sia_sincronizacoes + sia_producao (cnes, estabelecimento_id, métricas apresentado)
                                            → consolidate_dashboard.py (ambulatorial_sia por FK com fallback legado por unidade)

MySQL prestador/procedimento/forma/cbo → sync_cadastros_mysql.py → estabelecimentos, procedimentos, formas_sia, cbos_sia
```

## Scripts

### `parse_esus_csv.py`

- Entrada: arquivo CSV e-SUS, competência, unidade, equipe.
- Saída: linhas em tabelas raw + registro em `esus_cargas`.
- Chamado por: `simpa-backend/src/services/parser.js`.

### `consolidate_dashboard.py`

- Agrega raw → contrato dashboard v3.1.0 em `dados_consolidados`.
- Para SIA usa `fetch_sia_rows` por `competencia` + `estabelecimento_id` quando disponível; fallback legado por `unidade` em linhas sem FK.
- Módulo `ambulatorial_sia` passa a carregar também `quantidade_apresentada` e `valor_apresentado`.
- Chamado por: `consolidator.js` (API `/dashboard/consolidar` ou pós-importação).

### `sync_sia_mysql.py`

- Lê MySQL SIA por `--competencia YYYY-MM`, agrega e grava PostgreSQL em batch.
- Suporta `--reimportar` (DELETE por competência antes de inserir novamente).
- Retorna payload com `registros` (linhas agregadas), `linhas_mysql_raw`, `orphan_cnes`, `estabelecimentos_resolvidos`.
- Chamado por: `simpa-backend/src/services/sia.js` → `POST /api/sia/sincronizar`.

### `sync_cadastros_mysql.py`

- UPSERT `estabelecimentos`, `procedimentos`, `formas_sia`, `cbos_sia`.
- `derive_perfil()` mapeia tipo prestador → APS/MAC/Hospitalar/Misto/Outro.
- Respeita `perfil_editado = true` (não sobrescreve perfil manual).
- Inativa registros ausentes no snapshot MySQL; **snapshot vazio não inativa em massa**.
- Forma/CBO: normalização de códigos (6 chars canônicos); guard `CADASTRO_SNAPSHOT_MIN_RATIO` para inativação.

Funções-chave a localizar no arquivo:

- `derive_perfil`
- `extrair_formas` / `extrair_cbos`, `normalize_forma_row` / `normalize_cbo_row`
- `_inactivate_estabelecimentos` / `_inactivate_procedimentos` / inativação forma-cbo
- UPSERT SQL com `CASE WHEN perfil_editado …`
- `main` / argparse CLI

Chamado por: `cadastrosSync.js` → `POST /api/cadastros/sincronizar`.

**E2E:** registros `E2E001–004` podem ser inativados pelo sync; `npm run seed:e2e` reativa via upsert (`simpa-backend/scripts/seed-e2e-estabelecimentos.js`).

## Configuração

Variáveis PG e MySQL via ambiente (mesmas do `.env`). Node passa env ao spawn:

```js
// padrão em services/*.js
spawn(PYTHON_PATH, [scriptPath, ...args], { env: process.env })
```

`PYTHON_PATH`: default `python` (Windows: pode ser `python` do venv).

## Workflow produção SIA (API/UI)

1. UI `SiaProducaoSyncBanner` envia `POST /api/sia/sincronizar` com `competencia`.
2. API aplica gate 409 para competência já importada; retry com `reimportar: true`.
3. Serviço Node executa `sync_sia_mysql.py` e depois `consolidate_dashboard.py` (`runConsolidation({ all: true })`).
4. UI consulta histórico (`GET /api/sia/sincronizacoes`) e badge de existência (`GET /api/sia/sincronizacoes/existe`).

## Testes

```powershell
npm run test:py
# ou
pytest tests/ -v
```

Testes unitários em `tests/` na raiz:

- `test_sync_cadastros_mysql.py` — derive_perfil, guard snapshot vazio, UPSERT condicional
- `test_migration_005.py` — schema 005, backfill idempotente

## Dependências

`requirements.txt` na raiz. Instalar:

```powershell
pip install -r requirements.txt
```

## Ao alterar ETL

1. Manter compatibilidade com colunas PG existentes.
2. Atualizar testes pytest.
3. Se mudar contrato JSON dashboard, atualizar `types/contrato.ts` e testes backend.
4. Documentar em `cadastros.md` se afetar sync de estabelecimentos.
