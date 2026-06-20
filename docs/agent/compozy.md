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
└── (memória opcional em .compozy/tasks/<slug>/memory/)
```

## Workflow ativo: `estabelecimentos-perfil-painel`

| Artefato | Conteúdo |
|----------|----------|
| `_prd.md` | Perfil editável, Painel multi-perfil, KPIs |
| `_techspec.md` | migration 005, APIs, frontend |
| `_tasks.md` | 10 tasks com dependências |
| `adrs/adr-001` … `004` | decisões produto + técnica |

### Status

| Tasks | Estado |
|-------|--------|
| 01 migration 005 | ✅ completed |
| 02 sync condicional | ✅ completed |
| 03–10 | pending |

### Ordem de execução

```
01 migration → 02 sync py → 03 backend service → 04 routes  (03 = próximo)
→ 05 frontend types → 06 UI cadastros → 07 useFilters
→ 08 FilterBar/dashboard → 09 ProfileSwitcher → 10 E2E
```

### Comandos

```powershell
compozy tasks validate --name estabelecimentos-perfil-painel
compozy tasks run estabelecimentos-perfil-painel --ide cursor-agent
```

## Skills Claude/Cursor (`.claude/skills/`)

| Skill | Uso |
|-------|-----|
| `cy-execute-task` | Executar uma `task_NN.md` end-to-end |
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
6. Commit só se usuário pedir (auto-commit conforme skill).

## Referência cruzada

Detalhe de domínio após implementar:

- DB → [database.md](database.md)
- API → [backend-api.md](backend-api.md)
- Cadastros → [cadastros.md](cadastros.md)
- Frontend → [frontend.md](frontend.md)

## Criar novo workflow

1. `cy-create-prd` → aprovar `_prd.md`
2. `cy-create-techspec` → `_techspec.md` + ADRs
3. `cy-create-tasks` → `_tasks.md` + `task_*.md`
4. `compozy tasks validate --name <slug>`
5. Adicionar linha em `CLAUDE.md` (seção Compozy) e este arquivo.
