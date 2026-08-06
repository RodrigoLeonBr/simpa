# Manual — Editar widget do Painel

Guia campo a campo do drawer **Editar widget do painel** / **Novo widget** em  
`/cadastros/indicadores-painel`.

Público: Administrador e Planejamento. O formulário grava em `painel_widgets`; o Painel lê via `GET /painel-layout` e renderiza em `LayoutA` (grade de cards) ou `LayoutB` (Foco). O período selecionado no Painel (mês/trimestre/quadrimestre/ano) é resolvido no servidor conforme o campo **Agregação por período** de cada widget.

```mermaid
flowchart LR
  Cadastro["Cadastro Indicadores do Painel"] --> DB[(painel_widgets)]
  DB --> API["GET /painel-layout (competencia OU periodo)"]
  API --> LayoutA["Painel Layout A · cards"]
  API --> LayoutB["Painel Layout B · Foco (todos os widgets)"]
  Cat["painel_metricas_catalogo"] --> Cadastro
  Cat --> API
```

---

## Contexto do formulário (fora dos campos)

Antes de editar um widget, a página já define:

| Controle na página | Função | Impacto no Painel |
|--------------------|--------|-------------------|
| **Perfil** (APS / MAC / Hospitalar) | Filtra a lista e é gravado no widget | Só widgets do perfil selecionado no Painel aparecem quando o usuário escolhe esse perfil no seletor do Painel |
| **Layout** | Seletor `A` / `B` / `C` | `A` (grade de cards) e `B` (Foco) consomem estes widgets dinâmicos. `C` (Tabela) ainda não é dinâmico p/ Hospitalar |
| **Lista na página** | Mostra **ativos e inativos** do perfil/layout | Inativos ficam visíveis no cadastro com chip **Inativo**; no Painel só entram os **ativos** |
| **Ordem** | Coluna **Ordem** com botões **↑** / **↓** na tabela (ou ordem inicial na criação) | Define a sequência no Painel (ver diferença A × B em [Tipo](#tipo)) |
| **Reativar** | Botão na linha inativa | Volta `status=ativo`; o widget passa a aparecer no Painel na próxima carga do layout |

Inativar um widget (ação da tabela, não deste drawer) remove-o do layout resolvido até ser reativado.

---

## 1. Identificação e apresentação

### Slug

| | |
|--|--|
| **Obrigatório** | Sim |
| **O que é** | Identificador estável do widget (ex.: `atendimentos`, `sia_taxa_glosa`, `total_aih`) |
| **Função** | Chave lógica única junto com `(perfil, layout)`. Usado em API, testes e como `id` interno do KPI no frontend |
| **Impacto no Painel** | Não aparece na tela. Trocar o slug de um widget já em uso quebra referências estáveis (E2E, bookmarks internos). Prefira manter o slug e alterar só o título |
| **Boas práticas** | `snake_case`, sem acento, curto e único no perfil |

### Título

| | |
|--|--|
| **Obrigatório** | Sim |
| **O que é** | Nome exibido do indicador |
| **Função** | Texto principal do card / título do gráfico de tendência ou ranking |
| **Impacto no Painel** | Aparece no `KpiCard` (label) e nos cabeçalhos das seções de linha e ranking. É o que o gestor lê primeiro |

### Subtítulo

| | |
|--|--|
| **Obrigatório** | Não |
| **O que é** | Texto auxiliar sob o título (ex.: `Comp. Qualidade`, `Produção SIA · mês`, `dias/AIH`) |
| **Função** | Contextualiza unidade, recorte ou fonte sem alongar o título |
| **Impacto no Painel** | Exibido no card quando preenchido. Em gráficos, entra no payload resolvido; o Layout A usa sobretudo o título nas seções de tendência/ranking |
| **Vazio** | Gravado como `null` — sem linha auxiliar |

---

## 2. Tipo e formato (como o valor é mostrado)

### Tipo

Define **qual componente** o Painel usa para este widget.

| Valor | UI no Painel | Contrato da métrica / SQL |
|-------|--------------|---------------------------|
| **Card** | Card KPI na grade superior (até 6 em APS, até 9 em MAC/Hospitalar) | Valor escalar (`valor`) + opcional sparkline |
| **Linha** (`grafico_linha`) | Gráfico de tendência (área esquerda inferior) | Série temporal: linhas com `competencia` + `valor` |
| **Ranking** (`grafico_ranking`) | Lista com barras (área direita inferior) | Linhas com rótulo (`unidade` / `label`) + `valor` |
| **Barra** (`grafico_barra`) | Tratado como ranking no resolvedor atual | Mesmo formato de ranking |

**Impacto prático**

- Só entra na **grade de cards** quem for `tipo = card`.
- **Layout A (cards):** usa os cards (até 6 APS / 9 MAC-Hospitalar) + **apenas o primeiro** `grafico_linha` e **apenas o primeiro** ranking/barra. Widgets extras do mesmo tipo não aparecem.
- **Layout B (Foco):** exibe **todos** os widgets cadastrados — cards em grade auto-fit, **todas** as linhas full-width, **todos** os rankings/barras lado a lado (auto-fit). É o layout para "cadastrar quantos quiser e ver todos".

### Formato

Define **como formatar o número** (e, em um caso, a lógica especial de fração).

| Valor | Exibição típica | Observação importante |
|-------|-----------------|------------------------|
| **Número** | `1.234` (pt-BR) | Padrão para contagens |
| **Percentual** | multiplica por 100 e acrescenta `%` (1 casa) | O SQL deve devolver **fração 0–1** (ex.: `0,855` → `85,5%`). Se o SQL já devolver `85,5`, a tela mostrará `8550,0%` |
| **Moeda** | `R$ 1.234,56` | Valor monetário em BRL |
| **Texto** | `String(value)` sem formatação numérica | Pouco usado em KPIs |
| **Fração** | `numerador / denominador` | Numerador = métrica principal; denominador = métrica apontada em `fonte_config.par_chave` (config avançada, não há campo dedicado neste drawer). Sem `par_chave`, mostra `N / 0` |

**Impacto no Painel:** só muda a máscara do valor (`valueLabel`), não a consulta — exceto **Fração**, que dispara segunda métrica.

### Agregação por período

Define **como o widget colapsa um período multi-mês** (quando o gestor seleciona Trimestre / Quadrimestre / Ano no filtro do Painel). Grão **Mês** ignora este campo.

| Valor | Quando usar | Como o backend executa | Placeholders esperados no SQL |
|-------|-------------|------------------------|-------------------------------|
| **Último mês (snapshot)** (`ultimo_mes`, default) | Valores cumulativos / snapshot (leitos, cadastros ativos, cobertura) | 1 query no **mês final** do período | `:competencia` |
| **Soma (BETWEEN início/fim)** (`soma`) | Produção somável (SIA/SIH: valor aprovado, AIH, procedimentos) | 1 query no **intervalo** | `:competencia_inicio` / `:competencia_fim` (`BETWEEN`) |
| **Média mês a mês** (`media`) | Taxas / indicadores que não somam (ex.: % glosa) | roda o SQL **por mês** e tira a média (só cards) | `:competencia` (aplicado a cada mês) |

**Impacto no Painel:** com grão Mês, os três modos são equivalentes. Com trimestre/quadri/ano, o valor exibido segue o modo. O **delta** compara sempre o **período anterior equivalente** (trimestre vs trimestre anterior, ano vs ano anterior). `grafico_linha` ignora o modo — plota todos os meses do intervalo (use `BETWEEN` + `GROUP BY competencia`).

**Retrocompat:** widgets antigos assumem `ultimo_mes` (default da coluna) — comportamento idêntico ao anterior.

---

## 3. Métricas vinculadas

### Buscar no catálogo

| | |
|--|--|
| **Obrigatório** | Não (ajuda a filtrar) |
| **O que é** | Campo de busca com debounce (~300 ms) sobre `painel_metricas_catalogo` |
| **Função** | Filtra as opções dos selects de métrica por nome ou chave (`sia.taxa_glosa`, `sih.total_aih`, …) |
| **Impacto no Painel** | Nenhum direto — só facilita a escolha no cadastro |
| **Catálogo** | Atualizado pelo botão **Atualizar catálogo** na página (descoberta a partir do e-SUS raw) |

### Métrica principal

| | |
|--|--|
| **Obrigatório** | Sim |
| **O que é** | FK para `painel_metricas_catalogo` |
| **Função** | Define o `sql_template` padrão (ou o SQL customizado) que calcula o valor do widget |
| **Impacto no Painel** | É a fonte do número do card, da série da linha ou das barras do ranking. Sem métrica válida, o widget resolve vazio / `—` |
| **Placeholders no SQL** | `:competencia`, `:competencia_inicio`, `:competencia_fim`, `:estabelecimento_id`, `:equipe_id` — preenchidos no servidor (allowlist em `bindTemplate`). `:competencia_inicio`/`:competencia_fim` = primeiro/último mês do período (default = `:competencia` quando grão Mês). Ver [Agregação por período](#agregação-por-período) |

### Métrica sparkline (opcional)

| | |
|--|--|
| **Obrigatório** | Não (`Sem sparkline`) |
| **O que é** | Segunda métrica, tipicamente série histórica curta |
| **Função** | Alimenta o mini-gráfico (sparkline) dentro do **card** |
| **Impacto no Painel** | Só faz sentido com `tipo = card`. Em gráficos de linha/ranking, o valor principal já é a série; sparkline é secundário |
| **SQL esperado** | Lista de pontos (`valor` por competência ou ordem); o card usa o array `sparkSeries` |

---

## 4. SQL customizado

### SQL customizado — métrica principal

| | |
|--|--|
| **Obrigatório** | Não |
| **Controle** | Checkbox: desligado = usa `sql_template` do catálogo (somente leitura); ligado = edita `sql_override` do **widget** |
| **Função** | Sobrescreve o SQL só deste widget, sem alterar o catálogo compartilhado |
| **Impacto no Painel** | O runtime executa `sql_override` se preenchido; senão, o template da métrica. Outros widgets que usam a mesma métrica **não** mudam |
| **Restaurar catálogo** | Desliga o override e volta ao template da métrica |
| **Exemplos** | Painel lateral / “Inserir exemplo” — colam templates seguros com os placeholders oficiais |

### SQL customizado — sparkline

Igual ao bloco da principal, mas grava em `spark_sql_override` e só aparece se houver **Métrica sparkline** selecionada.

### Views disponíveis (e-SUS / SIGTAP)

Para métricas e-SUS, prefira as views em vez de repetir o join em cada template:

| View | O que expõe | Filtro típico |
|------|-------------|---------------|
| `v_esus_producao` | Join `esus_cargas ⋈ esus_indicadores_raw` — `competencia`, `estabelecimento_id`, `equipe_id`, `tipo_relatorio`, `secao`, `descricao`, JSONB `valores` | `WHERE competencia = :competencia::date AND tipo_relatorio = '…' AND secao = '…'` (ou `BETWEEN` para `soma`) |
| `v_esus_producao_sigtap` | Produção e-SUS já chaveada por código SIGTAP (JOIN com `procedimentos_esus_sigtap`, curado + descoberto); coluna `quantidade` tipada | `WHERE codigo_sigtap LIKE 'NNNN%'`. **Não** cobre consultas `0301` (consulta é SIA) |

Os filtros externos sofrem pushdown (mesmo plano das tabelas base). O grupo de exemplos **"Período (trimestre/quadri/ano)"** no aside já traz os padrões `BETWEEN` prontos para `soma`, linha e ranking.

---

## 5. Testar execução (não grava no Painel)

Estes controles **não são salvos** no widget; servem só para validar o SQL antes de publicar.

| Campo | Função | Relação com o Painel |
|-------|--------|----------------------|
| **Grão** + **Período** | Escopo temporal do teste: mês (`YYYY-MM`), trimestre (`YYYY-Tn`), quadrimestre (`YYYY-Qn`) ou ano (`YYYY`) | Espelha o filtro de período do Painel; envia `periodo` no scope do preview. Exercita `soma`/`media` conforme a Agregação por período do widget |
| **Estabelecimento** | Unidade ou “Municipal (todas)” | Equivale ao filtro de unidade do Painel (`estabelecimento_id` / `NULL` municipal) |
| **Executar teste** | Chama `POST` preview com o **rascunho atual da tela** (métricas, formato, SQL customizado ainda não salvos). Não envia só o `widgetId` do banco | Mostra `valueLabel`, tamanho da sparkline/série — **não** altera o Painel até **Salvar widget** |

---

## 6. Referência SQL (aside)

Material de apoio: exemplos por família (contrato, e-SUS, SIA, SIH…). Botões **→ Principal** / **→ Sparkline** ativam o SQL customizado e colam o exemplo. Não persistem sozinhos — é preciso salvar o formulário.

---

## 7. Ações do rodapé

| Botão | Efeito |
|-------|--------|
| **Cancelar** | Fecha sem gravar |
| **Salvar widget** | Cria ou atualiza `painel_widgets` (perfil da página + layout `A`). No próximo carregamento do Painel com aquele perfil, o Layout A reflete título, tipo, formato, métricas e SQL |

---

## Mapa rápido: campo → impacto

| Campo do drawer | Persiste? | O que muda no Painel |
|-----------------|-----------|----------------------|
| Slug | Sim | Identidade interna (não visual) |
| Título | Sim | Texto do card / título do gráfico |
| Subtítulo | Sim | Linha auxiliar do card |
| Tipo | Sim | Card vs linha vs ranking (e qual região da tela) |
| Formato | Sim | Máscara do número (e lógica de fração) |
| Métrica principal | Sim | Número / série / ranking |
| Métrica sparkline | Sim | Mini-série no card |
| **Agregação por período** | Sim | Como o card agrega trimestre/quadri/ano (`ultimo_mes`/`soma`/`media`) |
| SQL principal / spark | Sim (se customizado) | Consulta efetiva daquele widget |
| **Grão + Período** / **Estabelecimento** / **Executar teste** | Só preview no cadastro — usa o **rascunho da tela** (métricas + SQL customizado), sem precisar salvar primeiro |
| Perfil (página) | Sim, no registro | Em qual perfil o widget aparece |
| Ordem (↑/↓ na tabela) | Sim | Posição na grade / prioridade dos gráficos no Painel |
| Status ativo/inativo | Sim (Inativar / Reativar) | Só **ativos** entram no Painel |

---

## Campos avançados (não estão neste drawer)

Existem na tabela/API e podem ter sido definidos por seed/migration:

| Campo | Uso |
|-------|-----|
| `fonte_config` | Ex.: `fallback_chave`, `par_chave` (fração), eixos de ranking |
| `spark_config` | Opções extras da sparkline |
| `delta_config` | Variação vs competência anterior ou texto fixo no card |
| `sql_preview` | Espelho/documentação do SQL (legado); o override é a fonte real de customização |

Alterá-los hoje exige API/SQL ou evolução futura da UI.

---

## Checklist ao publicar um widget

1. Perfil correto (APS / MAC / Hospitalar) na página + **Layout** (A cards / B Foco).
2. **Tipo** alinhado ao papel desejado (card vs gráfico).
3. **Formato** coerente com o que o SQL devolve (especialmente percentual 0–1).
4. **Agregação por período** coerente com a natureza da métrica (`soma` para produção, `ultimo_mes` para snapshot, `media` para taxa) e SQL com os placeholders certos.
5. Métrica (e sparkline, se card) com SQL que respeita `:competencia` / `:competencia_inicio` / `:competencia_fim` / `:estabelecimento_id` / `:equipe_id`.
6. **Executar teste** variando o **grão** (mês e um trimestre/ano) e a unidade.
7. **Salvar** e abrir o Painel no mesmo perfil + Layout (A ou B Foco) para validar.

---

## Referências técnicas

- UI: `WidgetEditDrawer.tsx`, `WidgetPreviewModal.tsx`, `PeriodoSelect.tsx`, `indicadoresPainelView.ts`
- Runtime: `painelWidgetsService.js` → `resolvePainelLayout` / `previewWidget` / `resolveMetricValueForWidget`; `periodo.js`; `painelMetricsService.bindTemplate`
- Painel: `LayoutA.tsx`, `LayoutB.tsx` (Foco), `painelWidgetsView.ts`, `usePainelLayout.ts`, `useFilters.tsx` (`periodo`), `utils/periodo.ts`
- Views SQL: `v_esus_producao` (migration 028), `v_esus_producao_sigtap` (migration 029) — ver [database.md](database.md#views-painel--produção)
- Período/coluna: [database.md — Migration 031](database.md#migration-031-aplicada)
- Workflow agent: [cadastros.md — painel-widgets-dinamicos](cadastros.md#workflow-painel-widgets-dinamicos)
