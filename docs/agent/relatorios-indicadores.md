# Relatórios (`/relatorios`) e Indicadores (`/indicadores`) — Operação

Doc operacional: **onde cadastrar**, **de onde vêm os valores hoje** e **quais comandos rodar para atualizar** as telas `/relatorios` e `/indicadores`.

Catálogo normativo detalhado dos 13 indicadores (fórmulas, seções e-SUS, gaps): **[indicadores-qualidade.md](indicadores-qualidade.md)**. Este doc é o resumo prático.

---

## 1) O que cada tela mostra

| Tela | Componente | Consome | Foco |
|------|-----------|---------|------|
| `/indicadores` | `IndicadoresPage` | `data.indicadores_qualidade[]` | Catálogo + detalhe (num/den/exec/meta/status), série histórica, comparação entre unidades |
| `/relatorios` | `RelatoriosPage` | `data.indicadores_qualidade[]` + `unidades` | Benchmarking: ranking de unidades, mapa (placeholder), síntese municipal |
| `/metas` | `MetasPage` | `data.indicadores_qualidade[]` | Barra meta vs. executado + status por indicador |

**As três telas leem o MESMO array `indicadores_qualidade`.** Diferem só na visualização. Logo: melhorar num/den/exec/meta no ETL atualiza as três de uma vez.

---

## 2) De onde vêm os valores HOJE

### Cadeia de dados

```
CSV e-SUS ─► esus_cargas / esus_indicadores_raw ─┐
cadastro individual ─► populacao_cadastrada ─────┤
metas cadastradas ─► metas_financiamento ────────┤
                                                  ▼
                    consolidate_dashboard.py + etl_contract.build_payload()
                                                  ▼
                    dados_consolidados.dados_conteudo->'indicadores_qualidade' (JSONB)
                                                  ▼
                    GET /api/v1/dashboard?competencia=YYYY-MM  (dashboardService.js)
                                                  ▼
                    useDashboard({ forceConsolidated: true }) ─► as 3 telas
```

**A API não calcula nada em runtime** — só devolve o JSON pré-consolidado de `dados_consolidados`. Todo valor é gravado pelo ETL. Para mudar o que aparece, muda-se o ETL e **reconsolida** (§4).

### Estado por campo (2026-08-16)

| Campo | Origem | Preenchido? |
|-------|--------|-------------|
| `exec` (C1, B1, B2, B3, B5, B6) | razão de produção do e-SUS — `etl_contract._producao_ratios()` | ✅ automático quando há carga |
| `exec` (B4, M1, M2, IGM-*) | — | ❌ null (sem numerador; ver [indicadores-qualidade.md](indicadores-qualidade.md)) |
| `num` / `den` | mesma razão de produção; `den` populacional p/ IGM/C1 quando sem raw | ✅ / parcial |
| `meta` | `metas_financiamento` → `fetch_metas()` | ✅ defaults 2026 (placeholder, migration 035) |
| `porUnidade` / `historico` | **não preenchidos pelo ETL** | ❌ → UI usa **fallback sintético** |

> ⚠️ **Ranking de `/relatorios` e série histórica de `/indicadores` são SINTÉTICOS.** `buildBenchmarkRows`/`buildUnitComparison`/`buildHistoricoSeries` distribuem valores fictícios quando `indicador.porUnidade`/`historico` estão ausentes. O ETL consolida um agregado por grupo (estabelecimento/equipe) e não emite esses arrays. Números por unidade no ranking **não são reais** até preencher `porUnidade` no payload.

---

## 3) Onde CADASTRAR

Só há dois cadastros que alimentam essas telas. O resto é **derivado** do e-SUS importado (não editável manualmente — importar/reconsolidar).

### a) Catálogo de indicadores — tabela `indicadores`

Os 13 códigos. Seedados por `migration_034_seed_indicadores_catalog.sql`. Só mexer se criar/renomear indicador (raro). Nome/categoria de exibição vêm de `INDICADORES_QUALIDADE_CATALOG` em `etl_contract.py` — **manter os dois em sincronia**.

### b) Metas — tabela `metas_financiamento`

Fonte do campo `meta`. Valor em **proporção 0–1** (`0.50` = 50%). Municipal = `unidade_id`/`equipe_id`/`estabelecimento_id` NULL. `origem` obrigatória (CHECK): `Componente Qualidade APS` | `IGM SUS Paulista` | `Emenda Parlamentar` | `Meta Local`.

**Defaults 2026** já inseridos (placeholder ~80% financiamento) por `migration_035_seed_metas_default_2026.sql`.

Editar uma meta:

```sql
UPDATE metas_financiamento m SET valor_meta = 0.55
FROM indicadores i
WHERE m.indicador_id = i.id AND i.codigo = 'C1'
  AND m.competencia >= DATE '2026-01-01';
```

Inserir meta nova (competência/indicador ainda sem registro):

```sql
INSERT INTO metas_financiamento (indicador_id, competencia, valor_meta, origem)
SELECT id, DATE '2026-08-01', 0.60, 'Componente Qualidade APS'
FROM indicadores WHERE codigo = 'C1';
```

`fetch_metas()` resolve por `(cod, competência[, estab, equipe])`, **específico > municipal**, match **exato de competência** (meta por mês).

### c) O que NÃO se cadastra (derivado do e-SUS)

`exec`, `num`, `den` das razões de produção. Para mudar: importar mais cargas e-SUS (`/importacao`) ou ajustar as fórmulas em `etl_contract._INDICADOR_PRODUCAO` / `_PREVENTIVOS_ODONTO_DESCS` etc. Depois **reconsolidar**.

---

## 4) Comandos para ATUALIZAR

Toda mudança de dado exige **reconsolidar** (regravar o JSON). A API/telas não recalculam sozinhas.

| Mudei… | Comando |
|--------|---------|
| Metas (`metas_financiamento`) | `python consolidate_dashboard.py --all --pg-write` |
| Fórmula/descrição no `etl_contract.py` | idem |
| Importei nova carga e-SUS | idem (ou por grupo, abaixo) |
| Um grupo só (rápido) | `python consolidate_dashboard.py --estabelecimento-id <id> --equipe-id <id> --pg-write` |
| Uma competência só | `python consolidate_dashboard.py --competencia 2026-01 --pg-write` |

Após rodar: recarregar a tela (a API já lê o JSON novo). Sem restart de backend.

> `--all` percorre todos os grupos com carga e-SUS em todas as competências. Seguro re-rodar (UPSERT em `dados_consolidados`).

### Verificar o que foi gravado

```sql
SELECT elem->>'cod' cod,
       ROUND(AVG(NULLIF(elem->>'exec','')::numeric),4) avg_exec,
       MAX(NULLIF(elem->>'meta','')::numeric) meta
FROM dados_consolidados dc,
     jsonb_array_elements(dc.dados_conteudo->'indicadores_qualidade') elem
WHERE dc.competencia = DATE '2026-01-01'
GROUP BY 1 ORDER BY 1;
```

---

## 5) Arquivos-chave

| Papel | Arquivo |
|-------|---------|
| Catálogo + cálculo exec/num/den | `etl_contract.py` (`INDICADORES_QUALIDADE_CATALOG`, `_producao_ratios`, `_INDICADOR_PRODUCAO`) |
| Resolve meta | `consolidate_dashboard.py` → `fetch_metas()` |
| Monta contrato | `etl_contract.build_payload()` → `_build_indicadores_qualidade()` |
| API | `simpa-backend/src/services/dashboardService.js` |
| Página Indicadores | `simpa-frontend/src/pages/Indicadores/index.tsx` |
| Página Relatórios | `simpa-frontend/src/pages/Relatorios/index.tsx` |
| Status/formatação | `utils/shared/metaStatus.ts`, `utils/metas/metasView.ts` |
| Ranking/histórico (sintético) | `utils/relatorios/comparativoView.ts`, `utils/indicadores/qualidadeView.ts` |
| Seeds | `migration_034_seed_indicadores_catalog.sql`, `migration_035_seed_metas_default_2026.sql` |

---

## 6) Limitações conhecidas

- **Ranking por unidade / série histórica = sintéticos** (§2). Preencher `porUnidade`/`historico` no payload para dados reais.
- **Metas 2026 = placeholder** (migration 035). Ajustar com parâmetros oficiais da Secretaria.
- **Inversos B3 e IGM-ICSAP** ("menor é melhor", meta = teto): `resolveMetaStatus` assume "maior melhor" → cor/status invertidos. Precisa coluna de sentido em `indicadores` para tratar.
- **B4, M1/M2, IGM-*** sem `exec` (falta numerador: `atividade_coletiva`, eMulti, SI-PNI, SIH-AIH, dado longitudinal).

---

*Atualizado: 2026-08-16 · Ver catálogo completo em [indicadores-qualidade.md](indicadores-qualidade.md).*
