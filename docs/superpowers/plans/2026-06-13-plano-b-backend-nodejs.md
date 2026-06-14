# SIMPA — Plano B: Backend Node.js (API Express)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a API Express completa que serve o frontend: upload CSV (chama Python subprocess), sincronização SIA (chama Python subprocess), endpoints REST para dashboard/cadastros/histórico.

**Architecture:** Node.js/Express, CommonJS. `db.js` é um pool pg singleton. `parser.js` e `sia.js` são services que fazem spawn do subprocess Python e lêem JSON do stdout. `storage.js` gerencia arquivos físicos em `uploads/`. Rotas isoladas por domínio. `.env` compartilhado com os scripts Python (mesmo arquivo).

**Tech Stack:** Node.js 18+ · Express 4 · multer (upload) · pg (node-postgres) · dotenv · cors

**Pré-requisito:** Plano A concluído (banco com tabelas, `.env` preenchido).

---

## Mapa de arquivos

```
C:\simpa\simpa-backend\
├── src/
│   ├── app.js                  CRIAR  — Express app + middlewares + rotas
│   ├── services/
│   │   ├── db.js               CRIAR  — pg Pool singleton
│   │   ├── storage.js          CRIAR  — save/delete arquivos em uploads/
│   │   ├── parser.js           CRIAR  — subprocess parse_esus_csv.py
│   │   └── sia.js              CRIAR  — subprocess sync_sia_mysql.py
│   ├── routes/
│   │   ├── importacao.js       CRIAR  — upload, preview, reprocessar, substituir, excluir, cargas
│   │   ├── sia.js              CRIAR  — sincronizar, listar sincronizações, produção
│   │   ├── dashboard.js        CRIAR  — GET /api/v1/dashboard/planejamento
│   │   └── cadastros.js        CRIAR  — CRUD unidades + equipes
│   └── middleware/
│       └── errorHandler.js     CRIAR  — handler global de erros
├── uploads/                    CRIAR dir (vazio, no .gitignore)
├── .env                        LINK   — copiar de C:\simpa\.env (mesmo arquivo)
├── .gitignore                  CRIAR
└── package.json                CRIAR
```

---

## Task 1: Criar projeto Node.js e instalar dependências

- [ ] **Step 1: Criar pasta e inicializar**

```powershell
mkdir C:\simpa\simpa-backend
cd C:\simpa\simpa-backend
npm init -y
```

- [ ] **Step 2: Instalar dependências**

```powershell
npm install express multer pg dotenv cors
```

- [ ] **Step 3: Criar estrutura de pastas**

```powershell
mkdir src\services, src\routes, src\middleware, uploads
```

- [ ] **Step 4: Copiar `.env` do projeto raiz**

```powershell
Copy-Item C:\simpa\.env C:\simpa\simpa-backend\.env
```

- [ ] **Step 5: Criar `.gitignore`**

```
node_modules/
uploads/
.env
dist/
```

---

## Task 2: Criar `src/services/db.js`

**Files:**
- Criar: `C:\simpa\simpa-backend\src\services\db.js`

- [ ] **Step 1: Criar o arquivo**

```javascript
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.PG_HOST,
  port:     parseInt(process.env.PG_PORT),
  database: process.env.PG_DB,
  user:     process.env.PG_USER,
  password: process.env.PG_PASS,
});

pool.on('error', (err) => {
  console.error('pg pool error:', err.message);
});

/**
 * @param {string} text  SQL query
 * @param {any[]}  params  Parâmetros posicionais
 */
async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

module.exports = { pool, query };
```

- [ ] **Step 2: Testar conexão**

```powershell
node -e "
const { query } = require('./src/services/db');
query('SELECT COUNT(*) FROM esus_cargas').then(r => {
  console.log('Cargas no banco:', r.rows[0].count);
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
"
```

Esperado: `Cargas no banco: 6` (ou o número de CSVs importados no Plano A).

---

## Task 3: Criar `src/services/storage.js`

**Files:**
- Criar: `C:\simpa\simpa-backend\src\services\storage.js`

- [ ] **Step 1: Criar o arquivo**

```javascript
const path = require('path');
const fs   = require('fs');

const UPLOADS_ROOT = path.join(__dirname, '../../uploads');

/**
 * Retorna o caminho de destino para um arquivo de carga e-SUS.
 * uploads/esus/{ano}/{mes}/{unidade_slug}/{filename}
 */
function buildPath(competencia, unidade, filename) {
  const [ano, mes] = competencia.split('-');
  const slug = unidade
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 60);
  return path.join(UPLOADS_ROOT, 'esus', ano, mes, slug, filename);
}

/**
 * Move um arquivo do caminho temporário (multer) para o destino permanente.
 * Cria diretórios intermediários automaticamente.
 */
function moverArquivo(tmpPath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.renameSync(tmpPath, destPath);
}

/**
 * Remove um arquivo físico. Não lança erro se não existir.
 */
function removerArquivo(filePath) {
  try { fs.unlinkSync(filePath); } catch (_) {}
}

module.exports = { buildPath, moverArquivo, removerArquivo, UPLOADS_ROOT };
```

---

## Task 4: Criar `src/services/parser.js`

**Files:**
- Criar: `C:\simpa\simpa-backend\src\services\parser.js`

- [ ] **Step 1: Criar o arquivo**

```javascript
const { spawn } = require('child_process');
const path       = require('path');

const PYTHON     = process.env.PYTHON_BIN || 'python';
const PARSER     = path.join(__dirname, '../../../parse_esus_csv.py');

/**
 * Chama parse_esus_csv.py com a flag informada e retorna o JSON do stdout.
 * @param {string} csvPath  Caminho absoluto do arquivo CSV
 * @param {'--json-out'|'--pg-write'} flag
 * @returns {Promise<Array>}  Array de objetos retornados pelo script
 */
function runParser(csvPath, flag) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [PARSER, csvPath, flag]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`parser saiu com código ${code}: ${stderr}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`JSON inválido do parser: ${stdout.substring(0, 200)}`));
      }
    });
  });
}

/** Preview: detecta metadados sem gravar no banco. */
const preview  = (csvPath) => runParser(csvPath, '--json-out');

/** Grava os dados do CSV diretamente no PostgreSQL. */
const processar = (csvPath) => runParser(csvPath, '--pg-write');

module.exports = { preview, processar };
```

---

## Task 5: Criar `src/services/sia.js`

**Files:**
- Criar: `C:\simpa\simpa-backend\src\services\sia.js`

- [ ] **Step 1: Criar o arquivo**

```javascript
const { spawn } = require('child_process');
const path       = require('path');

const PYTHON = process.env.PYTHON_BIN || 'python';
const SCRIPT = path.join(__dirname, '../../../sync_sia_mysql.py');

/**
 * Sincroniza uma competência do MySQL para o PostgreSQL.
 * @param {string} competencia  formato 'YYYY-MM'
 * @returns {Promise<Array>}
 */
function sincronizar(competencia) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [SCRIPT, '--competencia', competencia, '--json-out']);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`sync_sia saiu com código ${code}: ${stderr}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`JSON inválido do sync_sia: ${stdout.substring(0, 200)}`));
      }
    });
  });
}

module.exports = { sincronizar };
```

---

## Task 6: Criar `src/middleware/errorHandler.js`

**Files:**
- Criar: `C:\simpa\simpa-backend\src\middleware\errorHandler.js`

- [ ] **Step 1: Criar o arquivo**

```javascript
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err.stack || err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Erro interno',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
```

---

## Task 7: Criar `src/routes/importacao.js`

**Files:**
- Criar: `C:\simpa\simpa-backend\src\routes\importacao.js`

- [ ] **Step 1: Criar o arquivo**

```javascript
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const os      = require('os');
const fs      = require('fs');

const { query }                          = require('../services/db');
const { buildPath, moverArquivo, removerArquivo } = require('../services/storage');
const { preview, processar }             = require('../services/parser');

const router  = express.Router();
const upload  = multer({ dest: os.tmpdir() });

// POST /api/importacao/preview — detecta metadados sem gravar
router.post('/preview', upload.array('files'), async (req, res, next) => {
  try {
    const resultados = [];
    for (const file of req.files) {
      const meta = await preview(file.path);
      fs.unlinkSync(file.path);  // remove temp
      // Verifica se já existe no banco
      const existe = await query(
        `SELECT id FROM esus_cargas
         WHERE tipo_relatorio=$1 AND competencia=$2 AND unidade=$3 AND equipe_nome=$4`,
        [meta[0]?.tipo_relatorio, meta[0]?.competencia,
         meta[0]?.unidade, meta[0]?.equipe_nome]
      );
      resultados.push({
        nome: file.originalname,
        ...meta[0],
        ja_importado: existe.rows.length > 0,
      });
    }
    res.json(resultados);
  } catch (err) { next(err); }
});

// POST /api/importacao/upload — salva arquivo físico e processa
router.post('/upload', upload.array('files'), async (req, res, next) => {
  try {
    const resultados = [];
    for (const file of req.files) {
      // Preview para obter metadados antes de mover
      const meta = await preview(file.path);
      const m = meta[0];

      const destPath = buildPath(m.competencia, m.unidade, file.originalname);
      moverArquivo(file.path, destPath);

      // Processa (grava no banco)
      const resultado = await processar(destPath);

      // Atualiza arquivo_path na carga
      await query(
        `UPDATE esus_cargas SET arquivo_path=$1
         WHERE tipo_relatorio=$2 AND competencia=$3 AND unidade=$4 AND equipe_nome=$5`,
        [destPath, m.tipo_relatorio, m.competencia, m.unidade, m.equipe_nome]
      );

      resultados.push({ arquivo: file.originalname, ...resultado[0] });
    }
    res.status(201).json(resultados);
  } catch (err) { next(err); }
});

// POST /api/importacao/:id/reprocessar — roda parser no arquivo salvo
router.post('/:id/reprocessar', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM esus_cargas WHERE id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Carga não encontrada' });
    const carga = rows[0];
    if (!carga.arquivo_path) {
      return res.status(400).json({ error: 'Arquivo físico não encontrado para esta carga' });
    }
    const resultado = await processar(carga.arquivo_path);
    res.json(resultado[0]);
  } catch (err) { next(err); }
});

// PUT /api/importacao/:id/substituir — novo upload, sobrescreve arquivo, reprocessa
router.put('/:id/substituir', upload.single('file'), async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM esus_cargas WHERE id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Carga não encontrada' });
    const carga = rows[0];

    const meta = await preview(req.file.path);
    const m = meta[0];
    const destPath = buildPath(m.competencia, m.unidade, req.file.originalname);

    if (carga.arquivo_path && carga.arquivo_path !== destPath) {
      removerArquivo(carga.arquivo_path);
    }
    moverArquivo(req.file.path, destPath);

    const resultado = await processar(destPath);
    await query(
      `UPDATE esus_cargas SET arquivo_path=$1, arquivo_origem=$2 WHERE id=$3`,
      [destPath, req.file.originalname, req.params.id]
    );

    res.json({ ...resultado[0], arquivo_path: destPath });
  } catch (err) { next(err); }
});

// DELETE /api/importacao/:id — remove DB + arquivo físico
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT arquivo_path FROM esus_cargas WHERE id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Carga não encontrada' });

    if (rows[0].arquivo_path) removerArquivo(rows[0].arquivo_path);
    await query('DELETE FROM esus_cargas WHERE id=$1', [req.params.id]);

    res.json({ deleted: true, id: parseInt(req.params.id) });
  } catch (err) { next(err); }
});

// GET /api/importacao/cargas — lista histórico com filtros
router.get('/cargas', async (req, res, next) => {
  try {
    const { competencia, unidade, status } = req.query;
    const conditions = [];
    const params = [];

    if (competencia) {
      params.push(competencia + '-01');
      conditions.push(`competencia = $${params.length}`);
    }
    if (unidade) {
      params.push(`%${unidade}%`);
      conditions.push(`unidade ILIKE $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await query(
      `SELECT id, tipo_relatorio, competencia, unidade, equipe_nome,
              arquivo_origem, arquivo_path, registros_identificados,
              registros_nao_identificados, importado_em
       FROM esus_cargas ${where}
       ORDER BY importado_em DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
```

---

## Task 8: Criar `src/routes/sia.js`

**Files:**
- Criar: `C:\simpa\simpa-backend\src\routes\sia.js`

- [ ] **Step 1: Criar o arquivo**

```javascript
const express = require('express');
const { query } = require('../services/db');
const siaService = require('../services/sia');

const router = express.Router();

// POST /api/sia/sincronizar
router.post('/sincronizar', async (req, res, next) => {
  try {
    const { competencia } = req.body;
    if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
      return res.status(400).json({ error: 'competencia deve ser YYYY-MM' });
    }
    const resultado = await siaService.sincronizar(competencia);
    res.status(201).json(resultado);
  } catch (err) { next(err); }
});

// GET /api/sia/sincronizacoes
router.get('/sincronizacoes', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, competencia, status, registros, erros, sincronizado_em
       FROM sia_sincronizacoes ORDER BY competencia DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/sia/producao?competencia=2026-05&unidade=CAFI
router.get('/producao', async (req, res, next) => {
  try {
    const { competencia, unidade, codigo_sigtap } = req.query;
    const conditions = [];
    const params = [];

    if (competencia) {
      params.push(competencia + '-01');
      conditions.push(`competencia = $${params.length}`);
    }
    if (unidade) {
      params.push(`%${unidade}%`);
      conditions.push(`unidade ILIKE $${params.length}`);
    }
    if (codigo_sigtap) {
      params.push(codigo_sigtap);
      conditions.push(`codigo_sigtap = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await query(
      `SELECT codigo_sigtap, descricao, faixa_etaria, sexo, cbo,
              SUM(quantidade) AS quantidade, SUM(valor_aprovado) AS valor_aprovado
       FROM sia_producao ${where}
       GROUP BY codigo_sigtap, descricao, faixa_etaria, sexo, cbo
       ORDER BY quantidade DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
```

---

## Task 9: Criar `src/routes/dashboard.js`

**Files:**
- Criar: `C:\simpa\simpa-backend\src\routes\dashboard.js`

- [ ] **Step 1: Criar o arquivo**

```javascript
const express = require('express');
const { query } = require('../services/db');

const router = express.Router();

// GET /api/v1/dashboard/planejamento?competencia=2026-05&unidade=CAFI&equipe=Equipe+9+EAP
router.get('/planejamento', async (req, res, next) => {
  try {
    const { competencia, unidade, equipe } = req.query;

    if (!competencia) {
      return res.status(400).json({ error: 'parâmetro competencia obrigatório (YYYY-MM)' });
    }

    const competenciaDate = competencia + '-01';
    const conditions = ['competencia = $1'];
    const params = [competenciaDate];

    if (unidade) {
      params.push(unidade);
      conditions.push(`unidade = $${params.length}`);
    }
    if (equipe) {
      params.push(equipe);
      conditions.push(`equipe = $${params.length}`);
    }

    const where = conditions.join(' AND ');
    const { rows } = await query(
      `SELECT dados_conteudo, versao_schema, unidade, equipe, atualizado_em
       FROM dados_consolidados WHERE ${where}
       ORDER BY atualizado_em DESC LIMIT 1`,
      params
    );

    if (!rows.length) {
      return res.status(404).json({
        error: 'Dados não encontrados para os filtros informados',
        filtros: { competencia, unidade, equipe },
      });
    }

    const row = rows[0];
    res.json({
      plataforma: 'SIMPA - Sistema Integrado de Monitoramento e Planejamento de Americana',
      versao_schema: row.versao_schema,
      competencia,
      municipio: 'AMERICANA',
      filtros_ativos: { unidade: row.unidade, equipe: row.equipe },
      ...row.dados_conteudo,
    });
  } catch (err) { next(err); }
});

module.exports = router;
```

---

## Task 10: Criar `src/routes/cadastros.js`

**Files:**
- Criar: `C:\simpa\simpa-backend\src\routes\cadastros.js`

- [ ] **Step 1: Criar o arquivo**

```javascript
const express = require('express');
const { query } = require('../services/db');

const router = express.Router();

// --- Unidades de Saúde ---

router.get('/unidades', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, codigo, nome, tipo, cnes, status
       FROM unidades_saude WHERE status != 'inativo' ORDER BY nome`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/unidades', async (req, res, next) => {
  try {
    const { codigo, nome, tipo, cnes } = req.body;
    if (!codigo || !nome) {
      return res.status(400).json({ error: 'codigo e nome são obrigatórios' });
    }
    const { rows } = await query(
      `INSERT INTO unidades_saude (codigo, nome, tipo, cnes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [codigo, nome, tipo || null, cnes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/unidades/:id', async (req, res, next) => {
  try {
    const { nome, tipo, cnes, status } = req.body;
    const { rows } = await query(
      `UPDATE unidades_saude SET nome=$1, tipo=$2, cnes=$3, status=$4
       WHERE id=$5 RETURNING *`,
      [nome, tipo, cnes, status || 'ativo', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Unidade não encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/unidades/:id', async (req, res, next) => {
  try {
    await query(
      `UPDATE unidades_saude SET status='inativo' WHERE id=$1`,
      [req.params.id]
    );
    res.json({ inativado: true, id: parseInt(req.params.id) });
  } catch (err) { next(err); }
});

// --- Equipes ---

router.get('/equipes', async (req, res, next) => {
  try {
    const { unidade_id } = req.query;
    const params = [];
    const conditions = ["e.status != 'inativo'"];
    if (unidade_id) {
      params.push(unidade_id);
      conditions.push(`e.unidade_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT e.id, e.codigo, e.nome, e.tipo, e.status,
              u.nome AS unidade_nome
       FROM equipes e
       LEFT JOIN unidades_saude u ON u.id = e.unidade_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.nome`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/equipes', async (req, res, next) => {
  try {
    const { codigo, nome, tipo, unidade_id } = req.body;
    if (!codigo || !nome) {
      return res.status(400).json({ error: 'codigo e nome são obrigatórios' });
    }
    const { rows } = await query(
      `INSERT INTO equipes (codigo, nome, tipo, unidade_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [codigo, nome, tipo || null, unidade_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/equipes/:id', async (req, res, next) => {
  try {
    const { nome, tipo, unidade_id, status } = req.body;
    const { rows } = await query(
      `UPDATE equipes SET nome=$1, tipo=$2, unidade_id=$3, status=$4
       WHERE id=$5 RETURNING *`,
      [nome, tipo, unidade_id, status || 'ativo', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Equipe não encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/equipes/:id', async (req, res, next) => {
  try {
    await query(`UPDATE equipes SET status='inativo' WHERE id=$1`, [req.params.id]);
    res.json({ inativado: true, id: parseInt(req.params.id) });
  } catch (err) { next(err); }
});

module.exports = router;
```

---

## Task 11: Criar `src/app.js`

**Files:**
- Criar: `C:\simpa\simpa-backend\src\app.js`

- [ ] **Step 1: Criar o arquivo**

```javascript
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const errorHandler = require('./middleware/errorHandler');

const importacaoRoutes = require('./routes/importacao');
const siaRoutes        = require('./routes/sia');
const dashboardRoutes  = require('./routes/dashboard');
const cadastrosRoutes  = require('./routes/cadastros');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/importacao', importacaoRoutes);
app.use('/api/sia',        siaRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/cadastros',  cadastrosRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: new Date() }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`SIMPA backend rodando em http://localhost:${PORT}`);
});

module.exports = app;
```

- [ ] **Step 2: Adicionar script de start ao `package.json`**

Abra `C:\simpa\simpa-backend\package.json` e adicione:

```json
{
  "scripts": {
    "start": "node src/app.js",
    "dev": "node --watch src/app.js"
  }
}
```

---

## Task 12: Testar a API

- [ ] **Step 1: Subir o backend**

```powershell
cd C:\simpa\simpa-backend
npm run dev
```

Esperado: `SIMPA backend rodando em http://localhost:3001`

- [ ] **Step 2: Testar health check**

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

Esperado: `status: ok`

- [ ] **Step 3: Testar listagem de cargas**

```powershell
Invoke-RestMethod "http://localhost:3001/api/importacao/cargas"
```

Esperado: array JSON com as 6 cargas importadas no Plano A.

- [ ] **Step 4: Testar upload de CSV via PowerShell**

```powershell
$form = @{
  files = Get-Item "C:\simpa\Relatório de atendimento individual-20260613175047.csv"
}
Invoke-RestMethod -Uri "http://localhost:3001/api/importacao/upload" `
  -Method Post -Form $form
```

Esperado: JSON com `carga_id`, `status: "ok"`, `registros_identificados`.

- [ ] **Step 5: Testar sincronização SIA**

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/sia/sincronizar" `
  -Method Post -ContentType "application/json" `
  -Body '{"competencia":"2026-05"}'
```

Esperado: JSON com `status: "ok"` e `registros` > 0.

- [ ] **Step 6: Testar endpoint de cadastros**

```powershell
# Criar unidade
$body = '{"codigo":"CAFI001","nome":"CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO","tipo":"APS"}'
Invoke-RestMethod -Uri "http://localhost:3001/api/cadastros/unidades" `
  -Method Post -ContentType "application/json" -Body $body

# Listar
Invoke-RestMethod "http://localhost:3001/api/cadastros/unidades"
```

- [ ] **Step 7: Commit**

```powershell
cd C:\simpa\simpa-backend
git add .
git commit -m "feat(backend): add Express API — importacao, sia, dashboard, cadastros"
```

---

## Verificação final do Plano B

- [ ] `GET /api/health` → `{ status: 'ok' }`
- [ ] `GET /api/importacao/cargas` → array com cargas
- [ ] `POST /api/importacao/preview` com CSV → metadados sem gravar
- [ ] `POST /api/importacao/upload` com CSV → arquivo salvo em `uploads/` + DB atualizado
- [ ] `POST /api/importacao/:id/reprocessar` → reprocessa arquivo salvo
- [ ] `DELETE /api/importacao/:id` → remove DB + arquivo
- [ ] `POST /api/sia/sincronizar` → dados em `sia_producao`
- [ ] `GET /api/cadastros/unidades` → lista unidades

**Plano B completo. Prosseguir para Plano C (Frontend React).**
