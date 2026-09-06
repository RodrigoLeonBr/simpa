# SIMPA — Importação NIES + Cobertura Vacinal por faixa/grupo

**Data:** 2026-09-06
**Branch alvo:** feature dedicada (ex: `feat/vacinas-cobertura`)
**Status:** design aprovado (brainstorming), pronto para plano de implementação
**Módulo novo:** `vacinas`

---

## 1. Objetivo

Importar os relatórios mensais de **doses aplicadas** do portal NIES
(https://nies.saude.sp.gov.br/ses/vacinas-doses-aplicadas), armazenar as doses
de forma versionada por competência, e calcular a **cobertura vacinal do
município (Americana/SP) por faixa etária / grupo, para cada vacina**.

A cobertura usa uma população-alvo digitada por ano e um esquema de doses
cadastrado por vacina × grupo. Inicialmente só o ano **2026**, mas o modelo
aceita múltiplos anos.

### Fórmula de cobertura

```
                        Σ doses (faixas do grupo, competências do ano até o mês filtro)
cobertura(vacina, grupo, ano) = ─────────────────────────────────────────────────────────────
                        populacao_alvo(grupo, ano) × num_doses_esquema(vacina, grupo)
```

- O **ano** é derivado da competência.
- A cobertura é **acumulada no ano** (soma de janeiro até o mês do filtro), que é
  o padrão de leitura de cobertura vacinal.
- Vacina sem linha em `vacina_esquema` para um grupo = **não é alvo** naquele
  grupo e não entra na matriz.
- `populacao_alvo = 0` (ou ausente) → cobertura `null` (não calcula, não quebra).

---

## 2. Fonte de dados (NIES)

Download manual, um xlsx por mês. Estrutura confirmada dos arquivos de
jan/fev/mar 2026 (idêntica entre eles):

- Aba única: `Export`, 9 colunas.
- Colunas: `DRS`, `GVE`, `RS`, `Município`, `Sala de Vacina`, `Imunibiológico`,
  `Total doses aplicadas`, `Idade`, `Sistema Origem`.
- Grão: 1 linha = soma de doses por (sala × imunobiológico × faixa etária ×
  sistema origem). Já pré-agregado.
- `Sala de Vacina` e `Imunibiológico` vêm no formato `código - nome`.
- `Total doses aplicadas` é float.
- `Idade` tem 20 faixas fixas (ex: `05 a 11 anos`, `12 a 17 anos`, …).
- `Sistema Origem`: VACIVIDA, NOVO PNI, SISTEMA IMUNEWEB, PRONTUÁRIO ELETRÔNICO
  DO CIDADÃO / E-SUS APS, ESUS APS - NACIONAL (OFFLINE).

**Armadilhas conhecidas:**

1. **Duas linhas de rodapé** no fim de cada arquivo: uma totalmente vazia e uma
   com metadados de filtro no campo `DRS`
   (`"Filtros aplicados:\nNM_MUNICIPIO … AMERICANA\nAno … 2026\nMês … janeiro"`).
   Descartar por `Total doses aplicadas` nulo.
2. **Encoding**: acentos aparecem como mojibake latin-1↔utf-8 no console. Garantir
   leitura/gravação em UTF-8 no PG (mesma classe dos fixes `migration_*_utf8`).
3. **Competência** não é uma coluna: extrair da linha "Filtros aplicados"
   (`Mês → <mes>`, `Ano → <ano>`) com fallback para o nome do arquivo
   (`vacina_jan_2026.xlsx`) e confirmação no preview.

---

## 3. Modelo de dados — `migration_036_vacinas.sql`

Próxima migration livre é a **036** (última aplicada: 035). Padrão idempotente
(`IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS`), com cabeçalho de apply manual
e Docker igual às migrations existentes. Registrar em `docker-compose.yml`,
`scripts/apply-migrations.*` e `docs/agent/database.md`.

| Tabela | Chave | Campos |
|--------|-------|--------|
| `vacina_cargas` | `id BIGSERIAL` | `competencia DATE` (1º dia do mês), `arquivo_nome`, `linhas INT`, `doses_total INT`, `importado_por`, `importado_em TIMESTAMP DEFAULT now()`, `status`. Versiona cada upload. |
| `vacina_doses` | `id BIGSERIAL` | `carga_id BIGINT FK → vacina_cargas ON DELETE CASCADE`, `competencia DATE`, `cnes_sala TEXT`, `sala_nome TEXT`, `imuno_codigo TEXT`, `imuno_nome TEXT`, `faixa_nies TEXT`, `sistema_origem TEXT`, `doses INT`. UNIQUE(`carga_id`, `cnes_sala`, `imuno_codigo`, `faixa_nies`, `sistema_origem`). |
| `vacina_imunobiologicos` | `imuno_codigo TEXT PK` | `imuno_nome TEXT`. Upsert no import → alimenta dropdowns de esquema. |
| `vacina_grupos` | `id BIGSERIAL` | `nome TEXT`, `slug TEXT UNIQUE`, `ordem INT`, `ativo BOOLEAN`. Grupos etários customizados, independem de ano. |
| `vacina_faixa_grupo` | `faixa_nies TEXT PK` | `grupo_id BIGINT FK → vacina_grupos`. De-para faixa NIES → grupo. 20 linhas (uma por faixa). |
| `vacina_populacao_alvo` | (`ano INT`, `grupo_id`) UNIQUE | `id BIGSERIAL`, `ano INT`, `grupo_id BIGINT FK`, `populacao INT`. Digitado por ano. |
| `vacina_esquema` | (`imuno_codigo`, `grupo_id`) UNIQUE | `id BIGSERIAL`, `imuno_codigo TEXT`, `grupo_id BIGINT FK`, `num_doses INT CHECK > 0`. Define alvos + multiplicador do esquema. |

Índices: `idx_vacina_doses_competencia (competencia, imuno_codigo)`,
`idx_vacina_doses_carga (carga_id)`, `idx_vacina_doses_faixa (faixa_nies)`.

### Cobertura

Calculada em `vacinaService.js` (SQL agregado) ou view `vw_vacina_cobertura`.
Assinatura de consulta: `(ano, competencia_ate, grupo_id?, imuno_codigo?)`.
Junta `vacina_doses` → `vacina_faixa_grupo` (faixa→grupo) → agrega doses por
(imuno, grupo) no intervalo `[ano-01, competencia_ate]`, junta
`vacina_populacao_alvo(ano, grupo)` e `vacina_esquema(imuno, grupo)`, produz
`doses`, `pop_alvo`, `num_doses`, `denominador`, `cobertura_pct`.

---

## 4. Importação

### 4.1 Parser Python — `parse_vacina_xlsx.py` (raiz)

Segue o padrão de `parse_esus_csv.py` / `etl_contract.py`.

- Lê aba `Export` (pandas + openpyxl).
- `dropna(subset=['Total doses aplicadas'])` → descarta as 2 linhas de rodapé.
- Split `código - nome` em `cnes_sala`/`sala_nome` e `imuno_codigo`/`imuno_nome`.
- `doses = int(round(Total doses aplicadas))`.
- `faixa_nies` = coluna `Idade`.
- Ignora linhas com município ≠ `AMERICANA`.
- Extrai competência da linha "Filtros aplicados"; fallback nome do arquivo.
- Saída: JSON em stdout — `{ competencia, doses_total, linhas: [ {cnes_sala,
  sala_nome, imuno_codigo, imuno_nome, faixa_nies, sistema_origem, doses} ] }`.
- Erros estruturados (aba ausente, colunas faltando) via contrato existente.

### 4.2 Backend — `routes/vacina.js` + `vacinaImportService.js`

Montado em `/api/vacina` sob `verifyJWT`; mutações sob `requirePlanningStaff`
com auditoria (padrão existente).

| Método | Rota | Ação |
|--------|------|------|
| POST | `/api/vacina/importacao/preview` | Upload xlsx → parser → devolve competência detectada, nº linhas, doses total, imunos novos e **faixas sem grupo mapeado** (alerta). Não grava. |
| POST | `/api/vacina/importacao` | Confirma: cria `vacina_cargas`, insere `vacina_doses`, upsert `vacina_imunobiologicos`. Re-import da **mesma competência substitui** a carga anterior (delete cascade + insert) para evitar dupla contagem. |
| GET | `/api/vacina/cargas` | Histórico de cargas. |
| GET | `/api/vacina/cobertura` | Matriz de cobertura (ver §3). |

### 4.3 Frontend — `VacinaImportSection.tsx` em `/importacao`

Padrão `SihImportSection.tsx`: dropzone → chama preview → mostra competência,
doses total, imunos novos, banner de faixas não mapeadas → botão confirmar →
POST import. Badge de status opcional em Cadastros.

---

## 5. UI de cobertura + cadastros

### 5.1 Página `/vacinas` — `VacinasPage.tsx`

Nova rota em `App.tsx` + item em `config/navigation.ts`.

- **Filtros**: ano (2026), competência/mês (acumulado até o mês), grupo
  (opcional), vacina (opcional).
- **Matriz vacina × grupo** com % de cobertura em heatmap
  (vermelho < 50%, amarelo 50–80%, verde ≥ 95% — limiares ajustáveis em
  constante). Hover mostra doses / denominador.
- Colunas por célula/linha: doses aplicadas, pop alvo, esquema (nº doses),
  denominador, % cobertura.
- Vacina sem esquema no grupo → oculta (não-alvo). Faixas NIES sem grupo →
  banner "N faixas não mapeadas".
- Export CSV client-side (reusa `utils/csv.ts` → `downloadCsv`).

### 5.2 Cadastros sob `/cadastros`

Reusa `CadastroCrudPage` + `cadastroEntities` onde couber.

| Rota | Conteúdo | Padrão |
|------|----------|--------|
| `/cadastros/vacina-grupos` | grupos etários (nome, ordem, ativo) | registry genérico (`useEntityCrud`) |
| `/cadastros/vacina-faixa-grupo` | de-para faixa NIES→grupo (20 linhas, edita grupo) | CRUD editar-só |
| `/cadastros/vacina-populacao` | pop alvo por ano × grupo | CRUD com filtro de ano |
| `/cadastros/vacina-esquema` | nº doses por vacina × grupo | CRUD com dropdowns (vacina, grupo) |

Pop alvo e esquema têm chave composta → `vacinaCadastroService.js` dedicado
(como `estabelecimentosService`), não o registry genérico puro para as mutações
de identidade. Grupos = registry genérico. Mutações `requirePlanningStaff` +
auditoria.

---

## 6. Testes (obrigatórios na task)

- **pytest** `test_parse_vacina.py`: descarte das 2 linhas de rodapé, split
  código-nome, doses→int, extração de competência, faixa não-AMERICANA
  ignorada, acentos preservados (UTF-8).
- **Jest** backend: cálculo de cobertura `doses/(pop×esquema)`; acumulado no
  ano; re-import substitui carga (sem dupla contagem); vacina sem esquema =
  excluída; `pop = 0` → cobertura `null` sem crash.
- **Vitest** frontend: render da matriz; faixas não mapeadas → banner; faixas de
  cor do heatmap.
- **E2E** opcional `vacinas-cobertura.spec.ts`: upload seed → cadastra
  grupo/pop/esquema → matriz mostra %.

---

## 7. Escopo v1 (YAGNI — fora)

- Apenas 2026 (modelo aceita N anos; UI só filtra ano).
- Sem esquema por sequência de dose (NIES não traz ordem da dose; o multiplicador
  `num_doses` resolve).
- Sem cobertura por unidade/CNES na matriz v1 (o dado existe em `vacina_doses`;
  drill-down fica para depois).
- Sem widget no Painel (só página `/vacinas`).
- Sem sync automático do NIES (portal é download manual).

---

## 8. Entregáveis

- `migration_036_vacinas.sql` (+ registro em compose / apply-migrations / docs).
- `parse_vacina_xlsx.py`.
- Backend: `routes/vacina.js`, `vacinaImportService.js`, `vacinaService.js`,
  `vacinaCadastroService.js`; montagem em `routes/api.js`.
- Frontend: `VacinaImportSection.tsx`, `VacinasPage.tsx`, 4 cadastros, entradas
  em `App.tsx` e `config/navigation.ts`, tipos em `types/`.
- Docs: `docs/agent/` (novo `vacinas.md` ou seção em cadastros/backend-api) +
  atualização de `CLAUDE.md`.

---

*Design gerado via brainstorming assistido. Próximo passo: writing-plans.*
