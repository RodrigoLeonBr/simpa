# TechSpec — Cadastros Forma/CBO para SIA/SIH

**Feature:** `cadastros-forma-cbo-sia-sih`  
**Versão:** 1.0  
**Data:** 2026-06-21  
**Status:** Draft  
**PRD:** [_prd.md](./_prd.md)

---

## Resumo executivo

A implementação segue o padrão atual do SIMPA:

- Sync Python (`sync_cadastros_mysql.py`) como fonte única de espelhamento;
- Rotas Express finas (`routes/cadastros.js`) com serviços dedicados;
- Frontend em `Cadastros` com páginas de leitura e aviso de origem MySQL.

As tabelas de referência serão usadas imediatamente no SIA e preparadas para SIH por contrato de código.

---

## Estado atual relevante

- MySQL produção (`producao.sql`):
  - `cbo(CBO, DS_CBO)`
  - `forma(id_registro, grupo, subgrupo, forma, descricao)`
  - `s_prd.prd_cbo` e colunas derivadas `grupo/subgrupo/forma`.
- SIMPA:
  - Sync de cadastros já processa `prestador` e `procedimento`.
  - `cadastros_sincronizacoes` só registra contadores de estabelecimentos/procedimentos.
  - `CADASTRO_GRID_ITEMS` já suporta novas entradas de card.

---

## Design técnico

### 1) Modelo de dados PostgreSQL

Nova migration proposta: `migration_009_cadastros_forma_cbo.sql`.

#### Tabela `formas_sia`

- `id BIGSERIAL PRIMARY KEY`
- `codigo_grupo VARCHAR(2) NOT NULL`
- `codigo_subgrupo VARCHAR(4) NOT NULL`
- `codigo_forma VARCHAR(6) UNIQUE NOT NULL`
- `descricao VARCHAR(120) NOT NULL`
- `status VARCHAR(20) NOT NULL DEFAULT 'ativo'`
- `sincronizado_em TIMESTAMP`
- `criado_em TIMESTAMP NOT NULL DEFAULT now()`

Índices:
- `(codigo_grupo, status)`
- `(codigo_subgrupo, status)`
- `(codigo_forma, status)`

#### Tabela `cbos_sia`

- `id BIGSERIAL PRIMARY KEY`
- `codigo_cbo VARCHAR(6) UNIQUE NOT NULL`
- `descricao VARCHAR(160) NOT NULL`
- `status VARCHAR(20) NOT NULL DEFAULT 'ativo'`
- `sincronizado_em TIMESTAMP`
- `criado_em TIMESTAMP NOT NULL DEFAULT now()`

Índices:
- `(codigo_cbo, status)`
- `(status, descricao)`

#### Auditoria de sync

Expandir `cadastros_sincronizacoes` com:

- `forma_inseridos INT NOT NULL DEFAULT 0`
- `forma_atualizados INT NOT NULL DEFAULT 0`
- `forma_inativados INT NOT NULL DEFAULT 0`
- `cbo_inseridos INT NOT NULL DEFAULT 0`
- `cbo_atualizados INT NOT NULL DEFAULT 0`
- `cbo_inativados INT NOT NULL DEFAULT 0`

### 2) Sync Python (`sync_cadastros_mysql.py`)

#### Extração MySQL

Adicionar ao `build_cadastro_config`:

- `table_forma` (default: `forma`)
- `table_cbo` (default: `cbo`)
- `col_forma_grupo`, `col_forma_subgrupo`, `col_forma_codigo`, `col_forma_desc`
- `col_cbo_codigo`, `col_cbo_desc`

Novas funções:

- `build_forma_query(cfg)`
- `build_cbo_query(cfg)`
- `extrair_formas(conn_mysql, cfg)`
- `extrair_cbos(conn_mysql, cfg)`

#### Normalização

- `normalize_forma_row`:
  - trim de códigos, garantir tamanhos 2/4/6;
  - fallback derivado: `grupo = left(codigo_forma,2)`, `subgrupo = left(codigo_forma,4)`.
- `normalize_cbo_row`:
  - código CBO canônico 6 caracteres;
  - descrição obrigatória.

#### Persistência

Novos SQLs UPSERT:

- `UPSERT_FORMA_SQL` em `formas_sia` por `codigo_forma`;
- `UPSERT_CBO_SQL` em `cbos_sia` por `codigo_cbo`.

Atualizar rotina de inativação e contadores para as duas novas entidades.

### 3) Backend Node

#### Serviço de sync

`simpa-backend/src/services/cadastrosSync.js`:

- ampliar `mapSyncRow` para incluir blocos `formas` e `cbos`;
- ampliar SELECT de histórico/último sync com novas colunas.

#### Rotas de cadastros

`simpa-backend/src/routes/cadastros.js`:

- `GET /api/cadastros/formas`
- `GET /api/cadastros/cbos`

Implementação recomendada:

- serviços dedicados de leitura:
  - `services/formasService.js`
  - `services/cbosService.js`
- listagem com filtros `q`, `grupo`, `subgrupo`, `status`, `page`, `limit`.

#### Contrato API

Resposta `formas`:

- `id`, `codigo_grupo`, `codigo_subgrupo`, `codigo_forma`, `descricao`, `status`, `sincronizado_em`

Resposta `cbos`:

- `id`, `codigo_cbo`, `descricao`, `status`, `sincronizado_em`

### 4) Frontend

#### Menu Cadastros

Atualizar `simpa-frontend/src/config/cadastroEntities.ts`:

- inserir cards:
  - `formas`
  - `cbos`

Atualizar `simpa-frontend/src/pages/Cadastros/index.tsx`:

- rotas:
  - `/cadastros/formas`
  - `/cadastros/cbos`

#### Páginas

Criar:

- `pages/Cadastros/FormasPage.tsx`
- `pages/Cadastros/CbosPage.tsx`

Com:

- tabela read-only,
- busca,
- indicação de origem (MySQL),
- reutilização de componentes existentes de Cadastros.

### 5) Integração SIA/SIH

#### SIA (imediato)

- enriquecer consultas (service/report) com join por:
  - `left(prd_pa,6) -> formas_sia.codigo_forma`
  - `left(prd_cbo,6) -> cbos_sia.codigo_cbo`

#### SIH (preparação)

- criar interface de mapeamento em serviço compartilhado:
  - `resolveFormaDescricao(codigoForma)`
  - `resolveCboDescricao(codigoCbo)`

Sem bloquear MVP caso pipeline SIH não esteja pronto.

---

## Estratégia de testes

- **Python (pytest):**
  - extração/normalização de forma e cbo;
  - compatibilidade de códigos;
  - snapshot vazio.
- **Backend (Jest):**
  - rotas `GET /cadastros/formas` e `GET /cadastros/cbos`;
  - shape de `sincronizacoes` com novos contadores.
- **Frontend (Vitest):**
  - cards novos no `CadastrosPage`;
  - navegação para novas rotas;
  - render de tabelas e busca.

---

## Plano de rollout

1. Migration + sync Python + contadores.
2. APIs backend read-only.
3. UI Cadastros (cards + páginas).
4. Integração SIA.
5. Ponto de extensão SIH + docs.

---

## Decisões arquiteturais

1. **Read-only no MVP** para preservar fonte de verdade no MySQL de produção.
2. **Tabelas dedicadas no PG** (`formas_sia`, `cbos_sia`) para evitar acoplamento a tabela genérica de CRUD manual.
3. **Join por código canônico** com normalização, evitando dependência de IDs internos do MySQL.
