# Compozy — workflow spec-driven

Ferramenta de PRD → TechSpec → tasks executáveis. Config: `.compozy/` na raiz.

## Estrutura de um workflow

```
.compozy/tasks/<slug>/
├── _prd.md           # requisitos de produto
├── _techspec.md      # decisões técnicas
├── _tasks.md         # índice master + status
├── task_01.md …      # uma task por arquivo
├── adrs/
│   ├── adr-001.md    # produto
│   └── adr-002.md …  # técnicos
├── reviews-NNN/      # review rounds (issues markdown)
└── memory/           # memória compartilhada + por task
```

Workflows concluídos movem para `.compozy/tasks/_archived/<timestamp>-<slug>/`.

## Workflows arquivados

### `importacao-depara-unidade-equipe`

Local: `.compozy/tasks/_archived/1781996141048-c9181226-importacao-depara-unidade-equipe/`

| Artefato | Conteúdo |
|----------|----------|
| `_prd.md` | De-para e-SUS → cadastro, preview gate, Painel por IDs |
| `_techspec.md` | migration 006, `importMappingService`, ETL, API, UI |
| `_tasks.md` | 10 tasks — **todas completed** |
| `adrs/adr-001` … `003` | registry, Todas rules, ID-based dashboard |
| `reviews-001/` | 8 issues resolvidos (review round 1) |

**Entregáveis:** migration 006 · `importMappingService.js` · preview/upload com `resolucoes` · UI Mapeamentos · Painel por IDs · docs agent.

**Commit principal:** `be60db2`

### `estabelecimentos-perfil-painel`

Local: `.compozy/tasks/_archived/1781985788688-5f17b4aa-estabelecimentos-perfil-painel/`

| Artefato | Conteúdo |
|----------|----------|
| `_prd.md` | Perfil editável, Painel multi-perfil, KPIs |
| `_techspec.md` | migration 005, APIs, frontend |
| `_tasks.md` | 10 tasks — **todas completed** |
| `adrs/adr-001` … `004` | decisões produto + técnica |
| `reviews-001/` | 11 issues resolvidos (review round 1) |

**Entregáveis:** migration 005 · enriquecimento por perfil · ProfileSwitcher · E2E + seed `E2E001–004`.

**Commits principais:** `4c43959`, `8353acf`, `5e20371`

### `cadastros-forma-cbo-sia-sih`

Local: `.compozy/tasks/_archived/1782059930411-1eccf03e-cadastros-forma-cbo-sia-sih/`

| Artefato | Conteúdo |
|----------|----------|
| `_prd.md` | Espelho forma/cbo MySQL, Cadastros read-only, SIA/SIH |
| `_techspec.md` | migration 009, sync Python, APIs, UI, join SIA |
| `_tasks.md` | 12 tasks — **todas completed** |
| `reviews-001/` | 1 issue resolvido (inativação com skips) |

**Entregáveis:** migration 009 · `formas_sia`/`cbos_sia` · sync cadastros · APIs/UI Cadastros · `GET /api/sia/producao` enriquecido · `cadastroReferenciaService` (contrato SIH) · docs agent.

Resumo: **[cadastros.md](cadastros.md#workflow-forma-cbo-sia-sih)** · API: **[backend-api.md](backend-api.md)** · UI: **[frontend.md](frontend.md#cadastros)**.

## Comandos úteis

```powershell
compozy tasks validate --name <slug>   # antes de archive
compozy sync --name <slug>               # sincroniza global.db
compozy archive --name <slug>            # move para _archived/
```

Não executar `compozy tasks run` em workflows arquivados — usar spec como referência.

## Skills Claude/Cursor (`.claude/skills/`)

| Skill | Uso |
|-------|-----|
| `cy-execute-task` | Executar uma `task_NN.md` end-to-end |
| `cy-review-round` | Gerar review round |
| `cy-fix-reviews` | Remediar issues do review |
| `cy-create-prd` | Novo PRD |
| `cy-create-techspec` | TechSpec a partir do PRD |
| `cy-create-tasks` | Decompor em tasks |
| `cy-final-verify` | Verificação antes de marcar done |
| `cy-workflow-memory` | Memória entre tasks |

## Ao executar uma task (workflow ativo)

1. Ler `task_NN.md`, `_techspec.md`, ADRs relevantes.
2. Verificar conflitos spec vs código.
3. Implementar escopo mínimo da task.
4. Rodar validações listadas na task.
5. Atualizar checkboxes em `task_NN.md` e `_tasks.md`.
6. Commit só se usuário pedir.

## Criar novo workflow

1. `cy-create-prd` → aprovar `_prd.md`
2. `cy-create-techspec` → `_techspec.md` + ADRs
3. `cy-create-tasks` → `_tasks.md` + `task_*.md`
4. `compozy tasks validate --name <slug>`
5. Adicionar linha em `CLAUDE.md` e este arquivo.
6. Ao concluir: `compozy sync` → `compozy archive` → atualizar docs agent.

## Referência cruzada

- DB → [database.md](database.md)
- API → [backend-api.md](backend-api.md) + [cadastros.md](cadastros.md)
- Frontend → [frontend.md](frontend.md)
- Testes → [testing-ci.md](testing-ci.md)
