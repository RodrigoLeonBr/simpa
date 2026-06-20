# Cadastros — estabelecimentos e procedimentos

## Modelo de dados (estado atual)

Tabela `estabelecimentos` (migration 004):

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | serial | PK |
| `cnes` | varchar | único, espelho MySQL |
| `nome`, `tipo`, `endereco`… | — | sync MySQL |
| `perfil` | varchar | APS, MAC, Hospitalar, Misto, Outro — **sync sobrescreve** |
| `enriquecimento` | JSONB | só Hospitalar/Misto hoje |
| `ativo` | boolean | — |

`procedimentos`: código SUS, descrição, grupo — sync MySQL.

## Fonte de verdade

- **Identidade** (CNES, nome, tipo): MySQL `prestador` via `sync_cadastros_mysql.py`.
- **Enriquecimento manual**: API PUT (não vem do MySQL).
- **Perfil**: derivado no sync (`derive_perfil`); UI bloqueada até feature perfil-painel.

## Backend

### `estabelecimentosService.js`

| Função | Descrição |
|--------|-----------|
| `listEstabelecimentos(filters)` | paginação, busca, filtro perfil |
| `getEstabelecimento(id)` | detalhe + enriquecimento |
| `updateEnriquecimento(id, body)` | merge JSONB Hospitalar/Misto (legado) |

`FORBIDDEN_IDENTITY_KEYS` inclui `perfil` — não editável via PUT genérico hoje.

### `routes/cadastros.js` — endpoints

| Método | Path | Auth |
|--------|------|------|
| GET | `/api/cadastros/estabelecimentos` | JWT |
| GET | `/api/cadastros/estabelecimentos/:id` | JWT |
| PUT | `/api/cadastros/estabelecimentos/:id/enriquecimento` | JWT (JSONB Hospitalar/Misto) |
| GET | `/api/cadastros/procedimentos` | JWT |
| GET | `/api/cadastros/procedimentos/:id` | JWT |
| POST | `/api/cadastros/sincronizar` | JWT + `requirePlanningStaff` |
| GET | `/api/cadastros/sincronizacoes` | JWT — histórico sync |

### Sync (`sync_cadastros_mysql.py`)

- UPSERT estabelecimentos/procedimentos.
- `derive_perfil(tipo, …)` → APS/MAC/Hospitalar/Misto/Outro.
- **Após task 02:** não sobrescreve `perfil` se `perfil_editado = true`.

## Frontend

| Arquivo | Comportamento |
|---------|---------------|
| `EstabelecimentosPage.tsx` | tabela, chips perfil (sem Misto no chip) |
| `EstabelecimentoDetailDrawer.tsx` | perfil = `LockedField` |
| `api/cadastros.ts` | `fetchEstabelecimentos`, `updateEnriquecimento` |
| `utils/enrichmentView.ts` | campos por perfil Hospitalar/Misto |

`useDashboard.ts` usa `fetchEstabelecimentosAps` — filtra só APS para Painel.

---

## Workflow: estabelecimentos-perfil-painel {#workflow-estabelecimentos-perfil-painel}

Spec: `.compozy/tasks/estabelecimentos-perfil-painel/`

### ADRs resumidos

| ADR | Decisão |
|-----|---------|
| adr-001 | Produto: perfis APS/MAC/Hospitalar/Misto, KPIs distintos |
| adr-002 | `perfil_editado BOOLEAN`; sync não sobrescreve se true |
| adr-003 | 5 tabelas enriquecimento + `enriquecimento_outro` |
| adr-004 | `painelPerfil` em `useFilters` |

### Migration 005 (aplicada — task 01 ✅)

Arquivo: `migration_005_estabelecimentos_perfil_enrichment.sql` (também no init Docker).

- `perfil_editado BOOLEAN DEFAULT false`
- Tabelas: `enriquecimento_aps`, `_mac`, `_hospitalar`, `_misto`, `enriquecimento_outro`
- Backfill de JSONB existente

### Tasks (ordem)

1. ~~Migration 005 + backfill~~ ✅
2. ~~Sync Python condicional~~ ✅
3. Backend service perfil/enrichment ← **próximo**
4. Rotas + `requirePlanningStaff` + audit
5. Frontend types + API client
6. UI Cadastros perfil + forms
7. `painelPerfil` em useFilters
8. FilterBar + useDashboard
9. ProfileSwitcher + KPI catalogs
10. Playwright E2E

### Endpoints planejados

| Método | Path |
|--------|------|
| PUT | `/api/cadastros/estabelecimentos/:id/perfil` |
| PUT | `/api/cadastros/estabelecimentos/:id/enriquecimento/:slug` |

Roles: Administrador, Gestor Secretaria, Planejamento.
