# Vacinas — Cobertura Vacinal (NIES)

Módulo de importação e análise de cobertura vacinal do município de Americana/SP. Fonte: portal **NIES** (Núcleo de Informações Epidemiológicas) da SES-SP.

---

## Fonte de dados

Portal: [https://nies.saude.sp.gov.br/ses/vacinas-doses-aplicadas](https://nies.saude.sp.gov.br/ses/vacinas-doses-aplicadas)

- Download **manual e mensal** do xlsx pela aba **Export** do portal.
- O arquivo tem **9 colunas**: DRS, GVE, RS, Municipio, Sala de Vacina, Imunobiologico, Total doses aplicadas, Idade, Sistema Origem.
- As duas últimas linhas são rodapé (linha vazia + linha "Filtros aplicados: ...") e são descartadas automaticamente pelo parser.
- Somente as linhas cujo campo `Municipio == "AMERICANA"` (case-insensitive) são retidas.
- A competência (mês/ano) é extraída do texto de rodapé (`Filtros aplicados: Ano=2026, Mês=Janeiro`) ou, como fallback, do nome do arquivo (`vacina_jan_2026.xlsx`).

---

## Fluxo de importação

```
Usuário faz upload em /importacao (VacinaImportSection)
   ↓
POST /api/vacina/importacao/preview           → parseUpload() → analisarPreview()
   exibe: competência detectada, total de doses, faixas não mapeadas
   ↓
POST /api/vacina/importacao                   → parseUpload() → gravarCarga()
   transação PG: DELETE vacina_cargas (competencia) CASCADE → INSERT cargas + doses + imunobiologicos
   ↓
Re-import da mesma competência substitui a carga anterior (idempotente)
```

**Sem upload em batch:** um arquivo por competência. O parser suporta múltiplas salas (`cnes_sala`) dentro do mesmo arquivo.

---

## Modelo de dados — Migration 036

`migration_036_vacinas.sql` — idempotente (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`).

### Tabelas

| Tabela | Grão / função |
|--------|---------------|
| `vacina_cargas` | Uma linha por competência importada; `UNIQUE (competencia)`; CASCADE para `vacina_doses` |
| `vacina_doses` | Fato de doses aplicadas: `carga_id × cnes_sala × imuno_codigo × faixa_nies × sistema_origem` |
| `vacina_imunobiologicos` | Catálogo de imunobiológicos (`imuno_codigo PK`, `imuno_nome`); populado automaticamente no import |
| `vacina_grupos` | Grupos populacionais (ex: Crianças < 1 ano, Adolescentes, Gestantes) gerenciados via cadastro |
| `vacina_faixa_grupo` | De-para `faixa_nies → grupo_id`; faixas sem grupo = `NULL` (não contribuem para cobertura) |
| `vacina_populacao_alvo` | Meta populacional por `(ano, grupo_id)` — denominador da cobertura |
| `vacina_esquema` | Nº de doses do esquema por `(imuno_codigo, grupo_id)`; ausência de linha = vacina não-alvo no grupo |

### Schema relevante

```sql
-- Fato principal
vacina_doses(id, carga_id FK→vacina_cargas, competencia DATE, cnes_sala, sala_nome,
             imuno_codigo, imuno_nome, faixa_nies, sistema_origem, doses INT)
UNIQUE (carga_id, cnes_sala, imuno_codigo, faixa_nies, sistema_origem)

-- Cadastros de apoio
vacina_grupos(id, nome, slug UNIQUE, ordem, ativo)
vacina_faixa_grupo(faixa_nies PK, grupo_id FK→vacina_grupos ON DELETE SET NULL)
vacina_populacao_alvo(id, ano INT, grupo_id FK, populacao INT)  UNIQUE (ano, grupo_id)
vacina_esquema(id, imuno_codigo, grupo_id FK, num_doses INT > 0) UNIQUE (imuno_codigo, grupo_id)
```

---

## Fórmula de cobertura

```
cobertura(vacina, grupo, ano) =
    Σ doses(faixas do grupo, competencia jan→mês-alvo)
    ─────────────────────────────────────────────────
    populacao_alvo(grupo, ano) × num_doses_esquema(vacina, grupo)
```

- **Acumulada no ano:** soma as doses de janeiro até `competencia` (inclusive).
- **Vacina não-alvo:** se não existe linha em `vacina_esquema` para o par (vacina, grupo), essa combinação não aparece no resultado.
- **Pop = 0 ou denominador = 0:** `cobertura_pct = null`.
- **Faixa não mapeada:** faixas com `grupo_id IS NULL` em `vacina_faixa_grupo` não contribuem para o numerador de nenhum grupo.

Implementação: `vacinaService.js` → `getCobertura` (query SQL + `computeCobertura` puro).

---

## Endpoints `/api/vacina/*`

Todos exigem JWT (`verifyJWT` aplicado no nível `app.js`). Mutações exigem `requirePlanningStaff`.

Router montado em `routes/api.js` como `/vacina`.

### Importação

| Método | Path | Auth | Notas |
|--------|------|------|-------|
| POST | `/api/vacina/importacao/preview` | JWT + planning | multer `arquivo`; retorna `{ competencia, doses_total, linhas, faixas_nao_mapeadas }` |
| POST | `/api/vacina/importacao` | JWT + planning | Grava carga; body opcional `competencia=YYYY-MM` para sobrescrever o detectado |
| GET | `/api/vacina/cargas` | JWT | Histórico de cargas ordenado por competência DESC |

### Cobertura

| Método | Path | Auth | Query params |
|--------|------|------|--------------|
| GET | `/api/vacina/cobertura` | JWT | `ano` (obrigatório), `competencia` (YYYY-MM, default = dez do ano), `grupo_id`, `imuno_codigo` |

Resposta: array `{ imuno_codigo, imuno_nome, grupo_id, grupo_nome, doses, pop_alvo, num_doses, denominador, cobertura_pct }`. `cobertura_pct` em percentual (0–100+); `null` quando denominador=0.

### Cadastros

| Método | Path | Auth | Notas |
|--------|------|------|-------|
| GET | `/api/vacina/imunobiologicos` | JWT | Lista catálogo populado no import |
| GET | `/api/vacina/grupos` | JWT | Lista grupos ordenados por `ordem, nome` |
| POST | `/api/vacina/grupos` | JWT + planning | Body `{ nome, slug, ordem? }` |
| PUT | `/api/vacina/grupos/:id` | JWT + planning | Patch parcial (COALESCE) |
| GET | `/api/vacina/faixa-grupo` | JWT | Lista todas as faixas com `grupo_id` e `grupo_nome` |
| PUT | `/api/vacina/faixa-grupo/:faixa` | JWT + planning | Body `{ grupo_id }` (null para desassociar) |
| GET | `/api/vacina/populacao` | JWT | Query `?ano=YYYY` (opcional) |
| POST | `/api/vacina/populacao` | JWT + planning | Body `{ ano, grupo_id, populacao }` — upsert |
| GET | `/api/vacina/esquema` | JWT | Lista esquemas com nome do imuno e do grupo |
| POST | `/api/vacina/esquema` | JWT + planning | Body `{ imuno_codigo, grupo_id, num_doses }` — upsert |
| DELETE | `/api/vacina/esquema/:id` | JWT + planning | Remove esquema (vacina passa a ser não-alvo no grupo) |

---

## Frontend

### Página `/vacinas`

`simpa-frontend/src/pages/Vacinas/index.tsx`

- **Filtros:** ano (select), mês (acumulado até este mês ou ano completo).
- **Matriz heatmap (`CoberturaMatrix.tsx`):** linhas = imunobiológico, colunas = grupo, célula = `cobertura_pct` com fundo colorido (verde ≥ 95%, amarelo 80–94%, vermelho < 80%, cinza = não-alvo).
- **Export CSV:** botão que baixa a matriz corrente via `downloadCsv` (`utils/csv.ts`).
- Dados via `GET /api/vacina/cobertura`.

### Importação (`/importacao`)

Seção `VacinaImportSection.tsx` integrada à página de Importação (após SIH). Exibe preview de faixas não mapeadas antes de confirmar.

### Cadastros (`/cadastros/vacina-*`)

Quatro páginas de cadastro montadas em `CadastroCrudPage` via `cadastroEntities`:

| Rota | Página | Entidade |
|------|--------|----------|
| `/cadastros/vacina-grupos` | `VacinaGruposPage.tsx` | Grupos populacionais |
| `/cadastros/vacina-faixa-grupo` | `VacinaFaixaGrupoPage.tsx` | De-para faixa → grupo |
| `/cadastros/vacina-populacao` | `VacinaPopulacaoPage.tsx` | Metas populacionais por ano/grupo |
| `/cadastros/vacina-esquema` | `VacinaEsquemaPage.tsx` | Esquema de doses por vacina/grupo |

---

## Serviços backend

| Arquivo | Função |
|---------|--------|
| `services/vacinaImportService.js` | `parseUpload` (spawn `parse_vacina_xlsx.py`), `gravarCarga` (transação PG), `analisarPreview` (faixas não mapeadas) |
| `services/vacinaService.js` | `getCobertura` (query acumulada), `computeCobertura` (cálculo puro — testável sem DB) |
| `services/vacinaCadastroService.js` | CRUD `grupos`, `faixa_grupo`, `populacao_alvo`, `esquema`, `imunobiologicos` |
| `routes/vacina.js` | Router Express; validação inline; multer `dest=os.tmpdir()` |

ETL Python: `parse_vacina_xlsx.py` (raiz). Invocado pelo `vacinaImportService.js` via `spawn`. Lê aba `Export`, descarta rodapé, filtra Americana, extrai competência do rodapé ou nome de arquivo. Testes unitários: `test_parse_vacina.py`.

---

## Escopo v1 e limitações

- **Apenas 2026:** só há dados NIES a partir de 2026 para Americana. Sem restrição técnica de ano no código.
- **Sem drill-down por CNES:** a matriz exibe o município inteiro (soma de todas as salas).
- **Sem widget no Painel:** cobertura vacinal não aparece no Painel de gestão (escopo futuro).
- **Sem sync automático:** download manual mensal via NIES (portal não tem API pública).
- **Faixas não mapeadas:** visíveis no preview do import; não afetam os cálculos dos grupos já configurados.

---

## Referências cruzadas

- Migration: `migration_036_vacinas.sql` (raiz)
- ETL Python: `parse_vacina_xlsx.py` (raiz) — ver [etl-python.md](etl-python.md)
- Modelo de dados completo: [database.md](database.md#migration-036-vacinas)
- Endpoints: [backend-api.md](backend-api.md#vacinas)
- Tipos frontend: `simpa-frontend/src/types/vacina.ts`, `simpa-frontend/src/api/vacina.ts`
