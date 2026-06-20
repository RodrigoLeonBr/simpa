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
└── (memória opcional)
```

## Workflow arquivado: `estabelecimentos-perfil-painel`

Local: `.compozy/tasks/_archived/*-estabelecimentos-perfil-painel/`

| Artefato | Conteúdo |
|----------|----------|
| `_prd.md` | Perfil editável, Painel multi-perfil, KPIs |
| `_techspec.md` | migration 005, APIs, frontend |
| `_tasks.md` | 10 tasks — **todas completed** |
| `adrs/adr-001` … `004` | decisões produto + técnica |
| `reviews-001/` | 11 issues resolvidos (review round 1) |

### Status

| Tasks | Estado |
|-------|--------|
| 01–10 | ✅ completed |

### Entregáveis principais

- Migration 005 + sync com `perfil_editado`
- API `PUT /perfil`, `PUT /enriquecimento/:slug`
- Cadastros: drawer + `EnrichmentFormByPerfil`
- Painel: `ProfileSwitcher`, placeholder MAC/Hospitalar/Misto
- E2E + seed `E2E001–004` (`npm run seed:e2e`)

### Comandos (histórico)

Workflow arquivado — não executar `tasks run`. Referência:

```powershell
compozy sync --name estabelecimentos-perfil-painel   # antes de archive
compozy archive --name estabelecimentos-perfil-painel
```

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

## Ao executar uma task

1. Ler `task_NN.md`, `_techspec.md`, ADRs relevantes.
2. Verificar conflitos spec vs código.
3. Implementar escopo mínimo da task.
4. Rodar validações listadas na task.
5. Atualizar checkboxes em `task_NN.md` e `_tasks.md`.
6. Commit só se usuário pedir.

## Referência cruzada

Detalhe de domínio:

- DB → [database.md](database.md)
- API → [backend-api.md](backend-api.md) + [cadastros.md](cadastros.md)
- Frontend → [frontend.md](frontend.md)
- Testes → [testing-ci.md](testing-ci.md)

## Criar novo workflow

1. `cy-create-prd` → aprovar `_prd.md`
2. `cy-create-techspec` → `_techspec.md` + ADRs
3. `cy-create-tasks` → `_tasks.md` + `task_*.md`
4. `compozy tasks validate --name <slug>`
5. Adicionar linha em `CLAUDE.md` (seção Compozy) e este arquivo.
