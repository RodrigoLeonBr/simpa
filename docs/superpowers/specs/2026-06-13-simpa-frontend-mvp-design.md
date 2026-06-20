# SIMPA — Design Spec: Frontend Completo + MVP Importação CSV

**Data:** 2026-06-13  
**Sessão:** Brainstorming — Frontend + MVP CSV→PostgreSQL  
**Status:** Aprovado para planejamento de implementação

---

## 1. Contexto e estado atual

### O que existe

| Artefato | Estado |
|---|---|
| `prd-simpa.md` | PRD completo v1.0 — fonte de verdade de negócio |
| `schema_esus.sql` | DDL PostgreSQL pronto, **nunca aplicado** |
| `parse_esus_csv.py` | Parser ETL funcional para 5 tipos de relatório e-SUS |
| `seed_esus_2026-05.sql` | Seed real competência Mai/2026 / CAFI |
| 6 CSVs e-SUS | Arquivos reais Mai/2026 em `C:\simpa\` |
| 7 agentes Claude Code | Especialistas por domínio (ETL, DBA, backend, etc.) |
| `estrutura_simpa.md` | Estrutura de menus CRM-like (7 módulos) |

### O que NÃO existe ainda

- PostgreSQL sem nenhuma tabela criada (Docker rodando, schema não aplicado)
- Python básico — sem pacotes extras instalados (`psycopg2`, `pandas`, etc.)
- Backend Node.js: não iniciado
- Frontend React: não iniciado
- Nenhum projeto criado em disco além dos artefatos acima

---

## 2. Decisões de design (aprovadas em sessão)

| Decisão | Escolha |
|---|---|
| Layout geral | Sidebar colapsada com ícones + fundo dark (`#0f172a`) |
| Paleta | Azul gov (`#2563eb`) primário · Verde (`#10b981`) · Âmbar (`#f59e0b`) · Roxo (`#a855f7`) para KPIs |
| Layout do Painel | Tabs no topo (APS / MAC / Hospitalar) + KPI row + grid 2×2 |
| Filtros | Segmented Mês/Quadrim./Ano + Unidade (dropdown, "Todas") + Equipe (cascata, desabilitada se Unidade=Todas) · Badge de contexto ativo |
| Visualização do Painel | Toggle "Indicadores Gerais" / "Por Tema" · Temas: Gestante, Primeira Infância, Idoso, Outros (configuráveis) · Clique no tema abre detalhe contextual |
| Mock API | `json-server` com fixture `mock/db.json` (payload PRD Seção 5) — HTTP real desde o dia 1 |
| Backend MVP | Node.js / Express · subprocess Python · `node-postgres` |
| Storage de uploads | Arquivo físico em `uploads/esus/{ano}/{mes}/{unidade}/` + referência em `esus_cargas.arquivo_path` |

---

## 3. Infraestrutura necessária

### 3.1 PostgreSQL (Docker)

PostgreSQL já roda em Docker. Precisa apenas aplicar o schema e a migration de `arquivo_path`.

```bash
# Verificar container
docker ps

# Aplicar schema inicial
docker exec -i <container_name> psql -U postgres -d simpa < schema_esus.sql

# Aplicar migration (nova coluna)
docker exec -i <container_name> psql -U postgres -d simpa -c \
  "ALTER TABLE esus_cargas ADD COLUMN IF NOT EXISTS arquivo_path VARCHAR(500);"
```

> Se o banco `simpa` ainda não existir: `docker exec <container> createdb -U postgres simpa`

### 3.2 Python — pacotes necessários

```bash
pip install psycopg2-binary mysql-connector-python python-dotenv pandas
```

| Pacote | Uso |
|---|---|
| `psycopg2-binary` | Gravar dados no PostgreSQL (e-SUS + SIA) |
| `mysql-connector-python` | Ler dados do MySQL/XAMPP (SIA/SUS) somente leitura |
| `python-dotenv` | Credenciais em `.env`, nunca em código |
| `pandas` | Transformação dos resultados MySQL antes de gravar no Postgres |

### 3.3 Node.js — pacotes necessários

```bash
npm install express multer pg dotenv cors
npm install -D vite @vitejs/plugin-react typescript
```

---

## 4. Schema PostgreSQL — mudanças em relação ao `schema_esus.sql`

### 4.1 Correção de versão

```sql
-- schema_esus.sql linha 111: corrigir DEFAULT
versao_schema VARCHAR(20) NOT NULL DEFAULT '3.1.0'
-- era '3.0.0' — contrato PRD já está em 3.1.0
```

### 4.2 Nova coluna `arquivo_path`

```sql
ALTER TABLE esus_cargas
  ADD COLUMN IF NOT EXISTS arquivo_path VARCHAR(500);

COMMENT ON COLUMN esus_cargas.arquivo_path IS
  'Caminho físico do CSV original no servidor: uploads/esus/{ano}/{mes}/{unidade}/arquivo.csv';
```

### 4.3 Tabelas novas (Fase 1 — necessárias para cadastros básicos)

```sql
-- Unidades de saúde (substituirá texto livre em esus_cargas)
CREATE TABLE unidades_saude (
  id        BIGSERIAL PRIMARY KEY,
  codigo    VARCHAR(40) UNIQUE NOT NULL,
  nome      VARCHAR(200) NOT NULL,
  tipo      VARCHAR(40) CHECK (tipo IN ('APS','MAC','Hospitalar','Misto')),
  cnes      VARCHAR(20),
  status    VARCHAR(20) NOT NULL DEFAULT 'ativo',
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);

-- Equipes (vinculadas a unidades)
CREATE TABLE equipes (
  id          BIGSERIAL PRIMARY KEY,
  codigo      VARCHAR(40) UNIQUE NOT NULL,  -- equivalente a equipe_codigo do e-SUS
  nome        VARCHAR(200) NOT NULL,
  unidade_id  BIGINT REFERENCES unidades_saude(id),
  tipo        VARCHAR(40) CHECK (tipo IN ('ESF','EAP','eSB','eMulti','Outra')),
  status      VARCHAR(20) NOT NULL DEFAULT 'ativo',
  criado_em   TIMESTAMP NOT NULL DEFAULT now()
);
```

### 4.4 Tabelas SIA/SUS (novas)

**Decisão de design:** campos usados em `GROUP BY`/`WHERE` no dashboard (`faixa_etaria`, `sexo`, `cbo`) ficam em colunas relacionais com índice B-tree — **não no JSONB**. JSONB absorve apenas colunas dinâmicas do MySQL ainda não mapeadas. Motivo: `GROUP BY (jsonb->>'campo')` força deserialização linha a linha, inviabilizando resposta <2s (PRD Seção 7.2) para volumes de dezenas de milhares de linhas SIA.

```sql
-- Controle de sincronizações SIA (1 linha por competência sincronizada)
CREATE TABLE sia_sincronizacoes (
  id              BIGSERIAL PRIMARY KEY,
  competencia     DATE NOT NULL,
  municipio       VARCHAR(120) NOT NULL DEFAULT 'AMERICANA',
  status          VARCHAR(20) NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','ok','parcial','erro')),
  registros       INT,
  erros           INT NOT NULL DEFAULT 0,
  sincronizado_em TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (competencia)
);

COMMENT ON TABLE sia_sincronizacoes IS
  'Uma linha por competência sincronizada do MySQL/XAMPP (SIA/SUS). Controla histórico de sincronizações.';

-- Produção ambulatorial SIA (granularidade: procedimento × unidade × faixa_etaria × sexo × cbo)
CREATE TABLE sia_producao (
  id                BIGSERIAL PRIMARY KEY,
  sincronizacao_id  BIGINT NOT NULL REFERENCES sia_sincronizacoes(id) ON DELETE CASCADE,
  competencia       DATE NOT NULL,
  unidade           VARCHAR(200),

  -- Identificação do procedimento
  codigo_sigtap     VARCHAR(20) NOT NULL,
  descricao         VARCHAR(300),

  -- Produção
  quantidade        INT NOT NULL DEFAULT 0,
  valor_aprovado    NUMERIC(12,2),

  -- Atributos de corte — colunas RELACIONAIS para GROUP BY eficiente
  faixa_etaria      VARCHAR(20),   -- '0-4', '5-9', '10-14', ..., '80+'
  sexo              CHAR(1) CHECK (sexo IN ('M','F','I')),
  cbo               VARCHAR(10),   -- código CBO do profissional executor

  -- Campos dinâmicos do MySQL ainda não mapeados
  dados_extras      JSONB,

  UNIQUE (sincronizacao_id, unidade, codigo_sigtap, faixa_etaria, sexo, cbo)
);

-- Índices relacionais — queries de dashboard
CREATE INDEX idx_sia_producao_grupo
  ON sia_producao (competencia, unidade, codigo_sigtap);

CREATE INDEX idx_sia_producao_demografico
  ON sia_producao (competencia, faixa_etaria, sexo);

CREATE INDEX idx_sia_producao_cbo
  ON sia_producao (competencia, cbo);

-- GIN apenas para dados_extras
CREATE INDEX idx_sia_producao_gin ON sia_producao USING GIN (dados_extras);

COMMENT ON TABLE sia_producao IS
  'Produção ambulatorial SIA/SUS extraída do MySQL/XAMPP. Granularidade: procedimento × unidade × faixa_etaria × sexo × cbo. Alimenta modulos.ambulatorial_sia no contrato JSON v3.1.0.';

COMMENT ON COLUMN sia_producao.faixa_etaria IS
  'Faixa etária padronizada: 0-4, 5-9, 10-14, 15-19, 20-29, 30-39, 40-49, 50-59, 60-69, 70-79, 80+. Derivada de idade_anos pelo sync_sia_mysql.py.';

COMMENT ON COLUMN sia_producao.dados_extras IS
  'Colunas adicionais do MySQL/SIA ainda não mapeadas — absorvidas via JSONB para não exigir migração de schema a cada nova coluna identificada.';
```

**Queries de dashboard habilitadas pelos índices:**

```sql
-- Pirâmide etária SIA (≡ pirâmide do e-SUS, mas para MAC)
SELECT faixa_etaria, sexo, SUM(quantidade)
FROM sia_producao
WHERE competencia = '2026-05-01' AND unidade = 'CAFI'
GROUP BY faixa_etaria, sexo;

-- Top procedimentos por CBO
SELECT cbo, codigo_sigtap, descricao, SUM(quantidade) AS total
FROM sia_producao
WHERE competencia = '2026-05-01'
GROUP BY cbo, codigo_sigtap, descricao
ORDER BY total DESC
LIMIT 20;
```

> Tabelas de Fase 2 (`emendas_parlamentares`, `emendas_metas_producao`, `metas_financiamento`) ficam fora do escopo desta implementação.

---

## 5. Scripts Python ETL

Dois scripts independentes. Ambos lêem `.env` para credenciais. Ambos gravam resultado no PostgreSQL.

### 5.1 `parse_esus_csv.py` — e-SUS APS (CSV → PostgreSQL)

Adicionar modo `--json-out` para o backend Node.js consumir via subprocess:

```bash
# Modo existente (mantém funcionando — não quebra)
python3 parse_esus_csv.py <pasta/> saida.sql

# Modo novo (backend web — preview sem gravar)
python3 parse_esus_csv.py <arquivo.csv> --json-out
# → stdout: { "meta": {...}, "sections": [...] }

# Modo novo (backend web — grava direto no PostgreSQL)
python3 parse_esus_csv.py <arquivo.csv> --pg-write
# → usa psycopg2, executa INSERT ON CONFLICT, imprime status JSON no stdout
```

Mudança cirúrgica: adicionar `argparse`, detectar flags, chamar `parse_report()` em arquivo único.

### 5.2 `sync_sia_mysql.py` — SIA/SUS (MySQL → PostgreSQL) — **NOVO**

Script novo. Lê produção ambulatorial do MySQL/XAMPP (somente leitura) e grava na tabela `sia_producao` no PostgreSQL, alimentando `dados_consolidados.modulos.ambulatorial_sia`.

```bash
# Sincronizar competência específica
python3 sync_sia_mysql.py --competencia 2026-05

# Sincronizar últimos N meses
python3 sync_sia_mysql.py --meses 6

# Modo backend web (chamado pelo Node.js via subprocess)
python3 sync_sia_mysql.py --competencia 2026-05 --json-out
# → stdout: { status, competencia, registros, erros }
```

**Credenciais em `.env`:**

```env
# PostgreSQL (Docker)
PG_HOST=localhost
PG_PORT=5432
PG_DB=simpa
PG_USER=postgres
PG_PASS=senha

# MySQL/XAMPP (SIA — somente leitura)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=sia_americanas
MYSQL_USER=simpa_readonly
MYSQL_PASS=senha
```

> Credenciais MySQL nunca em código-fonte. Usuário MySQL deve ser `SELECT` only — PRD Seção 7.1.

---

## 6. Estrutura de projetos

### 6.1 Frontend — `simpa-frontend/`

```
simpa-frontend/
├── public/
├── src/
│   ├── api/
│   │   ├── client.ts          # fetch wrapper (BASE_URL de .env)
│   │   ├── dashboard.ts       # GET /api/v1/dashboard/planejamento
│   │   └── importacao.ts      # POST upload, GET cargas, etc.
│   ├── components/
│   │   ├── ui/                # shadcn/ui re-exports
│   │   ├── charts/
│   │   │   ├── TendenciaChart.tsx    # ECharts line + meta
│   │   │   ├── RoscaChart.tsx        # ECharts donut turnos
│   │   │   ├── PiramideChart.tsx     # ECharts bar espelhado
│   │   │   └── TemasChart.tsx        # ECharts bar horizontal
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       ├── PageWrapper.tsx
│   │       └── FilterBar.tsx         # período + unidade + equipe + badge
│   ├── pages/
│   │   ├── Painel/
│   │   │   ├── index.tsx             # tabs APS / MAC / Hospitalar
│   │   │   ├── TabAPS.tsx            # KPIs + toggle + grid 2x2
│   │   │   ├── TabMAC.tsx
│   │   │   ├── TabHospitalar.tsx
│   │   │   ├── IndicadoresGerais.tsx # 4 KPI cards
│   │   │   ├── PorTema.tsx           # cards de tema + detalhe
│   │   │   └── TemaDetalhe.tsx       # painel contextual ao clicar
│   │   ├── Importacao/
│   │   │   ├── index.tsx             # upload zone + histórico
│   │   │   ├── UploadZone.tsx        # drag & drop, preview de arquivos
│   │   │   └── HistoricoCargas.tsx   # tabela com ações
│   │   ├── Cadastros/
│   │   │   ├── Unidades.tsx          # CRUD básico
│   │   │   └── Equipes.tsx           # CRUD básico
│   │   ├── Metas/index.tsx           # listagem + acompanhamento
│   │   ├── Indicadores/index.tsx     # catálogo + painel C1/B1-B6
│   │   ├── Relatorios/index.tsx      # placeholder "em construção"
│   │   └── Administracao/index.tsx   # usuários básico
│   ├── hooks/
│   │   ├── useFilters.ts             # estado global dos filtros
│   │   ├── useDashboard.ts           # fetch + cache do contrato
│   │   └── useCargas.ts              # fetch do histórico de importação
│   ├── types/
│   │   └── contrato.ts               # tipagem exata do JSON v3.1.0
│   └── main.tsx
├── mock/
│   └── db.json                       # payload PRD Seção 5 (fixture json-server)
├── .env.development                  # VITE_API_BASE=http://localhost:3001
├── .env.production                   # VITE_API_BASE=http://<servidor>:3001
└── package.json
```

### 6.2 Backend — `simpa-backend/`

```
simpa-backend/
├── src/
│   ├── routes/
│   │   ├── importacao.js      # upload, preview, reprocessar, substituir, excluir, cargas
│   │   ├── sia.js             # sincronizar, listar sincronizações, listar produção
│   │   ├── dashboard.js       # GET /api/v1/dashboard/planejamento
│   │   ├── cadastros.js       # CRUD unidades + equipes
│   │   └── indicadores.js     # catálogo + cálculo C1/B1-B6
│   ├── services/
│   │   ├── parser.js          # subprocess parse_esus_csv.py --json-out / --pg-write
│   │   ├── sia.js             # subprocess sync_sia_mysql.py --json-out
│   │   ├── storage.js         # uploads/esus/{ano}/{mes}/{unidade}/ — save, delete, path
│   │   └── db.js              # pg Pool singleton, query helper
│   ├── middleware/
│   │   └── errorHandler.js
│   └── app.js
├── python/
│   ├── parse_esus_csv.py      # parser e-SUS (existente + novas flags)
│   ├── sync_sia_mysql.py      # conector SIA MySQL → PostgreSQL (novo)
│   └── requirements.txt       # psycopg2-binary mysql-connector-python python-dotenv pandas
├── uploads/                   # arquivos físicos CSV (no .gitignore)
├── .env                       # PG_* + MYSQL_* (nunca no git)
├── .env.example               # template de variáveis sem valores
└── package.json
```

---

## 7. Endpoints MVP — contrato backend

### Importação

| Método | Rota | Body / Params | Resposta |
|---|---|---|---|
| `POST` | `/api/importacao/upload` | `multipart: files[]` | `[{ carga_id, tipo, status, registros, erros }]` |
| `POST` | `/api/importacao/:id/reprocessar` | — | `{ carga_id, status, registros, erros }` |
| `PUT` | `/api/importacao/:id/substituir` | `multipart: file` | `{ carga_id, status, registros, erros }` |
| `DELETE` | `/api/importacao/:id` | — | `{ deleted: true }` |
| `GET` | `/api/importacao/cargas` | `?competencia&unidade&status` | `[esus_cargas rows]` |
| `GET` | `/api/importacao/cargas/:id/erros` | — | `[{ linha, motivo }]` |

### Dashboard

| Método | Rota | Params | Resposta |
|---|---|---|---|
| `GET` | `/api/v1/dashboard/planejamento` | `?competencia&unidade&equipe` | payload contrato v3.1.0 |

### SIA / MySQL

| Método | Rota | Body / Params | Resposta |
|---|---|---|---|
| `POST` | `/api/sia/sincronizar` | `{ competencia }` | `{ status, registros, erros }` |
| `GET` | `/api/sia/sincronizacoes` | `?competencia` | `[sia_sincronizacoes rows]` |
| `GET` | `/api/sia/producao` | `?competencia&unidade&codigo_sigtap` | `[sia_producao rows]` |

### Cadastros

| Método | Rota | Função |
|---|---|---|
| `GET/POST` | `/api/cadastros/unidades` | Listar / criar |
| `GET/PUT/DELETE` | `/api/cadastros/unidades/:id` | Detalhe / editar / inativar |
| `GET/POST` | `/api/cadastros/equipes` | Listar / criar |
| `GET/PUT/DELETE` | `/api/cadastros/equipes/:id` | Detalhe / editar / inativar |

---

## 8. Fluxo de upload detalhado

```
1. Frontend: drag & drop N arquivos CSV
2. Frontend: POST /api/importacao/preview (multipart, sem gravar no DB)
   → Backend: chama parse_esus_csv.py --json-out, retorna apenas { meta } por arquivo
   → Frontend: exibe preview (tipo, competência, unidade, equipe) + aviso "já importado" se existir
3. Usuário confirma → Frontend: POST /api/importacao/upload (multipart)
4. Backend:
   a. Salva arquivo em uploads/esus/{ano}/{mes}/{unidade}/{arquivo}.csv
   b. Para cada arquivo:
      i.  Spawn: python3 parse_esus_csv.py <arquivo> --json-out
      ii. Lê JSON do stdout: { meta, sections }
      iii. INSERT esus_cargas ON CONFLICT DO UPDATE
      iv. INSERT esus_indicadores_raw ON CONFLICT DO UPDATE
      v.  UPDATE esus_cargas SET arquivo_path = <caminho>
   c. Retorna array de status por arquivo
5. Frontend: atualiza histórico de cargas (refetch GET /cargas)
```

**Endpoint adicional para preview:**

| Método | Rota | Body | Resposta |
|---|---|---|---|
| `POST` | `/api/importacao/preview` | `multipart: files[]` | `[{ nome, tipo_relatorio, competencia, unidade, equipe, ja_importado }]` |

---

## 9. Tratamento de valores `null`

Conforme PRD Seção 5: `null` = "não apurado", **nunca zero**.

- Frontend: renderizar `null` como `—` com badge âmbar "Não apurado"
- Backend: nunca converter `null` para `0` nos payloads
- TypeScript: campos tipados como `number | null`, sem `!` para forçar tratamento explícito

---

## 10. Escopo desta implementação (Fase 1 Frontend + MVP)

**Incluso:**
- Frontend completo: 7 módulos (Painel COMPLETO, Importação COMPLETO, Cadastros BÁSICO, Metas BÁSICO, Indicadores BÁSICO, Relatórios PLACEHOLDER, Admin BÁSICO)
- Backend Express MVP: upload CSV, reprocessar, substituir, excluir, sincronização SIA, dashboard, CRUD básico
- `parse_esus_csv.py` + flags `--json-out` e `--pg-write`
- `sync_sia_mysql.py` — extrai SIA do MySQL/XAMPP, grava em `sia_producao` no PostgreSQL
- Schema PostgreSQL completo: `schema_esus.sql` + `arquivo_path` + `unidades_saude` + `equipes` + `sia_sincronizacoes` + `sia_producao`
- `json-server` como mock durante desenvolvimento do frontend

**Fora do escopo:**
- Importação SIHD/AIH (próxima etapa após MVP)
- Tabelas de emendas parlamentares / metas financiamento (Fase 2)
- Indicadores epidemiológicos no Painel (Fase 2)
- Autenticação JWT / controle de perfis (após MVP funcional)
- Deploy / infraestrutura de produção

---

## 11. Sequência de build recomendada

1. **Infra** — aplicar schema completo no PostgreSQL Docker (`schema_esus.sql` + novas tabelas) + `pip install` + verificar conexão MySQL/XAMPP
2. **`parse_esus_csv.py`** — adicionar flags `--json-out` e `--pg-write`, testar com CSVs reais em `C:\simpa\`
3. **`sync_sia_mysql.py`** — criar script, testar conexão MySQL read-only, sincronizar competência de teste
4. **Backend MVP** — `db.js` + `.env` → `storage.js` → `parser.js` (subprocess e-SUS) → `sia.js` (subprocess SIA) → rotas importação → rota SIA → rota dashboard
5. **Frontend: mock** — `json-server` + `mock/db.json` + `types/contrato.ts` + `api/client.ts`
6. **Frontend: Layout** — Sidebar + FilterBar (filtros cascata) + PageWrapper + React Router
7. **Frontend: Painel** — KPIs + toggle Indicadores/Temas + 4 gráficos ECharts + aba MAC/SIA
8. **Frontend: Importação** — UploadZone + preview + HistoricoCargas + ações (reprocessar/substituir/excluir)
9. **Integração** — trocar `json-server` pela API real, testar fluxo e-SUS + fluxo SIA com dados reais
10. **Cadastros / Metas / Indicadores / Admin** — telas de suporte
