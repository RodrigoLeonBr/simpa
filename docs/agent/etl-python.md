# ETL Python

Scripts na **raiz** do repositório. Invocados via `child_process` no Node ou CLI direto.

## Fluxo de dados

```
CSV e-SUS → parse_esus_csv.py → esus_cargas / raw tables
                              → consolidate_dashboard.py → dados_consolidados (JSONB)

MySQL SIA → sync_sia_mysql.py → tabelas SIA no PG

MySQL prestador/procedimento → sync_cadastros_mysql.py → estabelecimentos, procedimentos
```

## Scripts

### `parse_esus_csv.py`

- Entrada: arquivo CSV e-SUS, competência, unidade, equipe.
- Saída: linhas em tabelas raw + registro em `esus_cargas`.
- Chamado por: `simpa-backend/src/services/parser.js`.

### `consolidate_dashboard.py`

- Agrega raw → contrato dashboard v3.1.0 em `dados_consolidados`.
- Chamado por: `consolidator.js` (API `/dashboard/consolidar` ou pós-importação).

### `sync_sia_mysql.py`

- Lê MySQL SIA, grava PostgreSQL.
- Chamado por: `siaSync.js` → `POST /api/sia/sync`.

### `sync_cadastros_mysql.py`

- UPSERT `estabelecimentos` e `procedimentos`.
- `derive_perfil()` mapeia tipo prestador → APS/MAC/Hospitalar/Misto/Outro.
- Respeita `perfil_editado = true` (não sobrescreve perfil manual).

Funções-chave a localizar no arquivo:

- `derive_perfil`
- `upsert_estabelecimento` / equivalente
- `main` / argparse CLI

Chamado por: `cadastrosSync.js` → `POST /api/cadastros/sincronizar`.

## Configuração

Variáveis PG e MySQL via ambiente (mesmas do `.env`). Node passa env ao spawn:

```js
// padrão em services/*.js
spawn(PYTHON_PATH, [scriptPath, ...args], { env: process.env })
```

`PYTHON_PATH`: default `python` (Windows: pode ser `python` do venv).

## Testes

```powershell
npm run test:py
# ou
pytest tests/ -v
```

Testes unitários em `tests/` na raiz (ex.: lógica de parse, derive_perfil).

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
