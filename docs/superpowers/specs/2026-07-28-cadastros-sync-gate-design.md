# Design — Gate manter/alterar no sync de cadastros (SIMPA fonte de verdade)

**Data:** 2026-07-28
**Escopo:** estabelecimentos + procedimentos (forma/cbo/rubrica ficam sync cego)
**Status:** design aprovado, aguardando plano de implementação

---

## Premissa

SIMPA é a fonte de verdade dos cadastros. O sync com o MySQL (produção/XAMPP) é
**opcional e não-destrutivo**: nada é sobrescrito sem o usuário aprovar. Quando o
MySQL diverge de uma linha existente, o processo **pergunta manter (valor SIMPA) ou
alterar (valor MySQL)** antes de gravar.

### Problema que motivou

O sync atual (`sync_cadastros_mysql.py --pg-write` via `POST /api/cadastros/sincronizar`)
é upsert cego: sobrescreve todo campo não protegido por flag `*_editado`, e inativa
qualquer `codigo_externo` ausente do snapshot MySQL. No sync de 2026-06-24 os 104
estabelecimentos foram todos marcados `inativo` (MySQL `prestador.ativo != 1`),
sumindo da página `/cadastros/estabelecimentos` (filtra `status='ativo'` por default).
Dado não foi perdido — só sobrescrito sem aviso. Corrigido pontualmente
(`UPDATE status='ativo', status_editado=true` nos 104); este design impede recorrência.

---

## Decisões (brainstorming)

| Tema | Decisão |
|------|---------|
| Entidades no gate | Estabelecimentos + procedimentos. Forma/cbo/rubrica seguem sync cego. |
| Linha existente diverge | Gate de diff preview + aprovar. |
| Eventos que passam pelo gate | Update de campo, linha nova (MySQL), sumiu do MySQL. **Todos** — sync 100% não-destrutivo. |
| Granularidade | Por linha + ações bulk (aplicar todos / manter todos por aba). |
| Re-proposta | "Manter" = no-op nesse run; diff re-aparece no próximo `--plan` enquanto MySQL divergir. Sem tracking de dispensa. "Aplicar" grava o valor MySQL → diff some. |
| Persistência do plano | **Nenhuma.** Plano é efêmero (stateless), vive na memória do frontend entre computar e aplicar. |

### Campos comparados

- **Estabelecimento** (`codigo_externo`): nome, cnpj, re_tipo, tipouni, perfil, area, relatorio, status. Respeita `nome_editado` / `perfil_editado` / `status_editado` — campo SIMPA-owner não entra no plano.
- **Procedimento** (`codigo_sigtap`): descricao, pa_total, rubrica, pa_id, financiamento, status.

---

## Arquitetura (Approach A — Python planeja, Node grava)

Python continua read-only (alinha com "espelho read-only"). Node persiste nada e
aplica o subset aprovado. Reusa `cadastrosSync.js` — sem serviço novo, sem migration,
sem tabela nova.

```
Banner "Sincronizar"
   │  POST /api/cadastros/sync-plano
   ▼
cadastrosSync.js ── spawn python sync_cadastros_mysql.py --plan (read-only)
   │                    extrai MySQL + SELECT estado PG, calcula diff
   ▼  { estabelecimentos:[…], procedimentos:[…], resumo:{…} }   (JSON, não grava)
Frontend segura o plano em memória → SyncPlanoPreview.tsx
   │  usuário marca manter/aplicar por linha + bulk
   │  POST /api/cadastros/sync-plano/aplicar  { itens: [subset 'aplicar'] }
   ▼
cadastrosSync.js.aplicarPlano() ── transação: UPDATE/INSERT estab+proc
                                     guard anti-clobber por item
```

---

## Contrato Python `--plan`

Novo modo em `sync_cadastros_mysql.py`. **Zero writes.**

- Extrai MySQL (reusa extração atual de prestador + procedimento).
- `SELECT` estado atual PG de `estabelecimentos` e `procedimentos`.
- Para cada entidade, classifica cada chave:
  - `novo` — existe no MySQL, não no PG. `diff` = só valores MySQL.
  - `alterado` — existe nos dois, ≥1 campo comparado difere (pulando campos `*_editado=true`). `diff` = `{campo: {simpa, mysql}}` só dos que diferem.
  - `sumiu` — existe no PG (`status='ativo'`), ausente do snapshot MySQL. `diff` = valor SIMPA atual.
- Emite JSON:

```json
{
  "estabelecimentos": [
    {"chave": "1234567", "tipo": "alterado",
     "diff": {"status": {"simpa": "ativo", "mysql": "inativo"},
              "nome":   {"simpa": "UBS X", "mysql": "UBS X ANEXO"}}},
    {"chave": "9999999", "tipo": "novo",
     "diff": {"nome": {"mysql": "UBS NOVA"}, "cnpj": {"mysql": "..."}, "...": {}}}
  ],
  "procedimentos": [ … ],
  "resumo": {"estabelecimentos": {"novo": 1, "alterado": 12, "sumiu": 0},
             "procedimentos": {"novo": 0, "alterado": 3, "sumiu": 0}}
}
```

`--pg-write` (modo atual) segue intacto — usado só pelo sync cego de forma/cbo/rubrica.

---

## Backend — `cadastrosSync.js` (endpoints em `routes/cadastros.js`)

Ambos `requirePlanningStaff`. Reusa lock `syncInFlight` para serializar `--plan`.

| Método | Rota | Ação |
|--------|------|------|
| `POST` | `/cadastros/sync-plano` | Roda `--plan`, retorna `{estabelecimentos, procedimentos, resumo}`. Não grava. |
| `POST` | `/cadastros/sync-plano/aplicar` | Body `{itens:[{entidade, chave, tipo, diff}]}` (só os `aplicar`). Aplica em transação. Retorna `{aplicados, pulados}`. Audit `cadastros_sync_plano_aplicar`. |

### Apply (transação única)

Por item aprovado, conforme `tipo`:

- `novo` → `INSERT` estab/proc com defaults do upsert atual (`*_editado=false`).
- `alterado` → `UPDATE` só os campos presentes no `diff`, gravando o valor `mysql`.
- `sumiu` → `UPDATE status='inativo'`.

**Guard anti-clobber (data-safety, não simplificar):** antes de aplicar `alterado`/`sumiu`,
re-lê o valor SIMPA atual do campo; se ≠ do `diff.simpa` mostrado, **pula** o item
(alguém editou nesse meio-tempo) e soma em `pulados`. Evita clobber por plano stale
sem precisar persistir plano.

Forma/cbo/rubrica **não** entram aqui — continuam pelo `POST /sincronizar` cego atual.

---

## Frontend

- **`CadastroSyncBanner.tsx`** — botão "Sincronizar cadastros" passa a chamar
  `POST /sync-plano`. Se `resumo` tem itens → abre preview. Zero diffs → toast
  "nada a alterar".
- **`SyncPlanoPreview.tsx`** (novo, drawer/modal) — segura o plano em estado local:
  - 2 abas: Estabelecimentos / Procedimentos.
  - Linha `novo` → badge verde, valores MySQL.
  - Linha `alterado` → tabela `campo | SIMPA | MySQL`, diff destacado.
  - Linha `sumiu` → badge âmbar "some do MySQL", valor SIMPA.
  - Toggle manter/aplicar por linha + "aplicar todos"/"manter todos" por aba.
  - "Confirmar" → `POST /aplicar` com subset `aplicar`; toast `{aplicados, pulados}`.
- Estado no próprio componente — **sem** hook `useSyncPlano` separado.
- Tipos em `types/cadastros.ts`: `SyncPlano`, `SyncPlanoItem`, `SyncPlanoAplicarResult`.
- `api/cadastros.ts`: `computarSyncPlano()`, `aplicarSyncPlano(itens)`.

Sync de forma/cbo/rubrica fica em botão/fluxo separado (inalterado).

---

## Testes

- **pytest** (`--plan`): gera diff correto nos 3 tipos; respeita `*_editado`; não grava nada (asserção de zero writes / dry-run).
- **Jest** (`cadastrosSync`): apply transacional (novo/alterado/sumiu); guard anti-clobber pula item com SIMPA divergente; 409 em `--plan` concorrente.
- **Vitest**: `SyncPlanoPreview` renderiza os 3 tipos, toggle por linha e bulk, monta payload de apply correto.

---

## Fora de escopo (YAGNI)

- Persistência/retomada de plano entre sessões — plano é recomputável e barato.
- Gate para forma/cbo/rubrica — referência pura, sem edição manual.
- Granularidade por campo no apply — por linha basta.
- Tracking de "dispensa" de diff — re-propor sempre é mais simples.
