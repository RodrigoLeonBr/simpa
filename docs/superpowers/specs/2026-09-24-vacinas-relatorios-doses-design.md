# Vacinas — Relatórios de Doses Aplicadas

**Data:** 2026-09-24
**Status:** Aprovado
**Escopo:** Relatórios operacionais de doses aplicadas na página `/vacinas`, lendo o fato `vacina_doses` diretamente. Sem tocar em cobertura, sem migration, sem ETL novo.

---

## Contexto e objetivo

SIMPA é o BI gerencial da Secretaria de Saúde de Americana/SP. O módulo de vacinas hoje tem apenas: importação NIES (`/importacao`) e **um** relatório — o heatmap de cobertura em `/vacinas`. Esse heatmap depende de configuração pesada (`vacina_grupos`, `vacina_faixa_grupo`, `vacina_populacao_alvo`, `vacina_esquema`) que não está montada no ambiente, então vem vazio.

A tabela fato `vacina_doses` já persiste dimensões ricas que **nenhum relatório expõe**:

| Coluna | Dimensão |
|--------|----------|
| `competencia` | Mês |
| `imuno_codigo` / `imuno_nome` | Vacina |
| `faixa_nies` | Faixa etária |
| `cnes_sala` / `sala_nome` | Unidade que aplicou |
| `sistema_origem` | Mecanismo de registro |
| `doses` | Métrica (contagem) |

**Objetivo:** expor esses cortes como relatórios operacionais. Alto valor imediato, zero dependência da config de cobertura.

---

## Requisitos

Do pedido do usuário:

1. Escolher o mês.
2. Visualizar por unidade que realizou o procedimento.
3. Visualizar por mecanismo de registro (`sistema_origem`).
4. Acumulado do ano por vacina.
5. Acumulado do ano por faixa etária.
6. Visões de interesse para secretário, coordenador de UBS e demais gestores.

Decisões de escopo (confirmadas com o usuário):

- **Somente relatórios de doses.** Não configurar/mexer em cobertura.
- **Personas = presets de filtro na mesma página**, não telas separadas.

---

## Arquitetura

### Backend

Novo serviço `simpa-backend/src/services/vacinaRelatorioService.js` — separa "doses cru" da lógica de cobertura (`vacinaService.js`). Duas funções puras/DB:

- `getResumoDoses({ ano, mes, cnesSala })`
- `getFiltros()`

Rotas em `routes/vacina.js` (JWT já aplicado em `app.js`; leitura não exige `requirePlanningStaff`):

**`GET /api/vacina/doses/resumo`**

| Param | Obrigatório | Regra |
|-------|-------------|-------|
| `ano` | sim | inteiro 2000–2100 |
| `mes` | não | 1–12; ausente = ano inteiro |
| `cnes_sala` | não | filtra a uma unidade |

Semântica de período:
- `total_doses_ano` = acumulado de janeiro até `mes` (inclusive). Sem `mes` → ano inteiro.
- `total_doses_mes` = doses só do `mes` selecionado. Sem `mes` → igual a `total_doses_ano`.
- `serie_mensal` = doses por competência, sempre os 12 meses do `ano` (meses sem dado retornam 0 no frontend).
- `por_vacina`, `por_faixa`, `por_unidade`, `por_sistema` = acumulado janeiro→`mes` (ou ano inteiro), respeitando `cnes_sala` quando informado.

Resposta:
```json
{
  "ano": 2026,
  "mes": 3,
  "total_doses_mes": 4210,
  "total_doses_ano": 13742,
  "serie_mensal": [{ "competencia": "2026-01", "doses": 5321 }],
  "por_vacina":  [{ "imuno_codigo": "...", "imuno_nome": "...", "doses": 1200 }],
  "por_faixa":   [{ "faixa_nies": "< 01 ano", "doses": 800 }],
  "por_unidade": [{ "cnes_sala": "4032128", "sala_nome": "UBS ...", "doses": 640 }],
  "por_sistema": [{ "sistema_origem": "e-SUS", "doses": 9800 }]
}
```

Implementação: várias queries `GROUP BY` sobre `vacina_doses` filtrando por intervalo de competência (`>= ano-01-01` e `<= ano-mes-01`), disparadas com `Promise.all`. Coerção de `doses` para `Number` (pg devolve string em `SUM`).

**`GET /api/vacina/doses/filtros`** → `{ anos: number[], salas: [{ cnes_sala, sala_nome }] }`

- `anos` = `SELECT DISTINCT EXTRACT(YEAR FROM competencia)` ordenado desc.
- `salas` = `SELECT DISTINCT cnes_sala, sala_nome ORDER BY sala_nome`.
- Endpoint separado para a lista de salas **não encolher** quando um filtro de unidade está ativo.

### Frontend

Página `/vacinas` (`simpa-frontend/src/pages/Vacinas/index.tsx`) ganha alternância de abas:

- **Cobertura** — componente atual (`CoberturaMatrix`), sem alteração.
- **Doses Aplicadas** — nova aba, novo componente.

Novo componente `DosesReport.tsx` (+ tipos em `types/vacina.ts`, client em `api/vacina.ts`):

- **Barra de filtros:** ano (select), mês (select com opção "Ano todo"), unidade (select, populada por `/doses/filtros`).
- **Presets (3 botões):** Secretário / Coordenador / Vigilância — apenas ajustam os filtros (ex.: Coordenador foca o seletor de unidade). Não escondem nem reordenam gráficos.
- **Visualizações (ECharts, já no stack):**
  - KPIs: total de doses no mês + acumulado do ano.
  - Linha: série mensal (evolução no ano).
  - Barras: doses por vacina (acumulado).
  - Barras: doses por faixa etária (acumulado).
  - Ranking (barras horizontais): doses por unidade.
  - Pizza: doses por mecanismo de registro (`sistema_origem`).
- **Export CSV:** por tabela, reusando `utils/csv.ts` `downloadCsv`.

Dados via novo `GET /api/vacina/doses/resumo`; filtros via `GET /api/vacina/doses/filtros`.

### Mapa persona → preset

| Persona | Preset (filtros) | Ênfase natural |
|---------|------------------|----------------|
| Secretário | Todas as unidades, ano todo | Série mensal, top vacinas, mix sistema origem |
| Coordenador UBS | Filtra a sua unidade | Doses da unidade, faixas atendidas, qualidade de registro |
| Vigilância / gestores | Todas as unidades | Faixa × vacina, acumulado, lacunas |

Presets só setam estado de filtro. Todos os gráficos ficam sempre visíveis.

---

## Testes

- **Jest** (`simpa-backend/tests/vacinaRelatorioService.test.js`): mocka `query`, valida montagem da resposta e coerção numérica / acumulação de período.
- **Vitest** (`DosesReport.test.tsx`): render da aba com dados mockados; confirma KPIs e presença dos gráficos/tabelas.

---

## Fora de escopo (YAGNI)

- Configuração ou correção de cobertura (heatmap continua como está).
- Migration / mudança de schema — todos os dados já existem em `vacina_doses`.
- ETL novo — nenhuma coluna nova.
- Widget de vacinas no Painel de gestão.
- Ênfase/reordenação de gráficos por persona (presets só setam filtros). Adicionar depois se pedido.
- Drill-down por CNES além do filtro de unidade já previsto.

---

## Referências

- Modelo de dados: [docs/agent/vacinas.md](../../agent/vacinas.md) · `migration_036_vacinas.sql`
- Cobertura (não alterada): `services/vacinaService.js`
- Padrão de rota/serviço: `routes/vacina.js`, `services/vacinaCadastroService.js`
