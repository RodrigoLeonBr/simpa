# Leitos hospitalares (UTI split + detalhe CNES + vigências) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir cadastrar leitos hospitalares por vigência (competência), com resumo (UTI Adulto/Neonatal separados) e detalhamento opcional CNES consistente.

**Architecture:** Nova tabela `enriquecimento_hospitalar_leitos_vigencia` + service/rotas CRUD; validação pura compartilhada (catálogo, overlap, consistência); UI de vigências no enriquecimento Hospitalar/Misto; espelho da vigência aberta em `enriquecimento_*.leitos` para leitura legada. Painel por competência fica fora.

**Tech Stack:** PostgreSQL 15, Express/Jest (`simpa-backend`), React/Vitest (`simpa-frontend`), migration SQL + `docker-compose.yml`.

**Spec:** [`docs/superpowers/specs/2026-07-21-leitos-hospitalares-vigencia-design.md`](../specs/2026-07-21-leitos-hospitalares-vigencia-design.md)

## Global Constraints

- Um número inteiro ≥ 0 por tipo (sem pares existentes/SUS)
- Resumo sempre editável; detalhe opcional (catálogo fixo)
- Se qualquer qtd do detalhe > 0, somas por grupo devem bater com o resumo (senão 400)
- Vigências do mesmo estabelecimento não se sobrepõem
- UI `99/9999` → `999999`; início/fim `YYYYMM`
- CRUD de leitos só via `/leitos-vigencias` (abordagem leve: PUT enriquecimento legado NÃO é alterado; espelho + remoção no front tornam `leitos` do body inofensivo)
- Após mutate vigência, espelhar resumo da vigência aberta (`fim=999999`) em `enriquecimento_hospitalar.leitos` / `enriquecimento_misto.leitos`
- Psiquiatria (47) → grupo `clinico`
- Não implementar consumo no Painel nesta entrega

## File map

| Arquivo | Responsabilidade |
|---------|------------------|
| `migration_026_leitos_vigencia.sql` | DDL + backfill a partir de enrichment pai |
| `docker-compose.yml` | Montar migration 026 |
| `simpa-backend/src/services/leitosCatalog.js` | Catálogo CNES, chaves resumo, normalização `uti` |
| `simpa-backend/src/services/leitosVigenciaValidation.js` | Validar payload, overlap, consistência |
| `simpa-backend/src/services/leitosVigenciaService.js` | CRUD + espelho |
| `simpa-backend/src/routes/cadastros.js` | Rotas `/leitos-vigencias` |
| `simpa-backend/src/services/estabelecimentosService.js` | Ignorar `leitos` no PUT; anexar `leitos_vigencias` no GET |
| `simpa-frontend/src/utils/leitosCatalog.ts` | Catálogo + validação espelhada |
| `simpa-frontend/src/utils/enrichmentView.ts` | `LEITOS_KEYS` sem `uti` |
| `simpa-frontend/src/api/cadastros.ts` | Client CRUD vigências |
| `simpa-frontend/src/types/cadastros.ts` | Tipos vigência |
| `simpa-frontend/src/components/cadastros/leitos/LeitosVigenciasPanel.tsx` | Lista + editor |
| `EnrichmentHospitalarForm` / `EnrichmentMistoForm` / `EnrichmentForm` | Remover edição inline de leitos; embutir painel |
| `docs/agent/cadastros.md`, `docs/agent/database.md` | Documentar |

---

### Task 1: Catálogo e validação pura (backend)

**Files:**
- Create: `simpa-backend/src/services/leitosCatalog.js`
- Create: `simpa-backend/src/services/leitosVigenciaValidation.js`
- Create: `simpa-backend/tests/leitosVigenciaValidation.test.js`

**Interfaces:**
- Produces:
  - `LEITOS_RESUMO_KEYS = ['clinico','cirurgico','obstetrico','pediatrico','uti_adulto','uti_neonatal']`
  - `LEITOS_DETALHE_CATALOG`: array `{ codigo, descricao, grupo }`
  - `normalizeLeitosResumo(leitos) → object` (`uti` → `uti_adulto`)
  - `validateVigenciaPayload(body) → { ok, error? }`
  - `rangesOverlap(aInicio, aFim, bInicio, bFim) → boolean`
  - `assertDetalheConsistente(leitos, leitosDetalhe) → string|null` (mensagem de erro ou null)

- [ ] **Step 1: Write failing tests**

```js
const {
  normalizeLeitosResumo,
  validateVigenciaPayload,
  rangesOverlap,
  assertDetalheConsistente,
} = require('../src/services/leitosVigenciaValidation');

describe('leitosVigenciaValidation', () => {
  it('normalizeLeitosResumo maps uti → uti_adulto', () => {
    expect(normalizeLeitosResumo({ uti: 10, clinico: 1 })).toEqual({
      clinico: 1,
      uti_adulto: 10,
    });
  });

  it('rangesOverlap detects adjacent as non-overlap and crossing as overlap', () => {
    expect(rangesOverlap('202101', '202306', '202307', '202409')).toBe(false);
    expect(rangesOverlap('202101', '202306', '202306', '202409')).toBe(true);
  });

  it('assertDetalheConsistente requires group sums to match when detail used', () => {
    const leitos = {
      clinico: 44,
      cirurgico: 47,
      obstetrico: 22,
      pediatrico: 8,
      uti_adulto: 17,
      uti_neonatal: 5,
    };
    const ok = {
      '33': 44,
      '03': 30,
      '13': 17,
      '10': 13,
      '43': 9,
      '45': 6,
      '68': 2,
      '75': 17,
      '81': 5,
      '47': 0,
    };
    expect(assertDetalheConsistente(leitos, ok)).toBeNull();
    expect(assertDetalheConsistente(leitos, { '75': 10 })).toMatch(/uti_adulto/i);
  });

  it('validateVigenciaPayload rejects unknown detail code and bad YYYYMM', () => {
    const bad = validateVigenciaPayload({
      vigencia_inicio: '202413',
      vigencia_fim: '999999',
      leitos: { clinico: 1 },
      leitos_detalhe: {},
    });
    expect(bad.ok).toBe(false);

    const unknown = validateVigenciaPayload({
      vigencia_inicio: '202410',
      vigencia_fim: '999999',
      leitos: { clinico: 1 },
      leitos_detalhe: { '99': 1 },
    });
    expect(unknown.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
cd e:\xampp\htdocs\simpa\simpa-backend; npx jest tests/leitosVigenciaValidation.test.js -v
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement catalog + validation**

`leitosCatalog.js` — exportar catálogo da spec (códigos 75,81,03,13,33,10,43,47,68,45) e `LEITOS_RESUMO_KEYS`.

`leitosVigenciaValidation.js`:
- `YYYYMM` regex `^[0-9]{6}$`; mês `01–12` exceto fim `999999` (permitir também início `000001` só na migração — na API rejeitar `000001` se quiser; na validação de API aceitar `01–12` + `999999` no fim)
- Overlap inclusivo: `aInicio <= bFim && bInicio <= aFim`
- Consistência: se algum valor detalhe > 0, somar por `grupo` e comparar com resumo (ausente = 0)
- Aceitar só chaves de resumo canônicas (após normalize)

- [ ] **Step 4: Run tests — expect PASS**

```powershell
cd e:\xampp\htdocs\simpa\simpa-backend; npx jest tests/leitosVigenciaValidation.test.js -v
```

- [ ] **Step 5: Commit** (só se o usuário pedir commit neste momento; senão pular)

```bash
git add simpa-backend/src/services/leitosCatalog.js simpa-backend/src/services/leitosVigenciaValidation.js simpa-backend/tests/leitosVigenciaValidation.test.js
git commit -m "$(cat <<'EOF'
feat(leitos): add catalog and vigencia validation helpers

EOF
)"
```

---

### Task 2: Migration 026 + docker-compose

**Files:**
- Create: `migration_026_leitos_vigencia.sql`
- Modify: `docker-compose.yml` (bloco `postgres` volumes — após `migration_025`)

**Interfaces:**
- Produces: tabela `enriquecimento_hospitalar_leitos_vigencia` + backfill

- [ ] **Step 1: Write migration SQL**

```sql
-- ============================================================================
-- SIMPA — Migration 026: leitos hospitalares por vigência
-- Depends on: enriquecimento_hospitalar / enriquecimento_misto (migration 005+)
-- Safe to re-run (IF NOT EXISTS / NOT EXISTS guards).
-- ============================================================================

CREATE TABLE IF NOT EXISTS enriquecimento_hospitalar_leitos_vigencia (
  id                  SERIAL PRIMARY KEY,
  estabelecimento_id  INT NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  vigencia_inicio     CHAR(6) NOT NULL,
  vigencia_fim        CHAR(6) NOT NULL,
  leitos              JSONB NOT NULL DEFAULT '{}'::jsonb,
  leitos_detalhe      JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_leitos_vigencia_ym CHECK (
    vigencia_inicio ~ '^[0-9]{6}$' AND vigencia_fim ~ '^[0-9]{6}$'
  ),
  CONSTRAINT chk_leitos_vigencia_ordem CHECK (vigencia_inicio <= vigencia_fim)
);

CREATE INDEX IF NOT EXISTS idx_leitos_vigencia_estab
  ON enriquecimento_hospitalar_leitos_vigencia (estabelecimento_id);

-- Backfill hospitalar (pula se já houver vigência para o estabelecimento)
INSERT INTO enriquecimento_hospitalar_leitos_vigencia
  (estabelecimento_id, vigencia_inicio, vigencia_fim, leitos, leitos_detalhe)
SELECT
  eh.estabelecimento_id,
  '000001',
  '999999',
  CASE
    WHEN eh.leitos ? 'uti' AND NOT (eh.leitos ? 'uti_adulto')
      THEN (eh.leitos - 'uti') || jsonb_build_object('uti_adulto', eh.leitos->'uti')
    ELSE COALESCE(eh.leitos, '{}'::jsonb)
  END,
  '{}'::jsonb
FROM enriquecimento_hospitalar eh
WHERE eh.leitos IS NOT NULL
  AND eh.leitos <> '{}'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM enriquecimento_hospitalar_leitos_vigencia v
    WHERE v.estabelecimento_id = eh.estabelecimento_id
  );

-- Backfill misto (mesmo padrão)
INSERT INTO enriquecimento_hospitalar_leitos_vigencia
  (estabelecimento_id, vigencia_inicio, vigencia_fim, leitos, leitos_detalhe)
SELECT
  em.estabelecimento_id,
  '000001',
  '999999',
  CASE
    WHEN em.leitos ? 'uti' AND NOT (em.leitos ? 'uti_adulto')
      THEN (em.leitos - 'uti') || jsonb_build_object('uti_adulto', em.leitos->'uti')
    ELSE COALESCE(em.leitos, '{}'::jsonb)
  END,
  '{}'::jsonb
FROM enriquecimento_misto em
WHERE em.leitos IS NOT NULL
  AND em.leitos <> '{}'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM enriquecimento_hospitalar_leitos_vigencia v
    WHERE v.estabelecimento_id = em.estabelecimento_id
  );
```

- [ ] **Step 2: Wire docker-compose**

Adicionar após a linha de `migration_025`:

```yaml
- ./migration_026_leitos_vigencia.sql:/docker-entrypoint-initdb.d/26-migration_026_leitos_vigencia.sql:ro
```

- [ ] **Step 3: Apply on running DB (dev)**

```powershell
Get-Content e:\xampp\htdocs\simpa\migration_026_leitos_vigencia.sql | docker exec -i simpa-postgres psql -U simpa -d simpa
```

(Ajustar nome do container/user/db se `.env` diferir — ver `docs/agent/docker-env.md`.)

Expected: `CREATE TABLE` / `INSERT 0 N` sem erro.

- [ ] **Step 4: Commit** (se pedido)

```bash
git add migration_026_leitos_vigencia.sql docker-compose.yml
git commit -m "$(cat <<'EOF'
feat(db): add leitos vigencia table and backfill

EOF
)"
```

---

### Task 3: Service CRUD + espelho

**Files:**
- Create: `simpa-backend/src/services/leitosVigenciaService.js`
- Create: `simpa-backend/tests/leitosVigenciaService.test.js`
- Modify: `simpa-backend/src/services/estabelecimentosService.js` (export helper de perfil do estabelecimento se necessário; ou query local no service novo)

**Interfaces:**
- Consumes: `validateVigenciaPayload`, `rangesOverlap`, `normalizeLeitosResumo`, `assertDetalheConsistente`, `query`/`pool` de `db.js`
- Produces:
  - `listLeitosVigencias(estabelecimentoId) → row[]`
  - `createLeitosVigencia(estabelecimentoId, body) → row`
  - `updateLeitosVigencia(estabelecimentoId, vigenciaId, body) → row`
  - `deleteLeitosVigencia(estabelecimentoId, vigenciaId) → { ok: true }`
  - `mirrorOpenVigenciaLeitos(estabelecimentoId, client?)` — atualiza `enriquecimento_hospitalar` e/ou `enriquecimento_misto` conforme perfil

Erro: throw `{ status: 400|404, message }` no padrão do projeto.

- [ ] **Step 1: Write failing service tests** (mock `db` como em `estabelecimentos.test.js`)

Casos mínimos:
1. `create` rejeita overlap com vigência existente
2. `create` rejeita detalhe inconsistente
3. `create` sucesso chama INSERT + mirror UPDATE em `enriquecimento_hospitalar.leitos` quando perfil Hospitalar
4. `delete` remove e espelha `{}` se não restar vigência aberta

- [ ] **Step 2: Run — expect FAIL**

```powershell
cd e:\xampp\htdocs\simpa\simpa-backend; npx jest tests/leitosVigenciaService.test.js -v
```

- [ ] **Step 3: Implement service**

Fluxo create/update:
1. Validar body
2. `SELECT` vigências existentes do estabelecimento; checar overlap (excluir self no update)
3. INSERT/UPDATE em transação
4. `mirrorOpenVigenciaLeitos`: `SELECT leitos FROM … WHERE vigencia_fim='999999' ORDER BY vigencia_inicio DESC LIMIT 1`; se perfil Hospitalar → upsert/`UPDATE enriquecimento_hospitalar.leitos`; se Misto → `enriquecimento_misto`; se ambos existirem (raro), atualizar a tabela do perfil atual do estabelecimento

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** (se pedido)

---

### Task 4: Rotas HTTP + testes de rota

**Files:**
- Modify: `simpa-backend/src/routes/cadastros.js`
- Modify: `simpa-backend/tests/estabelecimentos.routes.test.js` (ou create `leitosVigencia.routes.test.js`)

**Interfaces:**
- Consumes: funções do Task 3
- Produces rotas (JWT + `requirePlanningStaff` em mutações; GET autenticado como demais cadastros):

| Método | Path |
|--------|------|
| GET | `/estabelecimentos/:id/leitos-vigencias` |
| POST | `/estabelecimentos/:id/leitos-vigencias` |
| PUT | `/estabelecimentos/:id/leitos-vigencias/:vigenciaId` |
| DELETE | `/estabelecimentos/:id/leitos-vigencias/:vigenciaId` |

- [ ] **Step 1: Write route tests** (supertest/padrão existente) — 400 overlap, 201/200 create, 404 missing

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Wire routes** em `cadastros.js` (import service; audit log opcional `estabelecimento_leitos_vigencia_*`)

- [ ] **Step 4: Run — expect PASS**

```powershell
cd e:\xampp\htdocs\simpa\simpa-backend; npx jest tests/leitosVigencia.routes.test.js tests/estabelecimentos.routes.test.js -v
```

- [ ] **Step 5: Commit** (se pedido)

---

### Task 5: GET estabelecimento inclui leitos_vigencias (abordagem leve)

**Files:**
- Modify: `simpa-backend/src/services/estabelecimentosService.js`
- Modify: `simpa-backend/tests/estabelecimentos.test.js`

**Interfaces:**
- `getEstabelecimentoById` / map row: incluir `leitos_vigencias` array via subquery correlata em `DETAIL_SELECT` (uma única query; default `[]`)
- **NÃO** alterar validação/merge/PUT de enriquecimento (decisão leve — caminho legado intacto)

- [ ] **Step 1: Tests**

```js
it('upsertEnrichment hospitalar ignores leitos in body', async () => {
  // mock: current leitos clinico:10; PUT { leitos: { clinico: 99 }, notas: 'n' }
  // expect persisted leitos still 10 (or whatever mirror had), notas updated
});

it('getEstabelecimentoById includes leitos_vigencias', async () => {
  // mock SELECT vigencias → expect detail.leitos_vigencias length
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement strip + attach list**

No map de enrichment hospitalar/misto, após montar objeto, setar `leitos` do espelho (coluna pai) e `leitos_vigencias` da nova tabela.

- [ ] **Step 4: Run full estabelecimentos tests — PASS**

```powershell
cd e:\xampp\htdocs\simpa\simpa-backend; npx jest tests/estabelecimentos.test.js tests/leitosVigencia -v
```

- [ ] **Step 5: Commit** (se pedido)

---

### Task 6: Frontend — tipos, catálogo, API, LEITOS_KEYS

**Files:**
- Create: `simpa-frontend/src/utils/leitosCatalog.ts`
- Create: `simpa-frontend/src/utils/leitosCatalog.test.ts`
- Modify: `simpa-frontend/src/utils/enrichmentView.ts`
- Modify: `simpa-frontend/src/utils/enrichmentByPerfil.ts`
- Modify: `simpa-frontend/src/types/cadastros.ts`
- Modify: `simpa-frontend/src/api/cadastros.ts`
- Modify: `simpa-frontend/src/api/cadastros.test.ts`
- Modify: `simpa-frontend/src/components/cadastros/enrichment/enrichmentShared.tsx` (`LEITO_LABELS`)
- Modify: `simpa-frontend/src/components/cadastros/EnrichmentForm.tsx` (labels)

**Interfaces:**
- Types:

```ts
export interface LeitosVigencia {
  id: number;
  estabelecimento_id: number;
  vigencia_inicio: string; // YYYYMM
  vigencia_fim: string;
  leitos: Record<string, number>;
  leitos_detalhe: Record<string, number>;
  atualizado_em?: string;
}

export type LeitoKey =
  | 'clinico'
  | 'cirurgico'
  | 'obstetrico'
  | 'pediatrico'
  | 'uti_adulto'
  | 'uti_neonatal';
```

- API:

```ts
fetchLeitosVigencias(id: number): Promise<LeitosVigencia[]>
createLeitosVigencia(id: number, body: Omit<LeitosVigencia, 'id'|'estabelecimento_id'|'atualizado_em'>): Promise<LeitosVigencia>
updateLeitosVigencia(id: number, vigenciaId: number, body: …): Promise<LeitosVigencia>
deleteLeitosVigencia(id: number, vigenciaId: number): Promise<void>
```

- [ ] **Step 1: Vitest for catalog consistency + formatLeitosSummary legado `uti`**

```ts
import { describe, expect, it } from 'vitest';
import { assertDetalheConsistente, parseVigenciaUi } from './leitosCatalog';
import { formatLeitosSummary, LEITOS_KEYS } from './enrichmentView';

it('LEITOS_KEYS has uti_adulto and uti_neonatal, not uti', () => {
  expect(LEITOS_KEYS).toContain('uti_adulto');
  expect(LEITOS_KEYS).not.toContain('uti');
});

it('formatLeitosSummary maps legacy uti label', () => {
  expect(formatLeitosSummary({ uti: 3 })).toMatch(/uti_adulto: 3|UTI Adulto/i);
});
```

Atualizar `formatLeitosSummary` para renomear chave `uti` → exibir `uti_adulto`.

- [ ] **Step 2: Run — FAIL**

```powershell
cd e:\xampp\htdocs\simpa\simpa-frontend; npx vitest run src/utils/leitosCatalog.test.ts src/utils/enrichmentView.ts
```

(ajuste path do test de enrichmentView se criar `enrichmentView.test.ts`)

- [ ] **Step 3: Implement keys, catalog mirror, API client**

`parseVigenciaUi('10/2024','99/9999') → { inicio:'202410', fim:'999999' }`  
`formatVigenciaUi('202410','999999') → { inicio:'10/2024', fim:'99/9999' }`

Remover `leitos` dos payloads `hospitalFormValuesToPayload` / validação hospitalar **ou** deixar leitos fora do form de enrichment (Task 7 remove fields). Nesta task: atualizar `LEITOS_KEYS` + labels; forms que ainda usam leitos compilam com novas keys.

- [ ] **Step 4: Run affected Vitest — PASS**

- [ ] **Step 5: Commit** (se pedido)

---

### Task 7: UI — painel de vigências

**Files:**
- Create: `simpa-frontend/src/components/cadastros/leitos/LeitosVigenciasPanel.tsx`
- Create: `simpa-frontend/src/components/cadastros/leitos/LeitosVigenciaEditor.tsx`
- Create: `simpa-frontend/src/components/cadastros/leitos/LeitosVigenciasPanel.test.tsx`
- Modify: `EnrichmentHospitalarForm.tsx`, `EnrichmentMistoForm.tsx`
- Modify: `EnrichmentForm.tsx` — remover fieldset Leitos (especialidades/habilitações/notas permanecem)
- Modify: `enrichmentShared.tsx` — `LeitosFields` pode ser reutilizado só no editor de vigência
- Modify: `EstabelecimentoEnrichmentPanel.tsx` — passar `estabelecimentoId`; summary da vigência aberta

**Props painel:**

```tsx
interface LeitosVigenciasPanelProps {
  estabelecimentoId: number;
  initialVigencias?: LeitosVigencia[];
  readOnly?: boolean;
  onChanged?: () => void; // refresh detalhe estabelecimento
}
```

UI:
1. Tabela/lista: `MM/YYYY–MM/YYYY` + totais resumidos + Editar/Excluir
2. Botão “Nova vigência”
3. Editor: início/fim, `LeitosFields` (6 keys), fieldset Detalhamento (inputs do catálogo), erros de consistência/overlap, Salvar

- [ ] **Step 1: Component test** — render lista; submit inconsistente mostra erro e não chama API

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement panel + wire forms**

`EnrichmentHospitalarForm`: render `<LeitosVigenciasPanel … />` acima do form de especialidades/notas.  
`EnrichmentMistoForm`: idem (leitos saem do form misto; capacidades ambulatoriais ficam).

Garantir que `EstabelecimentoDetailDrawer` / page passa `id` do estabelecimento até o painel.

- [ ] **Step 4: Run Vitest cadastros enrichment + panel — PASS**

```powershell
cd e:\xampp\htdocs\simpa\simpa-frontend; npx vitest run src/components/cadastros
```

- [ ] **Step 5: Commit** (se pedido)

---

### Task 8: Docs agent + regressão

**Files:**
- Modify: `docs/agent/cadastros.md`
- Modify: `docs/agent/database.md`
- Modify: `docs/agent/backend-api.md` (tabela de endpoints)
- Optional touch: `docs/agent/frontend.md` se listar forms de enrichment

- [ ] **Step 1: Documentar** tabela, endpoints, regra UTI/detalhe/vigência, espelho legado

- [ ] **Step 2: Rodar suíte relevante**

```powershell
cd e:\xampp\htdocs\simpa\simpa-backend; npx jest tests/leitosVigencia tests/estabelecimentos -v
cd e:\xampp\htdocs\simpa\simpa-frontend; npx vitest run src/utils/leitosCatalog.test.ts src/components/cadastros
```

Expected: PASS

- [ ] **Step 3: Smoke manual** (checklist)
  1. Abrir estabelecimento Hospitalar
  2. Criar vigência `10/2024`–`99/9999` com resumo + detalhe da spec (deve salvar)
  3. Alterar detalhe UTI Adulto para divergir → bloqueia
  4. Criar segunda vigência sobreposta → 400
  5. Recarregar drawer → lista persiste; hint “Leitos atuais” reflete aberta

- [ ] **Step 4: Commit final** (se pedido) incluindo spec/plan se ainda não commitados

---

## Spec coverage checklist

| Requisito spec | Task |
|----------------|------|
| Split `uti_adulto` / `uti_neonatal` | 1, 6, 7 |
| Catálogo fixo CNES | 1, 6, 7 |
| Consistência obrigatória detalhe↔resumo | 1, 3, 7 |
| Pacote único por vigência | 2, 3, 7 |
| Tabela + backfill `uti`→`uti_adulto` | 2 |
| CRUD API | 3, 4 |
| PUT enrichment ignora leitos + espelho | 3, 5 |
| UI lista/editor + 99/9999 | 6, 7 |
| Docs | 8 |
| Painel por competência | Explicitamente fora |

## Self-review notes

- Sem placeholders TBD no plano
- Assinaturas de service alinhadas entre Tasks 3–5
- `LEITOS_KEYS` atualizado antes da UI (Task 6 → 7) para não quebrar compile intermediário
- Commits marcados como opcionais (só com pedido explícito do usuário)
