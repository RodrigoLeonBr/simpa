# Vacinas — Importação NIES + Cobertura Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar xlsx de doses aplicadas do NIES via `/importacao` e calcular cobertura vacinal do município por vacina × grupo etário, com população-alvo e esquema de doses cadastrados.

**Architecture:** Espelha o padrão SIH/e-SUS. Parser Python (`parse_vacina_xlsx.py`) chamado por um service Node no upload; tabelas `vacina_*` versionadas por competência; cobertura calculada em SQL no `vacinaService.js`; cadastros (grupos, de-para faixa→grupo, população, esquema) via services dedicados + rotas REST; frontend com seção de import em `/importacao`, página `/vacinas` (matriz heatmap) e páginas de cadastro sob `/cadastros`.

**Tech Stack:** Python 3 + pandas/openpyxl · Node 18 + Express + `pg` · PostgreSQL 15 · React 19 + Vite + Tailwind · Jest (backend) · pytest (ETL) · Vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-09-06-vacinas-cobertura-design.md`

---

## File Structure

**Criar:**
- `migration_036_vacinas.sql` — tabelas `vacina_*`, índices, seed das 20 faixas NIES.
- `parse_vacina_xlsx.py` — parser xlsx → JSON stdout.
- `test_parse_vacina.py` — pytest do parser.
- `simpa-backend/src/services/vacinaImportService.js` — invoca parser, preview, grava carga.
- `simpa-backend/src/services/vacinaService.js` — query de cobertura.
- `simpa-backend/src/services/vacinaCadastroService.js` — CRUD grupos/faixa-grupo/população/esquema.
- `simpa-backend/src/routes/vacina.js` — rotas `/api/vacina/*`.
- `simpa-backend/tests/vacinaService.test.js`, `simpa-backend/tests/vacinaImportService.test.js` — Jest.
- `simpa-frontend/src/api/vacina.ts` — client HTTP.
- `simpa-frontend/src/types/vacina.ts` — tipos.
- `simpa-frontend/src/pages/Importacao/VacinaImportSection.tsx` — upload.
- `simpa-frontend/src/pages/Vacinas/VacinasPage.tsx` — matriz cobertura.
- `simpa-frontend/src/pages/Vacinas/CoberturaMatrix.tsx` — componente da matriz.
- `simpa-frontend/src/pages/Vacinas/__tests__/CoberturaMatrix.test.tsx` — Vitest.
- `simpa-frontend/src/pages/Cadastros/VacinaGruposPage.tsx`, `VacinaFaixaGrupoPage.tsx`, `VacinaPopulacaoPage.tsx`, `VacinaEsquemaPage.tsx`.
- `docs/agent/vacinas.md` — doc do módulo.

**Modificar:**
- `simpa-backend/src/routes/api.js` — montar `/vacina`.
- `docker-compose.yml`, `scripts/apply-migrations.ps1` / `.sh` — registrar migration 036.
- `simpa-frontend/src/App.tsx` — rotas `/vacinas` e cadastros.
- `simpa-frontend/src/config/navigation.ts` — item de nav + route meta.
- `simpa-frontend/src/pages/Importacao/*` — inserir `VacinaImportSection`.
- `CLAUDE.md`, `docs/agent/database.md`, `docs/agent/backend-api.md` — referências.

---

## Phase 1 — Banco de dados

### Task 1: Migration 036 (schema `vacina_*`)

**Files:**
- Create: `migration_036_vacinas.sql`
- Modify: `docker-compose.yml`, `scripts/apply-migrations.ps1`, `scripts/apply-migrations.sh`

- [ ] **Step 1: Escrever a migration**

Create `migration_036_vacinas.sql`:

```sql
-- =============================================================================
-- SIMPA — Migration 036: módulo Vacinas (importação NIES + cobertura)
-- Depends on: schema_full.sql … migration_035_seed_metas_default_2026.sql
-- Apply order: 01 schema → … → 35 metas_default → 36 vacinas
-- Idempotente (IF NOT EXISTS / ON CONFLICT DO NOTHING). Re-run seguro.
--
-- Manual (non-Docker PG):
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_036_vacinas.sql
-- Docker:
--   Get-Content migration_036_vacinas.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- =============================================================================

-- 1. Cargas (uma por upload/competência)
CREATE TABLE IF NOT EXISTS vacina_cargas (
    id            BIGSERIAL PRIMARY KEY,
    competencia   DATE        NOT NULL,               -- 1º dia do mês
    arquivo_nome  TEXT        NOT NULL,
    linhas        INT         NOT NULL DEFAULT 0,
    doses_total   INT         NOT NULL DEFAULT 0,
    importado_por TEXT,
    importado_em  TIMESTAMP   NOT NULL DEFAULT now(),
    status        TEXT        NOT NULL DEFAULT 'ok'
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vacina_cargas_competencia
    ON vacina_cargas (competencia);

-- 2. Fato: doses aplicadas
CREATE TABLE IF NOT EXISTS vacina_doses (
    id             BIGSERIAL PRIMARY KEY,
    carga_id       BIGINT NOT NULL REFERENCES vacina_cargas(id) ON DELETE CASCADE,
    competencia    DATE   NOT NULL,
    cnes_sala      TEXT,
    sala_nome      TEXT,
    imuno_codigo   TEXT   NOT NULL,
    imuno_nome     TEXT   NOT NULL,
    faixa_nies     TEXT   NOT NULL,
    sistema_origem TEXT,
    doses          INT    NOT NULL DEFAULT 0,
    UNIQUE (carga_id, cnes_sala, imuno_codigo, faixa_nies, sistema_origem)
);
CREATE INDEX IF NOT EXISTS idx_vacina_doses_competencia
    ON vacina_doses (competencia, imuno_codigo);
CREATE INDEX IF NOT EXISTS idx_vacina_doses_faixa
    ON vacina_doses (faixa_nies);

-- 3. Catálogo de imunobiológicos (upsert no import)
CREATE TABLE IF NOT EXISTS vacina_imunobiologicos (
    imuno_codigo TEXT PRIMARY KEY,
    imuno_nome   TEXT NOT NULL
);

-- 4. Grupos etários customizados
CREATE TABLE IF NOT EXISTS vacina_grupos (
    id    BIGSERIAL PRIMARY KEY,
    nome  TEXT NOT NULL,
    slug  TEXT NOT NULL UNIQUE,
    ordem INT  NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true
);

-- 5. De-para faixa NIES → grupo
CREATE TABLE IF NOT EXISTS vacina_faixa_grupo (
    faixa_nies TEXT PRIMARY KEY,
    grupo_id   BIGINT REFERENCES vacina_grupos(id) ON DELETE SET NULL
);

-- Seed das 20 faixas NIES (grupo_id NULL = ainda não mapeado)
INSERT INTO vacina_faixa_grupo (faixa_nies) VALUES
    ('< 1 ano'), ('01 ano'), ('02 a 04 anos'), ('05 a 11 anos'),
    ('12 a 17 anos'), ('18 a 19 anos'), ('20 a 24 anos'), ('25 a 29 anos'),
    ('30 a 34 anos'), ('35 a 39 anos'), ('40 a 44 anos'), ('45 a 49 anos'),
    ('50 a 54 anos'), ('55 a 59 anos'), ('60 a 64 anos'), ('65 a 69 anos'),
    ('70 a 74 anos'), ('75 a 79 anos'), ('80 anos ou mais'), ('Ignorada')
ON CONFLICT (faixa_nies) DO NOTHING;

-- 6. População alvo por ano × grupo
CREATE TABLE IF NOT EXISTS vacina_populacao_alvo (
    id        BIGSERIAL PRIMARY KEY,
    ano       INT    NOT NULL,
    grupo_id  BIGINT NOT NULL REFERENCES vacina_grupos(id) ON DELETE CASCADE,
    populacao INT    NOT NULL DEFAULT 0,
    UNIQUE (ano, grupo_id)
);

-- 7. Esquema de doses por vacina × grupo (define alvos + multiplicador)
CREATE TABLE IF NOT EXISTS vacina_esquema (
    id           BIGSERIAL PRIMARY KEY,
    imuno_codigo TEXT   NOT NULL,
    grupo_id     BIGINT NOT NULL REFERENCES vacina_grupos(id) ON DELETE CASCADE,
    num_doses    INT    NOT NULL CHECK (num_doses > 0),
    UNIQUE (imuno_codigo, grupo_id)
);

COMMENT ON TABLE vacina_doses IS
    'Fato de doses aplicadas (NIES). Grão: carga × sala × imuno × faixa × sistema.';
COMMENT ON TABLE vacina_esquema IS
    'Nº de doses do esquema por vacina×grupo. Ausência de linha = vacina não-alvo no grupo.';
```

> **Nota sobre as faixas seed:** os rótulos acima são a hipótese completa das 20 faixas. Na Task 6 o parser vai emitir os rótulos reais dos xlsx; se algum diferir, ajustar o seed aqui e re-rodar a migration (idempotente). A verdade das faixas sai de `SELECT DISTINCT "Idade"` nos 3 arquivos.

- [ ] **Step 2: Registrar a migration nos scripts de apply e no compose**

Em `docker-compose.yml`, adicionar o volume de init logo após a linha da migration 035 (mesmo formato das anteriores):

```yaml
      - ./migration_036_vacinas.sql:/docker-entrypoint-initdb.d/36_vacinas.sql:ro
```

Em `scripts/apply-migrations.ps1` e `scripts/apply-migrations.sh`, acrescentar `migration_036_vacinas.sql` na lista ordenada de migrations (seguir o formato exato já usado para a 035 no arquivo).

- [ ] **Step 3: Aplicar e verificar as faixas reais**

Run:
```powershell
Get-Content migration_036_vacinas.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
docker exec -i simpa-postgres-1 psql -U postgres -d simpa -c "\dt vacina_*"
```
Expected: 7 tabelas `vacina_*` listadas, sem erro. `SELECT count(*) FROM vacina_faixa_grupo;` → 20.

- [ ] **Step 4: Commit**

```bash
git add migration_036_vacinas.sql docker-compose.yml scripts/apply-migrations.ps1 scripts/apply-migrations.sh
git commit -m "feat(vacinas): migration 036 — schema vacina_* + seed faixas NIES"
```

---

## Phase 2 — Parser Python

### Task 2: `parse_vacina_xlsx.py` (TDD)

**Files:**
- Create: `parse_vacina_xlsx.py`
- Test: `test_parse_vacina.py`

- [ ] **Step 1: Escrever o teste que falha**

Create `test_parse_vacina.py`:

```python
import json
import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).parent


def _make_xlsx(tmp_path, rows, filtro="NM_MUNICIPIO … AMERICANA\nAno … 2026\nMês … janeiro"):
    cols = ['DRS', 'GVE', 'RS', 'Município', 'Sala de Vacina',
            'Imunibiológico', 'Total doses aplicadas', 'Idade', 'Sistema Origem']
    df = pd.DataFrame(rows, columns=cols)
    # rodapé: linha vazia + linha de filtros no campo DRS
    footer = pd.DataFrame(
        [[None] * 9, [f"Filtros aplicados:\n{filtro}"] + [None] * 8],
        columns=cols,
    )
    df = pd.concat([df, footer], ignore_index=True)
    path = tmp_path / "vacina_jan_2026.xlsx"
    with pd.ExcelWriter(path, engine="openpyxl") as w:
        df.to_excel(w, sheet_name="Export", index=False)
    return path


def _run(path):
    out = subprocess.run(
        [sys.executable, str(ROOT / "parse_vacina_xlsx.py"), str(path)],
        capture_output=True, text=True, encoding="utf-8",
    )
    assert out.returncode == 0, out.stderr
    return json.loads(out.stdout)


def test_descarta_rodape_e_normaliza(tmp_path):
    path = _make_xlsx(tmp_path, [
        ['CAMPINAS', 'CAMPINAS', 'REG METRO CAMPINAS', 'AMERICANA',
         '4032128 - UBS DONA ROSA', '93 - VACINA HPV NONAVALENTE',
         3.0, '05 a 11 anos', 'NOVO PNI'],
    ])
    res = _run(path)
    assert res['competencia'] == '2026-01-01'
    assert res['doses_total'] == 3
    assert len(res['linhas']) == 1          # rodapé descartado
    linha = res['linhas'][0]
    assert linha['cnes_sala'] == '4032128'
    assert linha['sala_nome'] == 'UBS DONA ROSA'
    assert linha['imuno_codigo'] == '93'
    assert linha['imuno_nome'] == 'VACINA HPV NONAVALENTE'
    assert linha['faixa_nies'] == '05 a 11 anos'
    assert linha['doses'] == 3
    assert 'ç' in linha['imuno_nome'] or 'HPV' in linha['imuno_nome']  # UTF-8 ok


def test_ignora_municipio_diferente(tmp_path):
    path = _make_xlsx(tmp_path, [
        ['CAMPINAS', 'CAMPINAS', 'REG', 'CAMPINAS',
         '1 - X', '9 - VACINA HEPATITE B', 5.0, '01 ano', 'NOVO PNI'],
        ['CAMPINAS', 'CAMPINAS', 'REG', 'AMERICANA',
         '2 - Y', '9 - VACINA HEPATITE B', 2.0, '01 ano', 'NOVO PNI'],
    ])
    res = _run(path)
    assert len(res['linhas']) == 1
    assert res['linhas'][0]['sala_nome'] == 'Y'
    assert res['doses_total'] == 2


def test_competencia_fallback_nome_arquivo(tmp_path):
    path = _make_xlsx(tmp_path, [
        ['C', 'C', 'R', 'AMERICANA', '1 - X', '9 - V', 1.0, '01 ano', 'NOVO PNI'],
    ], filtro="sem mes aqui")
    res = _run(path)
    assert res['competencia'] == '2026-01-01'  # de vacina_jan_2026.xlsx
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `python -m pytest test_parse_vacina.py -v`
Expected: FAIL (arquivo `parse_vacina_xlsx.py` não existe / erro de import).

- [ ] **Step 3: Implementar o parser**

Create `parse_vacina_xlsx.py`:

```python
#!/usr/bin/env python3
"""
SIMPA — Parser dos relatórios de doses aplicadas do NIES.
Lê o xlsx (aba 'Export'), descarta rodapé, normaliza e emite JSON em stdout:
    { "competencia": "YYYY-MM-01", "doses_total": int, "linhas": [ ... ] }

Uso: python parse_vacina_xlsx.py <arquivo.xlsx>
"""
import json
import re
import sys
import warnings
from pathlib import Path

import pandas as pd

warnings.simplefilter("ignore")  # openpyxl default-style warning

MESES = {
    'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3, 'abril': 4,
    'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8, 'setembro': 9,
    'outubro': 10, 'novembro': 11, 'dezembro': 12,
}
MES_ABBR = {'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
            'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12}


def _split_codigo_nome(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None, None
    s = str(value)
    m = re.match(r'^\s*([^\-]+?)\s*-\s*(.+)$', s)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return None, s.strip()


def _competencia(df_full, path):
    # tenta a linha "Filtros aplicados"
    ano = mes = None
    for cell in df_full.iloc[:, 0].dropna().astype(str):
        if 'Filtros aplicados' in cell or 'Ano' in cell or 'Mês' in cell:
            ma = re.search(r'Ano\D+(\d{4})', cell)
            mm = re.search(r'M[êe]s\D+([a-zçã]+)', cell, re.IGNORECASE)
            if ma:
                ano = int(ma.group(1))
            if mm:
                mes = MESES.get(mm.group(1).strip().lower())
    # fallback: nome do arquivo vacina_<mmm>_<yyyy>.xlsx
    if ano is None or mes is None:
        fm = re.search(r'_([a-z]{3})_(\d{4})', Path(path).stem, re.IGNORECASE)
        if fm:
            mes = mes or MES_ABBR.get(fm.group(1).lower())
            ano = ano or int(fm.group(2))
    if ano is None or mes is None:
        return None
    return f"{ano:04d}-{mes:02d}-01"


def main():
    path = sys.argv[1]
    df_full = pd.read_excel(path, sheet_name='Export', header=0)
    competencia = _competencia(df_full, path)

    # descarta rodapé: doses nulas
    df = df_full.dropna(subset=['Total doses aplicadas']).copy()
    # só AMERICANA
    df = df[df['Município'].astype(str).str.upper().str.strip() == 'AMERICANA']

    linhas = []
    total = 0
    for _, r in df.iterrows():
        cnes, sala = _split_codigo_nome(r['Sala de Vacina'])
        icod, inome = _split_codigo_nome(r['Imunibiológico'])
        doses = int(round(float(r['Total doses aplicadas'])))
        total += doses
        linhas.append({
            'cnes_sala': cnes,
            'sala_nome': sala,
            'imuno_codigo': icod,
            'imuno_nome': inome,
            'faixa_nies': None if pd.isna(r['Idade']) else str(r['Idade']).strip(),
            'sistema_origem': None if pd.isna(r['Sistema Origem']) else str(r['Sistema Origem']).strip(),
            'doses': doses,
        })

    sys.stdout.write(json.dumps({
        'competencia': competencia,
        'doses_total': total,
        'linhas': linhas,
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
```

> Confirmar os rótulos reais das faixas (`SELECT DISTINCT "Idade"`) na Step 5 e ajustar o seed da Task 1 se divergirem.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `python -m pytest test_parse_vacina.py -v`
Expected: 3 PASS.

- [ ] **Step 5: Rodar contra os arquivos reais**

Run: `python parse_vacina_xlsx.py vacina_jan_2026.xlsx | python -c "import json,sys; d=json.load(sys.stdin); print(d['competencia'], d['doses_total'], len(d['linhas']))"`
Expected: `2026-01-01 13742 <n>` (doses_total bate com a análise: jan=13742).

- [ ] **Step 6: Commit**

```bash
git add parse_vacina_xlsx.py test_parse_vacina.py
git commit -m "feat(vacinas): parser xlsx NIES + pytest"
```

---

## Phase 3 — Backend import

### Task 3: `vacinaImportService.js` (preview + gravação)

**Files:**
- Create: `simpa-backend/src/services/vacinaImportService.js`
- Test: `simpa-backend/tests/vacinaImportService.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Create `simpa-backend/tests/vacinaImportService.test.js`:

```js
const { parseUpload, gravarCarga } = require('../src/services/vacinaImportService');

jest.mock('../src/services/db', () => ({ query: jest.fn(), getPool: jest.fn() }));

describe('vacinaImportService.gravarCarga', () => {
  it('substitui carga existente da mesma competência (sem dupla contagem)', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 7 }] }) };
    const pool = { connect: jest.fn().mockResolvedValue(client) };
    require('../src/services/db').getPool.mockReturnValue(pool);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // DELETE carga anterior
      .mockResolvedValueOnce({ rows: [{ id: 7 }] }) // INSERT carga
      .mockResolvedValue({}); // demais inserts + COMMIT

    const parsed = {
      competencia: '2026-01-01', doses_total: 3, arquivo_nome: 'x.xlsx',
      linhas: [{ cnes_sala: '1', sala_nome: 'A', imuno_codigo: '93',
        imuno_nome: 'HPV', faixa_nies: '05 a 11 anos', sistema_origem: 'NOVO PNI', doses: 3 }],
    };
    const res = await gravarCarga(parsed, 'user@x');
    const sqls = client.query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => /DELETE FROM vacina_cargas/i.test(s))).toBe(true);
    expect(res.carga_id).toBe(7);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test --prefix simpa-backend -- vacinaImportService`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar o service**

Create `simpa-backend/src/services/vacinaImportService.js`:

```js
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { getPool } = require('./db');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const PARSER = path.join(REPO_ROOT, 'parse_vacina_xlsx.py');

function pythonBin() {
  return process.env.PYTHON_BIN || 'python3';
}

// Invoca o parser Python sobre um arquivo temporário; resolve o JSON.
function parseUpload(xlsxPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonBin(), [PARSER, xlsxPath]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => { stdout += c.toString(); });
    proc.stderr.on('data', (c) => { stderr += c.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || `parser exit ${code}`));
      try { resolve(JSON.parse(stdout.trim())); }
      catch (e) { reject(new Error(`JSON inválido do parser: ${e.message}`)); }
    });
  });
}

// Grava a carga: DELETE da competência anterior + INSERT (transação).
async function gravarCarga(parsed, importadoPor) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM vacina_cargas WHERE competencia = $1', [parsed.competencia]);
    const carga = await client.query(
      `INSERT INTO vacina_cargas (competencia, arquivo_nome, linhas, doses_total, importado_por)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [parsed.competencia, parsed.arquivo_nome, parsed.linhas.length, parsed.doses_total, importadoPor],
    );
    const cargaId = carga.rows[0].id;

    for (const l of parsed.linhas) {
      await client.query(
        `INSERT INTO vacina_doses
           (carga_id, competencia, cnes_sala, sala_nome, imuno_codigo, imuno_nome, faixa_nies, sistema_origem, doses)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (carga_id, cnes_sala, imuno_codigo, faixa_nies, sistema_origem)
         DO UPDATE SET doses = vacina_doses.doses + EXCLUDED.doses`,
        [cargaId, parsed.competencia, l.cnes_sala, l.sala_nome, l.imuno_codigo,
         l.imuno_nome, l.faixa_nies, l.sistema_origem, l.doses],
      );
      await client.query(
        `INSERT INTO vacina_imunobiologicos (imuno_codigo, imuno_nome)
         VALUES ($1,$2) ON CONFLICT (imuno_codigo) DO UPDATE SET imuno_nome = EXCLUDED.imuno_nome`,
        [l.imuno_codigo, l.imuno_nome],
      );
    }
    await client.query('COMMIT');
    return { carga_id: cargaId, competencia: parsed.competencia, doses_total: parsed.doses_total, linhas: parsed.linhas.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Preview: parse + relatório de faixas não mapeadas e imunos novos.
async function analisarPreview(parsed) {
  const { query } = require('./db');
  const mapeadas = await query('SELECT faixa_nies FROM vacina_faixa_grupo WHERE grupo_id IS NOT NULL');
  const set = new Set(mapeadas.rows.map((r) => r.faixa_nies));
  const faixasNaoMapeadas = [...new Set(parsed.linhas.map((l) => l.faixa_nies))].filter((f) => !set.has(f));
  return {
    competencia: parsed.competencia,
    doses_total: parsed.doses_total,
    linhas: parsed.linhas.length,
    faixas_nao_mapeadas: faixasNaoMapeadas,
  };
}

module.exports = { parseUpload, gravarCarga, analisarPreview, pythonBin };
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test --prefix simpa-backend -- vacinaImportService`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add simpa-backend/src/services/vacinaImportService.js simpa-backend/tests/vacinaImportService.test.js
git commit -m "feat(vacinas): service de import (preview + gravação transacional)"
```

---

## Phase 4 — Backend cobertura

### Task 4: `vacinaService.js` (cálculo de cobertura, TDD)

**Files:**
- Create: `simpa-backend/src/services/vacinaService.js`
- Test: `simpa-backend/tests/vacinaService.test.js`

- [ ] **Step 1: Escrever o teste que falha**

Create `simpa-backend/tests/vacinaService.test.js`:

```js
const { computeCobertura } = require('../src/services/vacinaService');

describe('computeCobertura', () => {
  const base = [
    { imuno_codigo: '93', imuno_nome: 'HPV', grupo_id: 1, grupo_nome: 'Adolescente',
      doses: 200, pop_alvo: 100, num_doses: 2 },
    { imuno_codigo: '9', imuno_nome: 'Hep B', grupo_id: 1, grupo_nome: 'Adolescente',
      doses: 50, pop_alvo: 0, num_doses: 3 },
    { imuno_codigo: '33', imuno_nome: 'Influenza', grupo_id: 2, grupo_nome: 'Idoso',
      doses: 900, pop_alvo: 1000, num_doses: 1 },
  ];

  it('cobertura = doses / (pop × esquema)', () => {
    const out = computeCobertura(base);
    const hpv = out.find((r) => r.imuno_codigo === '93');
    expect(hpv.denominador).toBe(200);          // 100 × 2
    expect(hpv.cobertura_pct).toBeCloseTo(100);  // 200/200
    const flu = out.find((r) => r.imuno_codigo === '33');
    expect(flu.cobertura_pct).toBeCloseTo(90);   // 900/1000
  });

  it('pop_alvo = 0 → cobertura null, sem crash', () => {
    const out = computeCobertura(base);
    const hep = out.find((r) => r.imuno_codigo === '9');
    expect(hep.cobertura_pct).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test --prefix simpa-backend -- vacinaService`
Expected: FAIL.

- [ ] **Step 3: Implementar o service**

Create `simpa-backend/src/services/vacinaService.js`:

```js
'use strict';

const { query } = require('./db');

// Transforma linhas agregadas (doses, pop_alvo, num_doses) em cobertura %.
function computeCobertura(rows) {
  return rows.map((r) => {
    const denom = Number(r.pop_alvo) * Number(r.num_doses);
    const cobertura = denom > 0 ? (Number(r.doses) / denom) * 100 : null;
    return {
      imuno_codigo: r.imuno_codigo,
      imuno_nome: r.imuno_nome,
      grupo_id: r.grupo_id,
      grupo_nome: r.grupo_nome,
      doses: Number(r.doses),
      pop_alvo: Number(r.pop_alvo),
      num_doses: Number(r.num_doses),
      denominador: denom,
      cobertura_pct: cobertura,
    };
  });
}

// ano + competencia_ate (YYYY-MM-DD): soma acumulada jan→mês, por vacina×grupo.
async function getCobertura({ ano, competenciaAte, grupoId = null, imunoCodigo = null }) {
  const inicio = `${ano}-01-01`;
  const { rows } = await query(
    `SELECT e.imuno_codigo,
            COALESCE(i.imuno_nome, e.imuno_codigo) AS imuno_nome,
            e.grupo_id,
            g.nome AS grupo_nome,
            e.num_doses,
            COALESCE(p.populacao, 0) AS pop_alvo,
            COALESCE(SUM(d.doses), 0) AS doses
       FROM vacina_esquema e
       JOIN vacina_grupos g ON g.id = e.grupo_id
       LEFT JOIN vacina_imunobiologicos i ON i.imuno_codigo = e.imuno_codigo
       LEFT JOIN vacina_populacao_alvo p ON p.grupo_id = e.grupo_id AND p.ano = $1
       LEFT JOIN vacina_faixa_grupo fg ON fg.grupo_id = e.grupo_id
       LEFT JOIN vacina_doses d
              ON d.imuno_codigo = e.imuno_codigo
             AND d.faixa_nies = fg.faixa_nies
             AND d.competencia BETWEEN $2 AND $3
      WHERE ($4::bigint IS NULL OR e.grupo_id = $4)
        AND ($5::text   IS NULL OR e.imuno_codigo = $5)
      GROUP BY e.imuno_codigo, i.imuno_nome, e.grupo_id, g.nome, e.num_doses, p.populacao
      ORDER BY g.nome, imuno_nome`,
    [ano, inicio, competenciaAte, grupoId, imunoCodigo],
  );
  return computeCobertura(rows);
}

module.exports = { computeCobertura, getCobertura };
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test --prefix simpa-backend -- vacinaService`
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add simpa-backend/src/services/vacinaService.js simpa-backend/tests/vacinaService.test.js
git commit -m "feat(vacinas): service de cobertura (doses/(pop×esquema), acumulado no ano)"
```

---

## Phase 5 — Backend cadastros + rotas

### Task 5: `vacinaCadastroService.js`

**Files:**
- Create: `simpa-backend/src/services/vacinaCadastroService.js`

- [ ] **Step 1: Implementar CRUD dos 4 cadastros**

Create `simpa-backend/src/services/vacinaCadastroService.js`:

```js
'use strict';

const { query } = require('./db');

// --- Grupos ---
const listGrupos = async () =>
  (await query('SELECT id, nome, slug, ordem, ativo FROM vacina_grupos ORDER BY ordem, nome')).rows;

const createGrupo = async ({ nome, slug, ordem = 0 }) =>
  (await query(
    'INSERT INTO vacina_grupos (nome, slug, ordem) VALUES ($1,$2,$3) RETURNING *',
    [nome, slug, ordem],
  )).rows[0];

const updateGrupo = async (id, { nome, slug, ordem, ativo }) =>
  (await query(
    `UPDATE vacina_grupos SET nome=COALESCE($2,nome), slug=COALESCE($3,slug),
        ordem=COALESCE($4,ordem), ativo=COALESCE($5,ativo) WHERE id=$1 RETURNING *`,
    [id, nome, slug, ordem, ativo],
  )).rows[0];

// --- De-para faixa → grupo ---
const listFaixaGrupo = async () =>
  (await query(
    `SELECT fg.faixa_nies, fg.grupo_id, g.nome AS grupo_nome
       FROM vacina_faixa_grupo fg LEFT JOIN vacina_grupos g ON g.id = fg.grupo_id
       ORDER BY fg.faixa_nies`,
  )).rows;

const setFaixaGrupo = async (faixa, grupoId) =>
  (await query(
    `UPDATE vacina_faixa_grupo SET grupo_id=$2 WHERE faixa_nies=$1 RETURNING *`,
    [faixa, grupoId],
  )).rows[0];

// --- População alvo ---
const listPopulacao = async (ano) =>
  (await query(
    `SELECT p.id, p.ano, p.grupo_id, g.nome AS grupo_nome, p.populacao
       FROM vacina_populacao_alvo p JOIN vacina_grupos g ON g.id = p.grupo_id
      WHERE ($1::int IS NULL OR p.ano = $1) ORDER BY p.ano DESC, g.nome`,
    [ano ?? null],
  )).rows;

const upsertPopulacao = async ({ ano, grupo_id, populacao }) =>
  (await query(
    `INSERT INTO vacina_populacao_alvo (ano, grupo_id, populacao) VALUES ($1,$2,$3)
       ON CONFLICT (ano, grupo_id) DO UPDATE SET populacao = EXCLUDED.populacao RETURNING *`,
    [ano, grupo_id, populacao],
  )).rows[0];

// --- Esquema ---
const listEsquema = async () =>
  (await query(
    `SELECT e.id, e.imuno_codigo, COALESCE(i.imuno_nome, e.imuno_codigo) AS imuno_nome,
            e.grupo_id, g.nome AS grupo_nome, e.num_doses
       FROM vacina_esquema e
       JOIN vacina_grupos g ON g.id = e.grupo_id
       LEFT JOIN vacina_imunobiologicos i ON i.imuno_codigo = e.imuno_codigo
      ORDER BY imuno_nome, g.nome`,
  )).rows;

const upsertEsquema = async ({ imuno_codigo, grupo_id, num_doses }) =>
  (await query(
    `INSERT INTO vacina_esquema (imuno_codigo, grupo_id, num_doses) VALUES ($1,$2,$3)
       ON CONFLICT (imuno_codigo, grupo_id) DO UPDATE SET num_doses = EXCLUDED.num_doses RETURNING *`,
    [imuno_codigo, grupo_id, num_doses],
  )).rows[0];

const deleteEsquema = async (id) =>
  (await query('DELETE FROM vacina_esquema WHERE id=$1 RETURNING id', [id])).rows[0];

const listImunobiologicos = async () =>
  (await query('SELECT imuno_codigo, imuno_nome FROM vacina_imunobiologicos ORDER BY imuno_nome')).rows;

module.exports = {
  listGrupos, createGrupo, updateGrupo,
  listFaixaGrupo, setFaixaGrupo,
  listPopulacao, upsertPopulacao,
  listEsquema, upsertEsquema, deleteEsquema,
  listImunobiologicos,
};
```

- [ ] **Step 2: Commit**

```bash
git add simpa-backend/src/services/vacinaCadastroService.js
git commit -m "feat(vacinas): service de cadastros (grupos, faixa-grupo, população, esquema)"
```

### Task 6: `routes/vacina.js` + montagem

**Files:**
- Create: `simpa-backend/src/routes/vacina.js`
- Modify: `simpa-backend/src/routes/api.js`

- [ ] **Step 1: Implementar as rotas**

Create `simpa-backend/src/routes/vacina.js`:

```js
'use strict';

const express = require('express');
const os = require('os');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const requirePlanningStaff = require('../middleware/requirePlanningStaff');
const importSvc = require('../services/vacinaImportService');
const cadastro = require('../services/vacinaCadastroService');
const { getCobertura } = require('../services/vacinaService');

const upload = multer({ dest: os.tmpdir() });
const router = express.Router();

function parseAno(v) {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) && n >= 2000 && n <= 2100 ? n : null;
}
function normalizeCompetencia(c) {
  if (!c || !/^\d{4}-\d{2}$/.test(c)) return null;
  const mes = parseInt(c.split('-')[1], 10);
  return mes >= 1 && mes <= 12 ? `${c}-01` : null;
}

// --- Importação ---
router.post('/importacao/preview', requirePlanningStaff, upload.single('arquivo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'arquivo obrigatório' });
    const parsed = await importSvc.parseUpload(req.file.path);
    parsed.arquivo_nome = req.file.originalname;
    if (!parsed.competencia) return res.status(422).json({ error: 'competência não detectada; informe manualmente' });
    const preview = await importSvc.analisarPreview(parsed);
    res.json(preview);
  } catch (err) { next(err); }
  finally { if (req.file) fs.unlink(req.file.path, () => {}); }
});

router.post('/importacao', requirePlanningStaff, upload.single('arquivo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'arquivo obrigatório' });
    const parsed = await importSvc.parseUpload(req.file.path);
    parsed.arquivo_nome = req.file.originalname;
    if (req.body.competencia) {
      const c = normalizeCompetencia(req.body.competencia);
      if (!c) return res.status(400).json({ error: 'competencia deve ser YYYY-MM' });
      parsed.competencia = c;
    }
    if (!parsed.competencia) return res.status(422).json({ error: 'competência não detectada' });
    const result = await importSvc.gravarCarga(parsed, req.user?.email || null);
    res.status(201).json(result);
  } catch (err) { next(err); }
  finally { if (req.file) fs.unlink(req.file.path, () => {}); }
});

router.get('/cargas', async (req, res, next) => {
  try {
    const { query } = require('../services/db');
    const { rows } = await query('SELECT * FROM vacina_cargas ORDER BY competencia DESC');
    res.json(rows);
  } catch (err) { next(err); }
});

// --- Cobertura ---
router.get('/cobertura', async (req, res, next) => {
  try {
    const ano = parseAno(req.query.ano);
    if (!ano) return res.status(400).json({ error: 'ano inválido' });
    const competenciaAte = normalizeCompetencia(req.query.competencia) || `${ano}-12-01`;
    const grupoId = req.query.grupo_id ? Number.parseInt(String(req.query.grupo_id), 10) : null;
    const imunoCodigo = req.query.imuno_codigo ? String(req.query.imuno_codigo) : null;
    const data = await getCobertura({ ano, competenciaAte, grupoId, imunoCodigo });
    res.json(data);
  } catch (err) { next(err); }
});

// --- Cadastros ---
router.get('/imunobiologicos', async (req, res, next) => { try { res.json(await cadastro.listImunobiologicos()); } catch (e) { next(e); } });

router.get('/grupos', async (req, res, next) => { try { res.json(await cadastro.listGrupos()); } catch (e) { next(e); } });
router.post('/grupos', requirePlanningStaff, async (req, res, next) => { try { res.status(201).json(await cadastro.createGrupo(req.body)); } catch (e) { next(e); } });
router.put('/grupos/:id', requirePlanningStaff, async (req, res, next) => { try { res.json(await cadastro.updateGrupo(Number(req.params.id), req.body)); } catch (e) { next(e); } });

router.get('/faixa-grupo', async (req, res, next) => { try { res.json(await cadastro.listFaixaGrupo()); } catch (e) { next(e); } });
router.put('/faixa-grupo/:faixa', requirePlanningStaff, async (req, res, next) => { try { res.json(await cadastro.setFaixaGrupo(req.params.faixa, req.body.grupo_id ?? null)); } catch (e) { next(e); } });

router.get('/populacao', async (req, res, next) => { try { res.json(await cadastro.listPopulacao(req.query.ano ? Number(req.query.ano) : null)); } catch (e) { next(e); } });
router.post('/populacao', requirePlanningStaff, async (req, res, next) => { try { res.status(201).json(await cadastro.upsertPopulacao(req.body)); } catch (e) { next(e); } });

router.get('/esquema', async (req, res, next) => { try { res.json(await cadastro.listEsquema()); } catch (e) { next(e); } });
router.post('/esquema', requirePlanningStaff, async (req, res, next) => { try { res.status(201).json(await cadastro.upsertEsquema(req.body)); } catch (e) { next(e); } });
router.delete('/esquema/:id', requirePlanningStaff, async (req, res, next) => { try { res.json(await cadastro.deleteEsquema(Number(req.params.id))); } catch (e) { next(e); } });

module.exports = router;
```

> **Dependência `multer`:** verificar se já está em `simpa-backend/package.json` (o import e-SUS usa upload). Se não estiver, `npm install multer --prefix simpa-backend` e commitar o lockfile. Se o projeto já tem um middleware de upload próprio, reusar em vez de multer.

- [ ] **Step 2: Montar em `routes/api.js`**

Modify `simpa-backend/src/routes/api.js` — adicionar após a linha `const populacaoRoutes = require('./populacao');`:

```js
const vacinaRoutes = require('./vacina');
```
e após `router.use('/populacao', populacaoRoutes);`:
```js
router.use('/vacina', vacinaRoutes);
```

- [ ] **Step 3: Smoke test manual**

Run (com backend em `:3001` e JWT válido):
```powershell
curl "http://localhost:3001/api/vacina/cobertura?ano=2026" -H "Authorization: Bearer $token"
```
Expected: `200` com `[]` (sem esquema cadastrado ainda) — não `404`.

- [ ] **Step 4: Commit**

```bash
git add simpa-backend/src/routes/vacina.js simpa-backend/src/routes/api.js simpa-backend/package.json
git commit -m "feat(vacinas): rotas /api/vacina (import, cobertura, cadastros)"
```

---

## Phase 6 — Frontend: client, tipos, import

### Task 7: `types/vacina.ts` + `api/vacina.ts`

**Files:**
- Create: `simpa-frontend/src/types/vacina.ts`, `simpa-frontend/src/api/vacina.ts`

- [ ] **Step 1: Tipos**

Create `simpa-frontend/src/types/vacina.ts`:

```ts
export interface VacinaImportPreview {
  competencia: string;
  doses_total: number;
  linhas: number;
  faixas_nao_mapeadas: string[];
}

export interface CoberturaRow {
  imuno_codigo: string;
  imuno_nome: string;
  grupo_id: number;
  grupo_nome: string;
  doses: number;
  pop_alvo: number;
  num_doses: number;
  denominador: number;
  cobertura_pct: number | null;
}

export interface VacinaGrupo { id: number; nome: string; slug: string; ordem: number; ativo: boolean; }
export interface FaixaGrupo { faixa_nies: string; grupo_id: number | null; grupo_nome: string | null; }
export interface PopulacaoAlvo { id: number; ano: number; grupo_id: number; grupo_nome: string; populacao: number; }
export interface Esquema { id: number; imuno_codigo: string; imuno_nome: string; grupo_id: number; grupo_nome: string; num_doses: number; }
export interface Imunobiologico { imuno_codigo: string; imuno_nome: string; }
```

- [ ] **Step 2: Client HTTP** (seguir o padrão de `api/cadastros.ts` / `apiFetch`)

Create `simpa-frontend/src/api/vacina.ts`:

```ts
import { apiFetch } from './client';
import type {
  CoberturaRow, VacinaGrupo, FaixaGrupo, PopulacaoAlvo, Esquema, Imunobiologico, VacinaImportPreview,
} from '../types/vacina';

export function previewVacina(file: File): Promise<VacinaImportPreview> {
  const fd = new FormData();
  fd.append('arquivo', file);
  return apiFetch('/api/vacina/importacao/preview', { method: 'POST', body: fd });
}
export function importVacina(file: File, competencia?: string): Promise<{ carga_id: number; competencia: string; doses_total: number }> {
  const fd = new FormData();
  fd.append('arquivo', file);
  if (competencia) fd.append('competencia', competencia);
  return apiFetch('/api/vacina/importacao', { method: 'POST', body: fd });
}
export function fetchCobertura(params: { ano: number; competencia?: string; grupo_id?: number; imuno_codigo?: string }): Promise<CoberturaRow[]> {
  const q = new URLSearchParams({ ano: String(params.ano) });
  if (params.competencia) q.set('competencia', params.competencia);
  if (params.grupo_id) q.set('grupo_id', String(params.grupo_id));
  if (params.imuno_codigo) q.set('imuno_codigo', params.imuno_codigo);
  return apiFetch(`/api/vacina/cobertura?${q.toString()}`);
}
export const fetchGrupos = (): Promise<VacinaGrupo[]> => apiFetch('/api/vacina/grupos');
export const createGrupo = (b: { nome: string; slug: string; ordem?: number }): Promise<VacinaGrupo> => apiFetch('/api/vacina/grupos', { method: 'POST', body: JSON.stringify(b) });
export const updateGrupo = (id: number, b: Partial<VacinaGrupo>): Promise<VacinaGrupo> => apiFetch(`/api/vacina/grupos/${id}`, { method: 'PUT', body: JSON.stringify(b) });
export const fetchFaixaGrupo = (): Promise<FaixaGrupo[]> => apiFetch('/api/vacina/faixa-grupo');
export const setFaixaGrupo = (faixa: string, grupo_id: number | null): Promise<FaixaGrupo> => apiFetch(`/api/vacina/faixa-grupo/${encodeURIComponent(faixa)}`, { method: 'PUT', body: JSON.stringify({ grupo_id }) });
export const fetchPopulacao = (ano?: number): Promise<PopulacaoAlvo[]> => apiFetch(`/api/vacina/populacao${ano ? `?ano=${ano}` : ''}`);
export const upsertPopulacao = (b: { ano: number; grupo_id: number; populacao: number }): Promise<PopulacaoAlvo> => apiFetch('/api/vacina/populacao', { method: 'POST', body: JSON.stringify(b) });
export const fetchEsquema = (): Promise<Esquema[]> => apiFetch('/api/vacina/esquema');
export const upsertEsquema = (b: { imuno_codigo: string; grupo_id: number; num_doses: number }): Promise<Esquema> => apiFetch('/api/vacina/esquema', { method: 'POST', body: JSON.stringify(b) });
export const deleteEsquema = (id: number): Promise<{ id: number }> => apiFetch(`/api/vacina/esquema/${id}`, { method: 'DELETE' });
export const fetchImunobiologicos = (): Promise<Imunobiologico[]> => apiFetch('/api/vacina/imunobiologicos');
```

> Confirmar o nome/assinatura reais do helper (`apiFetch` vs `client`) em `simpa-frontend/src/api/` e ajustar o import. Se `apiFetch` já injeta `Content-Type: application/json`, garantir que uploads `FormData` não fixem esse header (deixar o browser setar o boundary).

- [ ] **Step 3: Commit**

```bash
git add simpa-frontend/src/types/vacina.ts simpa-frontend/src/api/vacina.ts
git commit -m "feat(vacinas): tipos + client HTTP frontend"
```

### Task 8: `VacinaImportSection.tsx` em `/importacao`

**Files:**
- Create: `simpa-frontend/src/pages/Importacao/VacinaImportSection.tsx`
- Modify: página de importação (inserir a seção — inspecionar `simpa-frontend/src/pages/Importacao/` e seguir o `SihImportSection`)

- [ ] **Step 1: Implementar a seção** (padrão `SihImportSection.tsx`: input file → preview → confirmar)

Create `simpa-frontend/src/pages/Importacao/VacinaImportSection.tsx`:

```tsx
import { useState } from 'react';
import { previewVacina, importVacina } from '../../api/vacina';
import type { VacinaImportPreview } from '../../types/vacina';

export function VacinaImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<VacinaImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onPreview() {
    if (!file) return;
    setBusy(true); setMsg(null);
    try { setPreview(await previewVacina(file)); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }
  async function onConfirm() {
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const r = await importVacina(file, preview?.competencia?.slice(0, 7));
      setMsg(`Importado: ${r.competencia} — ${r.doses_total} doses.`);
      setPreview(null); setFile(null);
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <section className="rounded-lg border p-4">
      <h2 className="font-semibold mb-2">Vacinas (NIES)</h2>
      <input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
      <div className="mt-2 flex gap-2">
        <button disabled={!file || busy} onClick={onPreview} className="btn">Pré-visualizar</button>
        <button disabled={!preview || busy} onClick={onConfirm} className="btn btn-primary">Confirmar importação</button>
      </div>
      {preview && (
        <div className="mt-3 text-sm">
          <p>Competência: <b>{preview.competencia}</b> · Linhas: {preview.linhas} · Doses: {preview.doses_total}</p>
          {preview.faixas_nao_mapeadas.length > 0 && (
            <p className="text-amber-600">⚠ {preview.faixas_nao_mapeadas.length} faixa(s) sem grupo mapeado: {preview.faixas_nao_mapeadas.join(', ')}</p>
          )}
        </div>
      )}
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </section>
  );
}
```

- [ ] **Step 2: Inserir na página de importação**

Localizar o container onde `SihImportSection` é renderizado (grep `SihImportSection` em `simpa-frontend/src`) e adicionar `<VacinaImportSection />` ao lado, com o import correspondente. Reusar classes utilitárias (`btn`) já existentes; se não existirem, copiar as classes Tailwind usadas no `SihImportSection`.

- [ ] **Step 3: Verificar build**

Run: `npm run build --prefix simpa-frontend`
Expected: build sem erros de TS.

- [ ] **Step 4: Commit**

```bash
git add simpa-frontend/src/pages/Importacao/
git commit -m "feat(vacinas): seção de upload NIES em /importacao"
```

---

## Phase 7 — Frontend: página /vacinas

### Task 9: `CoberturaMatrix.tsx` (componente, TDD com Vitest)

**Files:**
- Create: `simpa-frontend/src/pages/Vacinas/CoberturaMatrix.tsx`
- Test: `simpa-frontend/src/pages/Vacinas/__tests__/CoberturaMatrix.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Create `simpa-frontend/src/pages/Vacinas/__tests__/CoberturaMatrix.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CoberturaMatrix, coberturaColor } from '../CoberturaMatrix';
import type { CoberturaRow } from '../../../types/vacina';

const rows: CoberturaRow[] = [
  { imuno_codigo: '93', imuno_nome: 'HPV', grupo_id: 1, grupo_nome: 'Adolescente', doses: 200, pop_alvo: 100, num_doses: 2, denominador: 200, cobertura_pct: 100 },
  { imuno_codigo: '9', imuno_nome: 'Hep B', grupo_id: 1, grupo_nome: 'Adolescente', doses: 50, pop_alvo: 0, num_doses: 3, denominador: 0, cobertura_pct: null },
];

describe('coberturaColor', () => {
  it('faixas de heatmap', () => {
    expect(coberturaColor(40)).toMatch(/red/);
    expect(coberturaColor(70)).toMatch(/amber|yellow/);
    expect(coberturaColor(96)).toMatch(/green/);
    expect(coberturaColor(null)).toMatch(/gray|slate/);
  });
});

describe('CoberturaMatrix', () => {
  it('renderiza vacina e % e trata null como —', () => {
    render(<CoberturaMatrix rows={rows} />);
    expect(screen.getByText('HPV')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // Hep B pop=0
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm run test --prefix simpa-frontend -- CoberturaMatrix`
Expected: FAIL (componente inexistente).

- [ ] **Step 3: Implementar o componente**

Create `simpa-frontend/src/pages/Vacinas/CoberturaMatrix.tsx`:

```tsx
import type { CoberturaRow } from '../../types/vacina';

export function coberturaColor(pct: number | null): string {
  if (pct == null) return 'bg-slate-100 text-slate-400';
  if (pct < 50) return 'bg-red-100 text-red-800';
  if (pct < 80) return 'bg-amber-100 text-amber-800';
  return 'bg-green-100 text-green-800';
}

export function CoberturaMatrix({ rows }: { rows: CoberturaRow[] }) {
  const grupos = [...new Map(rows.map((r) => [r.grupo_id, r.grupo_nome])).entries()];
  const vacinas = [...new Map(rows.map((r) => [r.imuno_codigo, r.imuno_nome])).entries()];
  const cell = (imuno: string, grupo: number) =>
    rows.find((r) => r.imuno_codigo === imuno && r.grupo_id === grupo) ?? null;

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className="text-left p-2">Vacina</th>
          {grupos.map(([id, nome]) => <th key={id} className="p-2">{nome}</th>)}
        </tr>
      </thead>
      <tbody>
        {vacinas.map(([cod, nome]) => (
          <tr key={cod} className="border-t">
            <td className="p-2 font-medium">{nome}</td>
            {grupos.map(([gid]) => {
              const c = cell(cod, gid);
              const pct = c?.cobertura_pct ?? null;
              return (
                <td key={gid} className={`p-2 text-center ${coberturaColor(pct)}`}
                    title={c ? `${c.doses} / ${c.denominador} doses` : ''}>
                  {pct == null ? '—' : `${Math.round(pct)}%`}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test --prefix simpa-frontend -- CoberturaMatrix`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add simpa-frontend/src/pages/Vacinas/CoberturaMatrix.tsx simpa-frontend/src/pages/Vacinas/__tests__/CoberturaMatrix.test.tsx
git commit -m "feat(vacinas): matriz de cobertura (heatmap) + Vitest"
```

### Task 10: `VacinasPage.tsx` + rota + navegação

**Files:**
- Create: `simpa-frontend/src/pages/Vacinas/VacinasPage.tsx`
- Modify: `simpa-frontend/src/App.tsx`, `simpa-frontend/src/config/navigation.ts`

- [ ] **Step 1: Implementar a página**

Create `simpa-frontend/src/pages/Vacinas/VacinasPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { fetchCobertura } from '../../api/vacina';
import type { CoberturaRow } from '../../types/vacina';
import { CoberturaMatrix } from './CoberturaMatrix';
import { downloadCsv } from '../../utils/csv';

const MESES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

export default function VacinasPage() {
  const ano = 2026;
  const [mes, setMes] = useState('12');
  const [rows, setRows] = useState<CoberturaRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchCobertura({ ano, competencia: `${ano}-${mes}` })
      .then(setRows).finally(() => setLoading(false));
  }, [mes]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">Cobertura Vacinal {ano}</h1>
        <label className="text-sm">Acumulado até
          <select className="ml-1 border rounded p-1" value={mes} onChange={(e) => setMes(e.target.value)}>
            {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <button className="btn ml-auto" onClick={() => downloadCsv('cobertura_vacinal.csv', rows)}>Exportar CSV</button>
      </div>
      {loading ? <p>Carregando…</p> :
        rows.length === 0 ? <p className="text-slate-500">Sem esquema/dados cadastrados para {ano}.</p> :
          <CoberturaMatrix rows={rows} />}
    </div>
  );
}
```

> Confirmar a assinatura de `downloadCsv` em `simpa-frontend/src/utils/csv.ts` e adaptar (pode exigir headers explícitos). Se exigir array de objetos plano, `rows` já serve.

- [ ] **Step 2: Registrar rota e navegação**

Modify `simpa-frontend/src/App.tsx` — adicionar rota lazy `/vacinas` seguindo o padrão das demais rotas lazy (ver como `/painel/populacao` é registrada):
```tsx
const VacinasPage = lazy(() => import('./pages/Vacinas/VacinasPage'));
// dentro do <Routes>:
<Route path="/vacinas" element={<VacinasPage />} />
```

Modify `simpa-frontend/src/config/navigation.ts` — adicionar em `NAV_ITEMS` (após Indicadores):
```ts
{ to: '/vacinas', label: 'Vacinas', icon: 'indicadores' },
```
e em `ROUTE_META`:
```ts
'/vacinas': { title: 'Vacinas', crumb: 'Cobertura Vacinal', showFilters: false },
```

- [ ] **Step 3: Verificar build**

Run: `npm run build --prefix simpa-frontend`
Expected: build sem erros.

- [ ] **Step 4: Commit**

```bash
git add simpa-frontend/src/pages/Vacinas/VacinasPage.tsx simpa-frontend/src/App.tsx simpa-frontend/src/config/navigation.ts
git commit -m "feat(vacinas): página /vacinas (matriz cobertura + filtro mês + CSV)"
```

---

## Phase 8 — Frontend: cadastros

### Task 11: Páginas de cadastro (grupos, faixa→grupo, população, esquema)

**Files:**
- Create: `simpa-frontend/src/pages/Cadastros/VacinaGruposPage.tsx`, `VacinaFaixaGrupoPage.tsx`, `VacinaPopulacaoPage.tsx`, `VacinaEsquemaPage.tsx`
- Modify: `simpa-frontend/src/App.tsx`, `simpa-frontend/src/config/navigation.ts`

- [ ] **Step 1: Implementar as 4 páginas**

Seguir o padrão de uma página de cadastro existente (inspecionar `simpa-frontend/src/pages/Cadastros/` e reusar `CadastroCrudPage`/tabela + form). Cada página consome os endpoints do `api/vacina.ts`:

- `VacinaGruposPage`: lista `fetchGrupos`, form nome/slug/ordem → `createGrupo`/`updateGrupo`.
- `VacinaFaixaGrupoPage`: lista `fetchFaixaGrupo` (20 linhas), select de grupo por linha → `setFaixaGrupo`. Sem criar/excluir.
- `VacinaPopulacaoPage`: filtro de ano (default 2026), lista `fetchPopulacao(ano)`, form grupo+população → `upsertPopulacao`.
- `VacinaEsquemaPage`: lista `fetchEsquema`, form com `<select imuno>` (de `fetchImunobiologicos`) + `<select grupo>` (de `fetchGrupos`) + num_doses → `upsertEsquema`; excluir → `deleteEsquema`.

Exemplo mínimo (`VacinaFaixaGrupoPage.tsx`, o mais simples — os demais seguem o mesmo esqueleto):

```tsx
import { useEffect, useState } from 'react';
import { fetchFaixaGrupo, setFaixaGrupo, fetchGrupos } from '../../api/vacina';
import type { FaixaGrupo, VacinaGrupo } from '../../types/vacina';

export default function VacinaFaixaGrupoPage() {
  const [rows, setRows] = useState<FaixaGrupo[]>([]);
  const [grupos, setGrupos] = useState<VacinaGrupo[]>([]);
  const reload = () => fetchFaixaGrupo().then(setRows);
  useEffect(() => { reload(); fetchGrupos().then(setGrupos); }, []);

  async function change(faixa: string, grupoId: string) {
    await setFaixaGrupo(faixa, grupoId ? Number(grupoId) : null);
    reload();
  }
  return (
    <div className="p-4">
      <h1 className="font-semibold mb-3">Faixas NIES → Grupo</h1>
      <table className="text-sm w-full">
        <thead><tr><th className="text-left p-1">Faixa NIES</th><th className="text-left p-1">Grupo</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.faixa_nies} className="border-t">
              <td className="p-1">{r.faixa_nies}</td>
              <td className="p-1">
                <select value={r.grupo_id ?? ''} onChange={(e) => change(r.faixa_nies, e.target.value)} className="border rounded p-1">
                  <option value="">— sem grupo —</option>
                  {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Registrar rotas e navegação**

Modify `App.tsx` — 4 rotas lazy sob `/cadastros/vacina-*`. Modify `navigation.ts` — adicionar os 4 itens em `NAV_ITEMS` (ou submenu de Cadastros, conforme o padrão de nav dos cadastros existentes; se os cadastros usam sub-navegação própria, seguir esse mecanismo em vez de `NAV_ITEMS`).

- [ ] **Step 3: Build + fumaça manual**

Run: `npm run build --prefix simpa-frontend`
Expected: sem erros. Abrir `/cadastros/vacina-grupos`, criar um grupo, mapear faixas, digitar população, cadastrar esquema; depois abrir `/vacinas` e confirmar que a matriz preenche.

- [ ] **Step 4: Commit**

```bash
git add simpa-frontend/src/pages/Cadastros/Vacina*.tsx simpa-frontend/src/App.tsx simpa-frontend/src/config/navigation.ts
git commit -m "feat(vacinas): páginas de cadastro (grupos, faixa-grupo, população, esquema)"
```

---

## Phase 9 — Docs + verificação final

### Task 12: Documentação e fechamento

**Files:**
- Create: `docs/agent/vacinas.md`
- Modify: `CLAUDE.md`, `docs/agent/database.md`, `docs/agent/backend-api.md`

- [ ] **Step 1: Escrever `docs/agent/vacinas.md`**

Documentar: fonte NIES, fluxo de import, modelo de dados `vacina_*`, fórmula de cobertura, endpoints `/api/vacina/*`, páginas `/vacinas` e cadastros. Seguir o estilo dos demais arquivos em `docs/agent/`.

- [ ] **Step 2: Atualizar CLAUDE.md**

Adicionar seção "Feature concluída: vacinas-cobertura" (padrão das demais features concluídas) e uma linha na tabela "Onde buscar comportamento atual": `Como calcula cobertura vacinal? | vacinaService.js getCobertura`. Adicionar `vacinas.md` ao índice `docs/agent/`. Manter CLAUDE.md ≤300 linhas.

- [ ] **Step 3: Atualizar database.md e backend-api.md**

Registrar migration 036 e as tabelas `vacina_*` em `database.md`; os endpoints `/api/vacina/*` em `backend-api.md`.

- [ ] **Step 4: Rodar a suíte completa**

Run:
```powershell
npm test
npm run test:py
npm run build --prefix simpa-frontend
```
Expected: Jest + Vitest verdes, pytest verde (inclui `test_parse_vacina.py`), build ok.

- [ ] **Step 5: Commit final**

```bash
git add docs/ CLAUDE.md
git commit -m "docs(vacinas): módulo vacinas — cobertura, endpoints, modelo de dados"
```

---

## Self-Review (cobertura da spec)

- §1 fórmula de cobertura → Task 4 (`computeCobertura`, acumulado no ano). ✓
- §2 armadilhas NIES (rodapé, encoding, competência) → Task 2 (parser + testes). ✓
- §3 modelo de dados (7 tabelas) → Task 1. ✓
- §4 import (preview/import/re-import substitui) → Tasks 3, 6, 8. ✓
- §5 página /vacinas + 4 cadastros → Tasks 9, 10, 11. ✓
- §6 testes (pytest/Jest/Vitest) → Tasks 2, 3, 4, 9 + suíte final Task 12. ✓
- §7 escopo v1 (só 2026, sem drill-down CNES, sem widget painel) → respeitado (VacinasPage fixa ano=2026; matriz município). ✓
- §8 entregáveis → todos cobertos pelas Tasks 1–12. ✓

**Pontos que exigem confirmação do implementador durante a execução** (marcados inline no plano): rótulos reais das 20 faixas NIES (Task 1/2), disponibilidade de `multer` (Task 6), assinatura de `apiFetch`/`downloadCsv` (Tasks 7, 10), mecanismo de sub-navegação dos cadastros (Task 11).
```