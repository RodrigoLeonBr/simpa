---
status: completed
title: Cadastros UI — superseded
type: frontend
complexity: high
dependencies:
  - task_08
  - task_11
notes: delivered via archived simpa-cadastros-sync (2026-06-20)
---

> **Superseded and delivered by [`simpa-cadastros-sync`](../_archived/1781967665702-a4fca8ed-simpa-cadastros-sync/_prd.md)** (archived 2026-06-20).
>
> O modelo original (6 cards: Unidades, Prestadores MAC, Hospitais) foi substituído por:
> - Grid unificado com **Estabelecimentos** + **Procedimentos** (read-only, sync MySQL)
> - CRUD manual apenas para **Equipes** e **Emendas**
> - Banner de sync manual + enriquecimento hospitalar
>
> Implementação entregue nas tasks 07–10 do workflow arquivado. **Não reimplementar** as sub-rotas legadas.

# Task 16: Cadastros UI — superseded

## Overview

~~Implement Cadastros landing grid (6 clickable cards) and sub-route CRUD pages for Unidades, Equipes, Procedimentos, Prestadores MAC, Hospitais, and Emendas Parlamentares.~~

**Entregue como redesign MySQL sync** — ver workflow arquivado `simpa-cadastros-sync`.

## What was delivered (replacement scope)

| Original (task 16) | Entregue (cadastros-sync) |
|--------------------|---------------------------|
| 6 cards CRUD | 5 cards: Estabelecimentos, Procedimentos, Equipes, Emendas, Admin link |
| `/cadastros/unidades` | `/cadastros/estabelecimentos` (read-only + enrichment) |
| `/cadastros/prestadores-mac`, `/cadastros/hospitais` | Perfil filter em estabelecimentos (APS/MAC/Hospitalar) |
| `/cadastros/procedimentos` CRUD | `/cadastros/procedimentos` read-only + sync |
| Manual create synced entities | `POST /api/cadastros/sincronizar` (MySQL → PG) |

## Subtasks (original — all superseded)
- [x] 16.1 Cadastros index grid page → `CadastroGrid.tsx` + sync banner
- [x] 16.2 Shared CRUD table/form → `DataTable`, `FormDialog`, `ReadOnlyDataTable`
- [x] 16.3 Unidades + Equipes → Equipes CRUD + estabelecimentos APS dropdown
- [x] 16.4 Procedimentos, Prestadores, Hospitais, Emendas → Procedimentos read-only + Emendas CRUD

## Relevant Files (as implemented)

- `simpa-frontend/src/pages/Cadastros/index.tsx`
- `simpa-frontend/src/pages/Cadastros/CadastroGrid.tsx`
- `simpa-frontend/src/pages/Cadastros/CadastroSyncBanner.tsx`
- `simpa-frontend/src/pages/Cadastros/EstabelecimentosPage.tsx`
- `simpa-frontend/src/pages/Cadastros/ProcedimentosPage.tsx`
- `simpa-frontend/src/components/cadastros/CadastroCrudPage.tsx` (equipes/emendas)
- `simpa-frontend/src/config/cadastroEntities.ts`

## Tests (delivered via cadastros-sync)

- [x] Grid sem cards legados (unidades, prestadores-mac, hospitais)
- [x] Estabelecimentos read-only + enrichment hospitalar
- [x] Sync banner + degraded mode MySQL indisponível
- [x] Equipe create com `estabelecimento_id`

## Success Criteria

- ~~Grid matches prototype 6-card layout~~ → Grid 5-card + sync banner (PRD cadastros-sync)
- All cadastros-sync tests passing (141 frontend + 198 backend Jest)
