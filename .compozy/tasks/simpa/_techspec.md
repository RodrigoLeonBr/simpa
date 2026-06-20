# TechSpec — SIMPA Fullstack (Single-Server Full Redesign)

**Feature:** `simpa`  
**Version:** 1.0  
**Date:** 2026-06-19  
**Status:** Accepted  
**Inputs:** [prd-simpa.md](../../../prd-simpa.md), [2026-06-16-simpa-redesign-auth-design.md](../../../docs/superpowers/specs/2026-06-16-simpa-redesign-auth-design.md), [SIMPA.dc.html](../../../SIMPA_%20tela/SIMPA.dc.html), [design-system.md](../../../docs/design-system.md)

---

## Executive Summary

SIMPA is a spec-driven municipal health BI platform. This TechSpec defines a **greenfield fullstack build** in the existing documentation repository: Docker Compose on one server runs PostgreSQL, a Node.js Express API (with embedded Python ETL), and an Nginx-served React frontend. The UI ports the validated `SIMPA.dc.html` prototype (full redesign scope) using tokens from `docs/design-system.md`.

**Key decisions:** JSON contract v3.1.0 remains the single source of truth; Python handles all parsing/consolidation via subprocess; JWT auth protects `/api/*` with basic RBAC (profile shown in UI, no API-level unit scoping in MVP); SIA reads host XAMPP MySQL via `host.docker.internal`.

**Primary trade-off:** Docker Compose adds operational consistency but couples the API container to host MySQL networking and defers strict LGPD row-level scoping to Phase 2 in exchange for faster delivery of the complete UI surface.

---

## System Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Host (Windows/Linux — 1 server)                                │
│  ┌──────────────┐    host.docker.internal                       │
│  │ XAMPP MySQL  │◄───────────────────────┐                      │
│  │ (SIA read)   │                        │                      │
│  └──────────────┘                        │                      │
│  ┌───────────────────────────────────────┴──────────────────┐  │
│  │ Docker Compose                                              │  │
│  │  ┌─────────┐   proxy    ┌─────────┐   spawn   ┌─────────┐ │  │
│  │  │  web    │──────────►│   api   │──────────►│ Python  │ │  │
│  │  │ (nginx) │  /api     │ (Node)  │ subprocess│ scripts │ │  │
│  │  │ + dist  │           │  :3001  │           └────┬────┘ │  │
│  │  └─────────┘           └────┬────┘                │      │  │
│  │                             │                     │      │  │
│  │                        ┌────▼────┐                │      │  │
│  │                        │postgres │◄───────────────┘      │  │
│  │                        │  :5432  │  pg-write              │  │
│  │                        └─────────┘                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

| Component | Responsibility | Boundary |
|-----------|----------------|----------|
| **web** | Serve React static assets; reverse-proxy `/api/*`, `/auth/*` | No business logic |
| **api** | REST API, JWT auth, file uploads, subprocess orchestration | Does not parse CSV in JS |
| **Python ETL** | `parse_esus_csv.py`, `consolidate_dashboard.py`, `sync_sia_mysql.py` | stdin/stdout JSON contract with API |
| **postgres** | Staging EAV, consolidated JSONB, cadastros, users, audit | Schema v3.1.0 + Phase 2 tables |
| **XAMPP MySQL** | External read-only SIA source | Not containerized |

**Data flow (import → dashboard):**
1. User uploads e-SUS CSV → API saves to `uploads/` → spawns `parse_esus_csv.py --pg-write`
2. API spawns `consolidate_dashboard.py --pg-write` for affected competencia/unidade/equipe
3. Frontend `GET /api/v1/dashboard/planejamento?competencia&unidade&equipe` reads `dados_consolidados`

---

## Implementation Design

### Core Interfaces

Primary TypeScript contract consumed by frontend and validated in API tests:

```typescript
export interface ContratoDashboard {
  plataforma: string;
  versao_schema: '3.1.0';
  competencia: string;
  municipio: string;
  filtros_ativos: { unidade: string; equipe: string };
  kpis_gerais: Record<string, number | null>;
  modulos: ModulosDashboard;
  emendas_parlamentares: EmendaParlamentar[];
  indicadores_qualidade: IndicadorQualidade[];
}

export interface IndicadorQualidade {
  cod: string;
  nomeCurto: string;
  nome: string;
  categoria: string;
  meta: number | null;
  exec: number | null;
  num: string;
  den: string;
  fonte: string;
  periodicidade: string;
  porUnidade?: { unidade: string; exec: number | null }[];
  historico?: { competencia: string; exec: number | null }[];
}
```

Python ETL subprocess interface (API invokes):

```python
# Exit 0 + JSON stdout on success; non-zero + stderr on failure
# parse_esus_csv.py <path> --pg-write [--carga-id N]
# consolidate_dashboard.py --competencia YYYY-MM --unidade "..." --equipe "..." --pg-write
# consolidate_dashboard.py --all --pg-write
# sync_sia_mysql.py --competencia YYYY-MM --pg-write
```

Express auth middleware contract:

```javascript
// verifyJWT → req.user = { id, username, nome, perfil }
// Applied to all /api/* routes; /auth/login public
```

### Data Models

**Existing (schema_full.sql v3.1.0):** `esus_cargas`, `esus_indicadores_raw`, `dados_consolidados`, `unidades_saude`, `equipes`, `sia_sincronizacoes`, `sia_producao`

**New migrations:**

```sql
-- migration_002_auth.sql
CREATE TABLE usuarios (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(80) UNIQUE NOT NULL,
  senha_hash VARCHAR(200) NOT NULL,
  nome VARCHAR(200) NOT NULL,
  perfil VARCHAR(40) NOT NULL CHECK (perfil IN (
    'Administrador','Gestor Secretaria','Gestor de Unidade','Planejamento')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP NOT NULL DEFAULT now(),
  ultimo_login TIMESTAMP
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT REFERENCES usuarios(id),
  acao VARCHAR(80) NOT NULL,
  recurso VARCHAR(200),
  detalhes JSONB,
  ip VARCHAR(45),
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);

-- migration_003_cadastros_fase2.sql
CREATE TABLE procedimentos (...);
CREATE TABLE prestadores_mac (...);
CREATE TABLE hospitais (...);
CREATE TABLE emendas_parlamentares (...);
CREATE TABLE metas_financiamento (...);
CREATE TABLE indicadores (...);  -- catalog
```

**Null semantics:** `null` in JSON means "not computed" — never coerce to `0` in ETL, API, or UI (display `—`).

### API Endpoints

#### Auth (public except `/auth/me`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | `{ username, senha }` → `{ token, user }` |
| POST | `/auth/logout` | `{ ok: true }` (stateless) |
| GET | `/auth/me` | JWT → `{ username, nome, perfil }` |

#### Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health + PG + optional MySQL probe |
| GET | `/api/v1/dashboard/planejamento` | Query: `competencia`, `unidade`, `equipe` → ContratoDashboard |
| POST | `/api/v1/dashboard/consolidar` | Query: `all=true` or competencia params → trigger Python |

#### Importação

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/importacao/preview` | multipart CSV → preview metadata |
| POST | `/api/importacao/upload` | upload + parse + consolidate |
| GET | `/api/importacao/cargas` | list `esus_cargas` |
| POST | `/api/importacao/:id/reprocessar` | re-run parse |
| PUT | `/api/importacao/:id/substituir` | replace file |
| DELETE | `/api/importacao/:id` | cascade delete |

#### SIA

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sia/sincronizar` | `{ competencia }` → spawn sync script |
| GET | `/api/sia/sincronizacoes` | sync history |
| GET | `/api/sia/producao` | filtered production |

#### Cadastros (all JWT-protected)

| Resource | CRUD base |
|----------|-----------|
| `/api/cadastros/unidades` | GET, POST, PUT/:id, DELETE/:id (soft inactivate) |
| `/api/cadastros/equipes` | same |
| `/api/cadastros/procedimentos` | same |
| `/api/cadastros/prestadores-mac` | same |
| `/api/cadastros/hospitais` | same |
| `/api/cadastros/emendas` | same |

#### Admin

| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT | `/api/admin/usuarios` | user CRUD |
| GET | `/api/admin/audit-log` | paginated read-only |
| GET/PUT | `/api/admin/configuracoes` | key-value settings |

---

## Integration Points

| System | Purpose | Auth | Error handling |
|--------|---------|------|----------------|
| **XAMPP MySQL** | SIA production read | Read-only DB user in `.env` | Return `MySQL_XAMPP_UNAVAILABLE`; dashboard shows pending MAC status |
| **e-SUS CSV files** | Manual monthly upload | N/A (file validation) | Parser validates headers; reject with actionable error |
| **SIHD/AIH** | Hospital module (Phase 1 placeholder) | N/A | `status_importacao: PENDING_AIH_FILE` until upload endpoint added |

---

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|-----------|-------------|---------------------|-----------------|
| `parse_esus_csv.py` | modified | Add/verify `--json-out`, `--pg-write` flags | Keep as ETL entry point |
| `consolidate_dashboard.py` | new | Missing locally; builds v3.1.0 payload | Implement per PRD Section 5 |
| `sync_sia_mysql.py` | new | Missing locally | Implement SIA connector |
| `schema_full.sql` | modified | Add migrations 002/003 | Apply on postgres init |
| `SIMPA.dc.html` | reference | Visual source only | Port to React; do not ship dc-runtime |
| `simpa-backend/` | new | Entire Express app | Create from Plano B + auth |
| `simpa-frontend/` | new | Full redesign React app | Create from redesign spec |
| `docker-compose.yml` | new | Single-server deploy | ADR-001 |

---

## Testing Approach

### Unit Tests

- **Python (`pytest`):** parser encoding, column mapping, consolidation shape, null handling
- **Backend (`jest`):** auth hash/verify, JWT middleware, dashboard query builders (mocked pg)
- **Frontend (`vitest`):** AuthContext, FilterBar cascade, KPI formatters, null display `—`

### Integration Tests

- **API (`supertest`):** full auth flow; dashboard with seed data; upload with mocked subprocess JSON
- **Contract:** JSON Schema validation against ContratoDashboard v3.1.0 fixtures

### E2E (Playwright)

- Login → Painel (layout switch A/B/C) → filter change → Importação upload (fixture CSV) → Cadastros navigation → dark mode toggle → logout
- Run against `docker compose -f docker-compose.yml -f docker-compose.test.yml up`

---

## Development Sequencing

### Build Order

1. **Infrastructure & schema** — Docker Compose, postgres init, `.env.example`, migrations 002/003 — no dependencies
2. **Python ETL suite** — `consolidate_dashboard.py`, `sync_sia_mysql.py`, `requirements.txt`, pytest — depends on step 1
3. **Backend foundation** — Express app, `db.js`, error handler, health — depends on step 1
4. **Auth backend** — `usuarios`, JWT routes, `verifyJWT` on `/api/*` — depends on step 3
5. **Dashboard API** — GET planejamento, POST consolidar — depends on steps 2, 3
6. **Importação API** — upload, preview, cargas CRUD — depends on steps 2, 3, 4
7. **SIA API** — sincronizar, producao — depends on steps 2, 3, 4
8. **Cadastros & Admin API** — all CRUD + audit — depends on steps 3, 4
9. **Frontend scaffold** — Vite, design system CSS vars, React Router, types — no backend dependency (json-server mock)
10. **Auth frontend** — Login, AuthContext, ProtectedRoute, api client — depends on steps 4, 9
11. **App shell** — Sidebar 236px, Topbar, FilterBar, AppContext (theme, isSituacao) — depends on steps 9, 10
12. **Painel** — layouts A/B/C, ECharts — depends on steps 5, 11
13. **Sala de Situação** — fullscreen overlay — depends on steps 11, 12
14. **Indicadores, Metas, Relatórios** — full pages — depends on steps 11, 12
15. **Importação UI** — upload zone, histórico — depends on steps 6, 11
16. **Cadastros UI** — grid + 6 sub-routes — depends on steps 8, 11
17. **Administração UI** — usuários, audit, config — depends on steps 8, 11
18. **Production integration** — nginx config, swap mock → real API, docker compose prod profile — depends on steps 3–17
19. **API integration test suite** — supertest coverage — depends on steps 4–8
20. **Playwright E2E + CI** — depends on steps 10–18

### Technical Dependencies

- Docker Desktop on host (Windows dev) or Docker Engine (Linux prod)
- XAMPP MySQL running with read-only user before SIA sync testing
- Sample CSVs in repo root for ETL and E2E fixtures
- IBM Plex fonts via Google Fonts CDN (or self-host in `public/`)

---

## Monitoring and Observability

| Metric | Source | Alert |
|--------|--------|-------|
| API latency p95 | Express middleware log | > 2s on dashboard endpoint |
| ETL duration | subprocess exit log | > 10 min per competencia |
| Import failures | `esus_cargas` status + audit_log | any parse error |
| PG connection pool | pg pool events | connection exhaustion |
| JWT auth failures | audit_log `acao=login_failed` | spike > 10/min |

Structured log fields: `requestId`, `userId`, `competencia`, `subprocess`, `durationMs`.

---

## Technical Considerations

### Key Decisions

- **Docker Compose (ADR-001):** reproducible single-server; trade-off is host MySQL coupling
- **Spec-driven stack (ADR-002):** preserves existing Python/SQL investment
- **Basic JWT (ADR-004):** faster MVP; Phase 2 adds API scoping by perfil/unidade
- **React port of prototype (ADR-005):** full UI scope; largest work item is frontend
- **Full test pyramid (ADR-006):** Playwright guards multi-screen flows

### Known Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| e-SUS CSV layout change | Medium | Header validation + alert in import UI |
| XAMPP MySQL unreachable from Docker | Medium | Health probe + docs for `extra_hosts` |
| Indicator formulas (C1/B1-B6) incomplete | High | Show `null`/`—`; catalog editable in Admin |
| SIHD not available | High | Explicit pending status; non-blocking |

---

## Architecture Decision Records

- [ADR-001: Docker Compose Single-Server Deployment](adrs/adr-001.md) — Compose stack with host XAMPP MySQL for SIA
- [ADR-002: Spec-Driven Stack (Node + React + Python + PostgreSQL)](adrs/adr-002.md) — PRD-aligned stack; Python subprocess ETL
- [ADR-003: SIA MySQL via XAMPP Host](adrs/adr-003.md) — `host.docker.internal` read-only connector
- [ADR-004: Basic JWT Auth Without API-Level RBAC in MVP](adrs/adr-004.md) — JWT on all `/api/*`; scoping deferred
- [ADR-005: React Port of SIMPA.dc.html Full Redesign](adrs/adr-005.md) — Full UI scope from validated prototype
- [ADR-006: Full Test Strategy (Unit + API Integration + Playwright E2E)](adrs/adr-006.md) — Three-layer test pyramid
