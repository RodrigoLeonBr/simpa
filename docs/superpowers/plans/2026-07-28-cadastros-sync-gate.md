# Gate manter/alterar no sync de cadastros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o sync MySQL→PG de estabelecimentos+procedimentos não-destrutivo: computar um plano de diffs (novo/alterado/sumiu) read-only e aplicar só o subset que o usuário aprovar.

**Architecture:** Python ganha modo `--plan` (read-only) que emite diffs por linha. Backend Node roda o plano, retorna JSON (sem persistir), e aplica o subset aprovado numa transação com guard anti-clobber. Frontend segura o plano em memória e mostra preview com toggle manter/aplicar por linha + bulk. Forma/cbo/rubrica seguem o sync cego atual, intocados.

**Tech Stack:** Python 3 (psycopg2, pandas), Node 18 (Express, pg), React 19 (Vite, Tailwind), pytest / Jest / Vitest.

**Spec:** `docs/superpowers/specs/2026-07-28-cadastros-sync-gate-design.md`

---

## Arquivos

| Arquivo | Responsabilidade | Ação |
|---------|------------------|------|
| `sync_cadastros_mysql.py` | Modo `--plan`: diff read-only estab+proc | Modificar |
| `tests/test_cadastros_sync_plan.py` | pytest do `--plan` | Criar |
| `simpa-backend/src/services/cadastrosSync.js` | `planejarSync()` + `aplicarPlano()` | Modificar |
| `simpa-backend/src/routes/cadastros.js` | `POST /sync-plano`, `POST /sync-plano/aplicar` | Modificar |
| `simpa-backend/tests/cadastrosSyncPlano.test.js` | Jest do plano+apply | Criar |
| `simpa-frontend/src/types/cadastros.ts` | Tipos `SyncPlano*` | Modificar |
| `simpa-frontend/src/api/cadastros.ts` | `computarSyncPlano`, `aplicarSyncPlano` | Modificar |
| `simpa-frontend/src/pages/Cadastros/SyncPlanoPreview.tsx` | Preview + toggle + bulk | Criar |
| `simpa-frontend/src/pages/Cadastros/SyncPlanoPreview.test.tsx` | Vitest do preview | Criar |
| `simpa-frontend/src/pages/Cadastros/CadastroSyncBanner.tsx` | Botão chama `/sync-plano`, abre preview | Modificar |
| `docs/agent/cadastros.md` | Documentar workflow do gate | Modificar |

**Contrato JSON `--plan`** (compartilhado por todas as camadas):
```json
{
  "status": "ok",
  "estabelecimentos": [
    {"chave": "1234567", "tipo": "alterado",
     "diff": {"status": {"simpa": "ativo", "mysql": "inativo"}}}
  ],
  "procedimentos": [],
  "resumo": {"estabelecimentos": {"novo": 0, "alterado": 1, "sumiu": 0},
             "procedimentos": {"novo": 0, "alterado": 0, "sumiu": 0}},
  "sincronizado_em": "2026-07-28T12:00:00+00:00"
}
```
- `novo`: `diff = {campo: {"mysql": v}}` (todos os campos comparados).
- `alterado`: `diff = {campo: {"simpa": a, "mysql": b}}` só dos campos que diferem.
- `sumiu`: `diff = {campo: {"simpa": v}}` (só `status`, o que muda no apply).

Campos comparados — **estab:** nome, cnpj, re_tipo, tipouni, perfil, area, relatorio, status (pulando `nome`/`perfil`/`status` quando o respectivo `*_editado=true`). **proc:** descricao, pa_total, rubrica, pa_id, financiamento, status (procedimentos não tem flags `*_editado`).

---

## Task 1: Python `--plan` — diff read-only

**Files:**
- Modify: `sync_cadastros_mysql.py` (main args ~1135; `sincronizar` ~988/1089)
- Test: `tests/test_cadastros_sync_plan.py`

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/test_cadastros_sync_plan.py`:

```python
from sync_cadastros_mysql import build_entity_plan

ESTAB_FIELDS = ["nome", "cnpj", "re_tipo", "tipouni", "perfil", "area", "relatorio", "status"]
ESTAB_EDITADO = {"nome": "nome_editado", "perfil": "perfil_editado", "status": "status_editado"}


def test_novo_traz_so_mysql():
    mysql_rows = [{"codigo_externo": "111", "nome": "UBS A", "cnpj": None, "re_tipo": None,
                   "tipouni": "1", "perfil": "APS", "area": None, "relatorio": None, "status": "ativo"}]
    pg_rows = {}
    items = build_entity_plan(mysql_rows, pg_rows, "codigo_externo", ESTAB_FIELDS, ESTAB_EDITADO)
    assert len(items) == 1
    assert items[0]["tipo"] == "novo"
    assert items[0]["chave"] == "111"
    assert items[0]["diff"]["nome"] == {"mysql": "UBS A"}
    assert "simpa" not in items[0]["diff"]["nome"]


def test_alterado_so_campos_que_diferem():
    mysql_rows = [{"codigo_externo": "111", "nome": "UBS A", "cnpj": None, "re_tipo": None,
                   "tipouni": "1", "perfil": "APS", "area": None, "relatorio": None, "status": "inativo"}]
    pg_rows = {"111": {"nome": "UBS A", "cnpj": None, "re_tipo": None, "tipouni": "1",
                       "perfil": "APS", "area": None, "relatorio": None, "status": "ativo",
                       "nome_editado": False, "perfil_editado": False, "status_editado": False}}
    items = build_entity_plan(mysql_rows, pg_rows, "codigo_externo", ESTAB_FIELDS, ESTAB_EDITADO)
    assert len(items) == 1
    assert items[0]["tipo"] == "alterado"
    assert list(items[0]["diff"].keys()) == ["status"]
    assert items[0]["diff"]["status"] == {"simpa": "ativo", "mysql": "inativo"}


def test_campo_editado_nao_entra_no_diff():
    mysql_rows = [{"codigo_externo": "111", "nome": "UBS A", "cnpj": None, "re_tipo": None,
                   "tipouni": "1", "perfil": "APS", "area": None, "relatorio": None, "status": "inativo"}]
    pg_rows = {"111": {"nome": "UBS A", "cnpj": None, "re_tipo": None, "tipouni": "1",
                       "perfil": "APS", "area": None, "relatorio": None, "status": "ativo",
                       "nome_editado": False, "perfil_editado": False, "status_editado": True}}
    items = build_entity_plan(mysql_rows, pg_rows, "codigo_externo", ESTAB_FIELDS, ESTAB_EDITADO)
    assert items == []  # status é o único diff mas está editado -> nada a propor


def test_sumiu_do_mysql():
    mysql_rows = []
    pg_rows = {"111": {"nome": "UBS A", "cnpj": None, "re_tipo": None, "tipouni": "1",
                       "perfil": "APS", "area": None, "relatorio": None, "status": "ativo",
                       "nome_editado": False, "perfil_editado": False, "status_editado": False}}
    items = build_entity_plan(mysql_rows, pg_rows, "codigo_externo", ESTAB_FIELDS, ESTAB_EDITADO)
    assert len(items) == 1
    assert items[0]["tipo"] == "sumiu"
    assert items[0]["diff"] == {"status": {"simpa": "ativo"}}


def test_sumiu_ignora_ja_inativo():
    mysql_rows = []
    pg_rows = {"111": {"nome": "UBS A", "cnpj": None, "re_tipo": None, "tipouni": "1",
                       "perfil": "APS", "area": None, "relatorio": None, "status": "inativo",
                       "nome_editado": False, "perfil_editado": False, "status_editado": False}}
    items = build_entity_plan(mysql_rows, pg_rows, "codigo_externo", ESTAB_FIELDS, ESTAB_EDITADO)
    assert items == []
```

- [ ] **Step 2: Rodar o teste, ver falhar**

Run: `python -m pytest tests/test_cadastros_sync_plan.py -v`
Expected: FAIL — `ImportError: cannot import name 'build_entity_plan'`.

- [ ] **Step 3: Implementar `build_entity_plan`**

Adicionar em `sync_cadastros_mysql.py` (antes de `main`):

```python
def build_entity_plan(mysql_rows, pg_rows, key, compare_fields, editado_map):
    """Diff read-only MySQL vs PG. editado_map: {campo: coluna_flag} pula campo SIMPA-owner.

    mysql_rows: list de dicts normalizados (com `key`). pg_rows: dict[chave] -> dict com
    compare_fields + flags editado. Retorna itens {chave, tipo, diff}.
    """
    items = []
    seen = set()
    for row in mysql_rows:
        chave = row[key]
        seen.add(chave)
        current = pg_rows.get(chave)
        if current is None:
            diff = {f: {"mysql": row.get(f)} for f in compare_fields}
            items.append({"chave": chave, "tipo": "novo", "diff": diff})
            continue
        diff = {}
        for f in compare_fields:
            flag = editado_map.get(f)
            if flag and current.get(flag):
                continue  # campo SIMPA-owner: não propõe
            if row.get(f) != current.get(f):
                diff[f] = {"simpa": current.get(f), "mysql": row.get(f)}
        if diff:
            items.append({"chave": chave, "tipo": "alterado", "diff": diff})
    for chave, current in pg_rows.items():
        if chave in seen:
            continue
        if current.get("status") == "ativo":
            items.append({"chave": chave, "tipo": "sumiu",
                          "diff": {"status": {"simpa": "ativo"}}})
    return items


if __name__ == "__main__":  # pragma: no cover
    pass
```

(Remover o `if __name__` placeholder acima — já existe um no fim do arquivo; incluído só para o import não quebrar caso rode isolado. Na prática cole só a função `build_entity_plan`.)

- [ ] **Step 4: Rodar o teste, ver passar**

Run: `python -m pytest tests/test_cadastros_sync_plan.py -v`
Expected: PASS (5 testes).

- [ ] **Step 5: Ligar `build_entity_plan` ao modo `--plan`**

Em `sync_cadastros_mysql.py`, adicionar helper de leitura do PG e o branch de plano.

Helper (perto dos outros `_fetch_*`):

```python
ESTAB_PLAN_FIELDS = ["nome", "cnpj", "re_tipo", "tipouni", "perfil", "area", "relatorio", "status"]
ESTAB_PLAN_EDITADO = {"nome": "nome_editado", "perfil": "perfil_editado", "status": "status_editado"}
PROC_PLAN_FIELDS = ["descricao", "pa_total", "rubrica", "pa_id", "financiamento", "status"]


def _fetch_pg_rows(cur, table, key, fields, flags=()):
    cols = [key] + fields + list(flags)
    cur.execute(f"SELECT {', '.join(cols)} FROM {table}")
    out = {}
    for row in cur.fetchall():
        rec = dict(zip(cols, row))
        out[rec[key]] = rec
    return out
```

Modificar a assinatura de `sincronizar` (linha ~988) para aceitar `plan`:

```python
def sincronizar(*, pg_write: bool = False, dry_run: bool = False, plan: bool = False) -> dict[str, Any]:
```

Após o `conn_pg = pg_connect()` bem-sucedido (dentro do `try:` em ~1089), antes de `estab_counts = ...`, inserir:

```python
        if plan:
            with conn_pg.cursor() as cur:
                pg_estab = _fetch_pg_rows(cur, "estabelecimentos", "codigo_externo",
                                          ESTAB_PLAN_FIELDS, ("nome_editado", "perfil_editado", "status_editado"))
                pg_proc = _fetch_pg_rows(cur, "procedimentos", "codigo_sigtap", PROC_PLAN_FIELDS)
            estab_items = build_entity_plan(prestadores, pg_estab, "codigo_externo",
                                            ESTAB_PLAN_FIELDS, ESTAB_PLAN_EDITADO)
            proc_items = build_entity_plan(procedimentos, pg_proc, "codigo_sigtap",
                                           PROC_PLAN_FIELDS, {})
            conn_pg.rollback()
            return {
                "status": "ok",
                "estabelecimentos": estab_items,
                "procedimentos": proc_items,
                "resumo": {
                    "estabelecimentos": {t: sum(1 for i in estab_items if i["tipo"] == t)
                                         for t in ("novo", "alterado", "sumiu")},
                    "procedimentos": {t: sum(1 for i in proc_items if i["tipo"] == t)
                                      for t in ("novo", "alterado", "sumiu")},
                },
                "sincronizado_em": sync_ts.isoformat(),
            }
```

Adicionar o arg em `main()` (após `--dry-run`):

```python
    parser.add_argument(
        "--plan",
        action="store_true",
        help="Emite diff read-only (estab+proc) sem gravar",
    )
```

Ajustar a checagem de args e a chamada:

```python
    if not args.pg_write and not args.dry_run and not args.plan:
        print("Erro: use --dry-run, --pg-write ou --plan", file=sys.stderr)
        sys.exit(1)
    ...
        result = sincronizar(pg_write=args.pg_write, dry_run=args.dry_run, plan=args.plan)
```

- [ ] **Step 6: Rodar suíte pytest de cadastros**

Run: `python -m pytest tests/ -k "cadastros" -v`
Expected: PASS (novos testes + regressões existentes).

- [ ] **Step 7: Commit**

```bash
git add sync_cadastros_mysql.py tests/test_cadastros_sync_plan.py
git commit -m "feat(sync): modo --plan read-only com diff por linha (estab+proc)"
```

---

## Task 2: Backend `planejarSync()` + `POST /sync-plano`

**Files:**
- Modify: `simpa-backend/src/services/cadastrosSync.js`
- Modify: `simpa-backend/src/routes/cadastros.js:9-13,52`
- Test: `simpa-backend/tests/cadastrosSyncPlano.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Criar `simpa-backend/tests/cadastrosSyncPlano.test.js`:

```javascript
const { parsePlanOutput } = require('../src/services/cadastrosSync');

describe('parsePlanOutput', () => {
  it('parseia JSON de plano', () => {
    const stdout = JSON.stringify({
      status: 'ok',
      estabelecimentos: [{ chave: '111', tipo: 'novo', diff: { nome: { mysql: 'UBS A' } } }],
      procedimentos: [],
      resumo: { estabelecimentos: { novo: 1, alterado: 0, sumiu: 0 }, procedimentos: { novo: 0, alterado: 0, sumiu: 0 } },
      sincronizado_em: '2026-07-28T12:00:00+00:00',
    });
    const plan = parsePlanOutput(stdout);
    expect(plan.estabelecimentos).toHaveLength(1);
    expect(plan.resumo.estabelecimentos.novo).toBe(1);
  });

  it('propaga status erro do python', () => {
    const stdout = JSON.stringify({ status: 'erro', erro: 'PG down' });
    expect(() => parsePlanOutput(stdout)).toThrow('PG down');
  });
});
```

- [ ] **Step 2: Rodar, ver falhar**

Run: `npm test --prefix simpa-backend -- cadastrosSyncPlano`
Expected: FAIL — `parsePlanOutput is not a function`.

- [ ] **Step 3: Implementar `planejarSync` + `parsePlanOutput`**

Em `simpa-backend/src/services/cadastrosSync.js`, adicionar:

```javascript
function parsePlanOutput(stdout) {
  const parsed = JSON.parse(stdout.trim());
  if (parsed.status === 'erro') {
    const error = new Error(parsed.erro || 'Erro ao planejar sync');
    error.status = 502;
    throw error;
  }
  return parsed;
}

function runPlanSubprocess() {
  return new Promise((resolve, reject) => {
    const script = scriptPath();
    const proc = spawn(pythonBin(), [script, '--plan'], {
      cwd: path.dirname(script),
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      const error = new Error('Timeout do plano de sync');
      error.status = 504;
      reject(error);
    }, SYNC_TIMEOUT_MS);
    proc.stdout.on('data', (c) => { stdout += c.toString(); });
    proc.stderr.on('data', (c) => { stderr += c.toString(); });
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      try {
        return resolve(parsePlanOutput(stdout));
      } catch (err) {
        if (code !== 0) {
          const e = new Error(stderr.trim() || `sync --plan exit ${code}`);
          e.status = 502;
          return reject(e);
        }
        return reject(err);
      }
    });
  });
}

async function planejarSync() {
  if (syncInFlight) {
    const error = new Error('Sincronização já em andamento');
    error.status = 409;
    throw error;
  }
  const promise = runPlanSubprocess();
  syncInFlight = promise;
  try {
    return await promise;
  } finally {
    if (syncInFlight === promise) syncInFlight = null;
  }
}
```

Exportar no `module.exports`: adicionar `planejarSync`, `parsePlanOutput`.

- [ ] **Step 4: Adicionar rota `POST /sync-plano`**

Em `simpa-backend/src/routes/cadastros.js`, no destructuring (linha 9-13) adicionar `planejarSync`, e após a rota `/sincronizar`:

```javascript
router.post('/sync-plano', requirePlanningStaff, async (_req, res, next) => {
  try {
    const plano = await planejarSync();
    return res.json(plano);
  } catch (err) {
    return next(err);
  }
});
```

- [ ] **Step 5: Rodar, ver passar**

Run: `npm test --prefix simpa-backend -- cadastrosSyncPlano`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add simpa-backend/src/services/cadastrosSync.js simpa-backend/src/routes/cadastros.js simpa-backend/tests/cadastrosSyncPlano.test.js
git commit -m "feat(cadastros): POST /sync-plano roda --plan e retorna diffs"
```

---

## Task 3: Backend `aplicarPlano()` + guard anti-clobber + `POST /sync-plano/aplicar`

**Files:**
- Modify: `simpa-backend/src/services/cadastrosSync.js`
- Modify: `simpa-backend/src/routes/cadastros.js`
- Test: `simpa-backend/tests/cadastrosSyncPlano.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `cadastrosSyncPlano.test.js`. Mocka `db` para inspecionar SQL:

```javascript
jest.mock('../src/services/db', () => {
  const client = { query: jest.fn(), release: jest.fn() };
  return {
    query: jest.fn(),
    pool: { connect: jest.fn(async () => client) },
    __client: client,
  };
});

const db = require('../src/services/db');
const { aplicarPlano } = require('../src/services/cadastrosSync');

beforeEach(() => {
  db.__client.query.mockReset();
  db.__client.query.mockResolvedValue({ rows: [], rowCount: 1 });
});

describe('aplicarPlano', () => {
  it('aplica alterado quando SIMPA atual bate com o diff.simpa', async () => {
    // SELECT de verificação retorna status atual = 'ativo' (bate)
    db.__client.query.mockImplementation(async (sql) => {
      if (/SELECT status FROM estabelecimentos/i.test(sql)) return { rows: [{ status: 'ativo' }] };
      return { rows: [], rowCount: 1 };
    });
    const r = await aplicarPlano([
      { entidade: 'estabelecimento', chave: '111', tipo: 'alterado',
        diff: { status: { simpa: 'ativo', mysql: 'inativo' } } },
    ], 1);
    expect(r.aplicados).toBe(1);
    expect(r.pulados).toBe(0);
    const updateCall = db.__client.query.mock.calls.find(([s]) => /UPDATE estabelecimentos SET/i.test(s));
    expect(updateCall).toBeTruthy();
  });

  it('pula item quando SIMPA atual divergiu do diff.simpa (anti-clobber)', async () => {
    db.__client.query.mockImplementation(async (sql) => {
      if (/SELECT status FROM estabelecimentos/i.test(sql)) return { rows: [{ status: 'inativo' }] };
      return { rows: [], rowCount: 1 };
    });
    const r = await aplicarPlano([
      { entidade: 'estabelecimento', chave: '111', tipo: 'alterado',
        diff: { status: { simpa: 'ativo', mysql: 'inativo' } } },
    ], 1);
    expect(r.aplicados).toBe(0);
    expect(r.pulados).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar, ver falhar**

Run: `npm test --prefix simpa-backend -- cadastrosSyncPlano`
Expected: FAIL — `aplicarPlano is not a function`.

- [ ] **Step 3: Implementar `aplicarPlano`**

Em `cadastrosSync.js`, adicionar `const { pool } = require('./db');` ao topo (já tem `query`; garantir `pool`). Depois:

```javascript
const APLICAR_TABELAS = {
  estabelecimento: { tabela: 'estabelecimentos', chaveCol: 'codigo_externo' },
  procedimento: { tabela: 'procedimentos', chaveCol: 'codigo_sigtap' },
};

// Campos permitidos por entidade (evita SQL injection via chave de campo)
const CAMPOS_PERMITIDOS = {
  estabelecimento: ['nome', 'cnpj', 're_tipo', 'tipouni', 'perfil', 'area', 'relatorio', 'status'],
  procedimento: ['descricao', 'pa_total', 'rubrica', 'pa_id', 'financiamento', 'status'],
};

async function _clobberOk(client, tabela, chaveCol, chave, diff) {
  // Re-lê valores SIMPA atuais dos campos com valor `simpa` esperado; pula se divergiu.
  const campos = Object.keys(diff).filter((c) => 'simpa' in diff[c]);
  if (campos.length === 0) return true;
  const { rows } = await client.query(
    `SELECT ${campos.join(', ')} FROM ${tabela} WHERE ${chaveCol} = $1`,
    [chave]
  );
  if (rows.length === 0) return false;
  return campos.every((c) => rows[0][c] === diff[c].simpa);
}

async function aplicarPlano(itens, usuarioId) {
  const client = await pool.connect();
  let aplicados = 0;
  let pulados = 0;
  try {
    await client.query('BEGIN');
    for (const item of itens) {
      const cfg = APLICAR_TABELAS[item.entidade];
      if (!cfg) { pulados += 1; continue; }
      const permitidos = CAMPOS_PERMITIDOS[item.entidade];

      if (item.tipo === 'sumiu') {
        if (!(await _clobberOk(client, cfg.tabela, cfg.chaveCol, item.chave, item.diff))) { pulados += 1; continue; }
        await client.query(
          `UPDATE ${cfg.tabela} SET status = 'inativo' WHERE ${cfg.chaveCol} = $1`,
          [item.chave]
        );
        aplicados += 1;
      } else if (item.tipo === 'alterado') {
        if (!(await _clobberOk(client, cfg.tabela, cfg.chaveCol, item.chave, item.diff))) { pulados += 1; continue; }
        const campos = Object.keys(item.diff).filter((c) => permitidos.includes(c));
        if (campos.length === 0) { pulados += 1; continue; }
        const sets = campos.map((c, i) => `${c} = $${i + 2}`).join(', ');
        const vals = campos.map((c) => item.diff[c].mysql);
        await client.query(
          `UPDATE ${cfg.tabela} SET ${sets} WHERE ${cfg.chaveCol} = $1`,
          [item.chave, ...vals]
        );
        aplicados += 1;
      } else if (item.tipo === 'novo') {
        const campos = Object.keys(item.diff).filter((c) => permitidos.includes(c));
        const cols = [cfg.chaveCol, ...campos];
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const vals = [item.chave, ...campos.map((c) => item.diff[c].mysql)];
        await client.query(
          `INSERT INTO ${cfg.tabela} (${cols.join(', ')}) VALUES (${placeholders})
           ON CONFLICT (${cfg.chaveCol}) DO NOTHING`,
          vals
        );
        aplicados += 1;
      } else {
        pulados += 1;
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { aplicados, pulados };
}
```

Exportar `aplicarPlano` no `module.exports`.

- [ ] **Step 4: Adicionar rota `POST /sync-plano/aplicar`**

Em `routes/cadastros.js`, importar `aplicarPlano` e adicionar após `/sync-plano`:

```javascript
router.post('/sync-plano/aplicar', requirePlanningStaff, async (req, res, next) => {
  try {
    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
    if (itens.length === 0) {
      return res.status(400).json({ erro: 'Nenhum item para aplicar' });
    }
    const resultado = await aplicarPlano(itens, req.user?.id ?? null);
    await logAudit({
      usuarioId: req.user?.id ?? null,
      acao: 'cadastros_sync_plano_aplicar',
      recurso: 'cadastros',
      detalhes: JSON.stringify(resultado),
      ip: req.ip,
    });
    return res.json(resultado);
  } catch (err) {
    return next(err);
  }
});
```

- [ ] **Step 5: Rodar, ver passar**

Run: `npm test --prefix simpa-backend -- cadastrosSyncPlano`
Expected: PASS (4 testes).

- [ ] **Step 6: Commit**

```bash
git add simpa-backend/src/services/cadastrosSync.js simpa-backend/src/routes/cadastros.js simpa-backend/tests/cadastrosSyncPlano.test.js
git commit -m "feat(cadastros): aplicarPlano transacional + guard anti-clobber + POST /aplicar"
```

---

## Task 4: Frontend — tipos + API client

**Files:**
- Modify: `simpa-frontend/src/types/cadastros.ts`
- Modify: `simpa-frontend/src/api/cadastros.ts`

- [ ] **Step 1: Adicionar tipos**

Em `simpa-frontend/src/types/cadastros.ts`:

```typescript
export type SyncPlanoTipo = 'novo' | 'alterado' | 'sumiu';

export interface SyncPlanoCampoDiff {
  simpa?: unknown;
  mysql?: unknown;
}

export interface SyncPlanoItem {
  chave: string;
  tipo: SyncPlanoTipo;
  diff: Record<string, SyncPlanoCampoDiff>;
}

export interface SyncPlanoResumo {
  novo: number;
  alterado: number;
  sumiu: number;
}

export interface SyncPlano {
  estabelecimentos: SyncPlanoItem[];
  procedimentos: SyncPlanoItem[];
  resumo: { estabelecimentos: SyncPlanoResumo; procedimentos: SyncPlanoResumo };
  sincronizado_em: string;
}

export interface SyncPlanoAplicarItem extends SyncPlanoItem {
  entidade: 'estabelecimento' | 'procedimento';
}

export interface SyncPlanoAplicarResult {
  aplicados: number;
  pulados: number;
}
```

- [ ] **Step 2: Adicionar funções de API**

Em `simpa-frontend/src/api/cadastros.ts` (seguindo o padrão de `sincronizarCadastros`):

```typescript
import type {
  SyncPlano,
  SyncPlanoAplicarItem,
  SyncPlanoAplicarResult,
} from '../types/cadastros';

export function computarSyncPlano(): Promise<SyncPlano> {
  return apiFetch('/api/cadastros/sync-plano', { method: 'POST' });
}

export function aplicarSyncPlano(
  itens: SyncPlanoAplicarItem[]
): Promise<SyncPlanoAplicarResult> {
  return apiFetch('/api/cadastros/sync-plano/aplicar', {
    method: 'POST',
    body: JSON.stringify({ itens }),
  });
}
```

(Ajustar import de `apiFetch` conforme o padrão já usado no arquivo.)

- [ ] **Step 3: Verificar typecheck**

Run: `npm run build --prefix simpa-frontend` (ou `tsc --noEmit` conforme scripts)
Expected: sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add simpa-frontend/src/types/cadastros.ts simpa-frontend/src/api/cadastros.ts
git commit -m "feat(cadastros): tipos e API client do sync-plano"
```

---

## Task 5: Frontend — `SyncPlanoPreview` + wiring no banner

**Files:**
- Create: `simpa-frontend/src/pages/Cadastros/SyncPlanoPreview.tsx`
- Create: `simpa-frontend/src/pages/Cadastros/SyncPlanoPreview.test.tsx`
- Modify: `simpa-frontend/src/pages/Cadastros/CadastroSyncBanner.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `SyncPlanoPreview.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SyncPlanoPreview } from './SyncPlanoPreview';
import type { SyncPlano } from '../../types/cadastros';

const plano: SyncPlano = {
  estabelecimentos: [
    { chave: '111', tipo: 'alterado', diff: { status: { simpa: 'ativo', mysql: 'inativo' } } },
    { chave: '222', tipo: 'novo', diff: { nome: { mysql: 'UBS NOVA' } } },
  ],
  procedimentos: [],
  resumo: {
    estabelecimentos: { novo: 1, alterado: 1, sumiu: 0 },
    procedimentos: { novo: 0, alterado: 0, sumiu: 0 },
  },
  sincronizado_em: '2026-07-28T12:00:00+00:00',
};

describe('SyncPlanoPreview', () => {
  it('monta payload só com itens marcados aplicar', () => {
    const onAplicar = vi.fn();
    render(<SyncPlanoPreview plano={plano} onAplicar={onAplicar} onCancelar={() => {}} />);
    // marca "aplicar todos" na aba estabelecimentos
    fireEvent.click(screen.getByRole('button', { name: /aplicar todos/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(onAplicar).toHaveBeenCalledTimes(1);
    const itens = onAplicar.mock.calls[0][0];
    expect(itens).toHaveLength(2);
    expect(itens.every((i: { entidade: string }) => i.entidade === 'estabelecimento')).toBe(true);
  });

  it('não inclui itens deixados em manter', () => {
    const onAplicar = vi.fn();
    render(<SyncPlanoPreview plano={plano} onAplicar={onAplicar} onCancelar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(onAplicar).toHaveBeenCalledWith([]);
  });
});
```

- [ ] **Step 2: Rodar, ver falhar**

Run: `npm test --prefix simpa-frontend -- SyncPlanoPreview`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `SyncPlanoPreview`**

Criar `SyncPlanoPreview.tsx`:

```tsx
import { useState } from 'react';
import type {
  SyncPlano,
  SyncPlanoItem,
  SyncPlanoAplicarItem,
} from '../../types/cadastros';

type Entidade = 'estabelecimento' | 'procedimento';
type Decisao = 'manter' | 'aplicar';

interface Props {
  plano: SyncPlano;
  onAplicar: (itens: SyncPlanoAplicarItem[]) => void;
  onCancelar: () => void;
}

const ABAS: { entidade: Entidade; label: string; key: keyof SyncPlano }[] = [
  { entidade: 'estabelecimento', label: 'Estabelecimentos', key: 'estabelecimentos' },
  { entidade: 'procedimento', label: 'Procedimentos', key: 'procedimentos' },
];

function itemId(entidade: Entidade, chave: string) {
  return `${entidade}:${chave}`;
}

export function SyncPlanoPreview({ plano, onAplicar, onCancelar }: Props) {
  const [abaIdx, setAbaIdx] = useState(0);
  const [decisoes, setDecisoes] = useState<Record<string, Decisao>>({});
  const aba = ABAS[abaIdx];
  const itens = plano[aba.key] as SyncPlanoItem[];

  const setDecisao = (id: string, d: Decisao) =>
    setDecisoes((prev) => ({ ...prev, [id]: d }));

  const marcarTodos = (d: Decisao) =>
    setDecisoes((prev) => {
      const next = { ...prev };
      for (const it of itens) next[itemId(aba.entidade, it.chave)] = d;
      return next;
    });

  const confirmar = () => {
    const payload: SyncPlanoAplicarItem[] = [];
    for (const { entidade, key } of ABAS) {
      for (const it of plano[key] as SyncPlanoItem[]) {
        if (decisoes[itemId(entidade, it.chave)] === 'aplicar') {
          payload.push({ ...it, entidade });
        }
      }
    }
    onAplicar(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {ABAS.map((a, i) => (
          <button key={a.entidade} onClick={() => setAbaIdx(i)}
            className={i === abaIdx ? 'font-bold underline' : ''}>
            {a.label} ({(plano[a.key] as SyncPlanoItem[]).length})
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={() => marcarTodos('aplicar')}>Aplicar todos</button>
        <button onClick={() => marcarTodos('manter')}>Manter todos</button>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {itens.map((it) => {
            const id = itemId(aba.entidade, it.chave);
            const decisao = decisoes[id] ?? 'manter';
            return (
              <tr key={id} className="border-b">
                <td>{it.chave}</td>
                <td>
                  <span data-tipo={it.tipo}>{it.tipo}</span>
                </td>
                <td>
                  {Object.entries(it.diff).map(([campo, v]) => (
                    <div key={campo}>
                      <strong>{campo}:</strong>{' '}
                      {'simpa' in v ? <span>SIMPA={String(v.simpa)}</span> : null}{' '}
                      {'mysql' in v ? <span>MySQL={String(v.mysql)}</span> : null}
                    </div>
                  ))}
                </td>
                <td>
                  <label>
                    <input type="radio" name={id} checked={decisao === 'manter'}
                      onChange={() => setDecisao(id, 'manter')} /> Manter
                  </label>
                  <label>
                    <input type="radio" name={id} checked={decisao === 'aplicar'}
                      onChange={() => setDecisao(id, 'aplicar')} /> Aplicar
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex gap-2">
        <button onClick={onCancelar}>Cancelar</button>
        <button onClick={confirmar}>Confirmar</button>
      </div>
    </div>
  );
}
```

`// ponytail: markup mínimo/sem estilo fino — refinar Tailwind ao integrar no drawer`

- [ ] **Step 4: Rodar, ver passar**

Run: `npm test --prefix simpa-frontend -- SyncPlanoPreview`
Expected: PASS (2 testes).

- [ ] **Step 5: Ligar no `CadastroSyncBanner`**

Em `CadastroSyncBanner.tsx`: trocar a chamada `sincronizarCadastros()` do `handleSync` por `computarSyncPlano()`; guardar o plano em estado; se `resumo` tem itens (`novo+alterado+sumiu > 0` em qualquer entidade) abrir `<SyncPlanoPreview>`, senão toast "Nada a alterar". No `onAplicar`, chamar `aplicarSyncPlano(itens)` e mostrar toast `${aplicados} aplicados, ${pulados} pulados`; fechar preview.

```tsx
import { computarSyncPlano, aplicarSyncPlano } from '../../api/cadastros';
import { SyncPlanoPreview } from './SyncPlanoPreview';
import type { SyncPlano } from '../../types/cadastros';
// ...
const [plano, setPlano] = useState<SyncPlano | null>(null);

const handleSync = async () => {
  setSyncing(true);
  setDegraded(null);
  try {
    const p = await computarSyncPlano();
    const total =
      p.resumo.estabelecimentos.novo + p.resumo.estabelecimentos.alterado + p.resumo.estabelecimentos.sumiu +
      p.resumo.procedimentos.novo + p.resumo.procedimentos.alterado + p.resumo.procedimentos.sumiu;
    if (total === 0) {
      showToast('Nada a alterar — cadastros já em dia');
    } else {
      setPlano(p);
    }
  } catch (err) {
    setDegraded(err instanceof Error ? err.message : 'Falha ao planejar sync');
  } finally {
    setSyncing(false);
  }
};

const handleAplicar = async (itens: Parameters<typeof aplicarSyncPlano>[0]) => {
  if (itens.length === 0) { setPlano(null); return; }
  try {
    const r = await aplicarSyncPlano(itens);
    showToast(`${r.aplicados} aplicados, ${r.pulados} pulados`);
  } catch (err) {
    setDegraded(err instanceof Error ? err.message : 'Falha ao aplicar');
  } finally {
    setPlano(null);
    void carregarUltima();
  }
};
// no JSX, quando plano != null renderizar:
// {plano && <SyncPlanoPreview plano={plano} onAplicar={handleAplicar} onCancelar={() => setPlano(null)} />}
```

- [ ] **Step 6: Rodar suíte frontend de cadastros**

Run: `npm test --prefix simpa-frontend -- Cadastros SyncPlano`
Expected: PASS (incluindo `CadastroSyncBanner` existente, ajustar mocks se referenciarem `sincronizarCadastros`).

- [ ] **Step 7: Commit**

```bash
git add simpa-frontend/src/pages/Cadastros/SyncPlanoPreview.tsx simpa-frontend/src/pages/Cadastros/SyncPlanoPreview.test.tsx simpa-frontend/src/pages/Cadastros/CadastroSyncBanner.tsx
git commit -m "feat(cadastros): preview do sync-plano com gate manter/aplicar no banner"
```

---

## Task 6: Docs

**Files:**
- Modify: `docs/agent/cadastros.md`
- Modify: `docs/agent/backend-api.md` (endpoints)

- [ ] **Step 1: Documentar o workflow**

Em `docs/agent/cadastros.md`, adicionar seção `#### workflow-sync-plano-gate`:
- Fluxo: `POST /sync-plano` (Python `--plan` read-only) → preview → `POST /sync-plano/aplicar` (subset aprovado, transação + guard anti-clobber).
- Escopo: estab+proc. Forma/cbo/rubrica seguem `POST /sincronizar` cego.
- "Manter" = no-op, re-propõe próximo plano. Campos `*_editado=true` não entram no plano.

Em `docs/agent/backend-api.md`, adicionar as 2 rotas na tabela de `/cadastros`.

- [ ] **Step 2: Commit**

```bash
git add docs/agent/cadastros.md docs/agent/backend-api.md
git commit -m "docs(cadastros): documentar gate sync-plano manter/alterar"
```

---

## Self-review (feito)

- **Cobertura da spec:** `--plan` read-only (T1) · endpoint plano (T2) · apply transacional + guard anti-clobber (T3) · tipos/API (T4) · preview por linha + bulk (T5) · docs (T6). Todos os itens da spec mapeados.
- **Sem persistência:** confirmado — nenhuma tabela/migration; plano vive no estado do frontend entre T5 compute e apply. Alinha com a spec.
- **Consistência de tipos:** contrato JSON `{chave, tipo, diff:{campo:{simpa?,mysql?}}}` idêntico em Python (T1), backend (T3 `aplicarPlano`), tipos TS (T4) e preview (T5). `entidade` adicionada só no payload de apply (`SyncPlanoAplicarItem`).
- **Segurança:** apply usa allowlist `CAMPOS_PERMITIDOS` (nome de coluna nunca vem cru do cliente); valores sempre parametrizados; guard anti-clobber previne overwrite de edição concorrente.
