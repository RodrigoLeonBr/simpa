# e-SUS ↔ SIGTAP — De-para de procedimentos

Guia operacional e técnico do catálogo de mapeamento entre labels do relatório e-SUS APS e códigos SIGTAP oficiais no SIMPA.

> **Importante:** as planilhas municipais usadas no seed **não** gravam quantidades. Quantidades de produção vêm sempre das cargas e-SUS (`esus_indicadores_raw` / `esus_cargas`). O de-para só resolve **qual código SIGTAP** corresponde a cada `(seção, descrição)`.

## Propósito

- Manter um de-para editável (Cadastros) entre texto exato do e-SUS e `codigo_sigtap`.
- Alimentar **dois consumidores** com a mesma regra de lookup:
  1. Export on-demand JSON/CSV (`GET /api/procedimentos/export`)
  2. Analytics no consolidado (`modulos.atencao_primaria_esus.procedimentos_mapeados`, contrato v3.2.0+)
- Labels **sem** mapeamento ativo são omitidos (**silent skip**) — não geram erro nem bloqueiam export/consolidação.

Ajuda curta in-app: Cadastros → Procedimentos (e-SUS ↔ SIGTAP). Este arquivo é o how-to completo do repositório.

## Specs e decisões

| Doc | Caminho |
|-----|---------|
| PRD | [`.compozy/tasks/esus-sigtap-depara/_prd.md`](../.compozy/tasks/esus-sigtap-depara/_prd.md) |
| TechSpec | [`.compozy/tasks/esus-sigtap-depara/_techspec.md`](../.compozy/tasks/esus-sigtap-depara/_techspec.md) |
| Tasks | [`.compozy/tasks/esus-sigtap-depara/_tasks.md`](../.compozy/tasks/esus-sigtap-depara/_tasks.md) |
| ADR-001 (abordagem produto) | [`.compozy/tasks/esus-sigtap-depara/adrs/adr-001.md`](../.compozy/tasks/esus-sigtap-depara/adrs/adr-001.md) |
| ADR-002 (duas tabelas + seed SQL) | [`.compozy/tasks/esus-sigtap-depara/adrs/adr-002.md`](../.compozy/tasks/esus-sigtap-depara/adrs/adr-002.md) |
| ADR-003 (match exato + seções reais) | [`.compozy/tasks/esus-sigtap-depara/adrs/adr-003.md`](../.compozy/tasks/esus-sigtap-depara/adrs/adr-003.md) |
| ADR-004 (consolidado + export JSON/CSV) | [`.compozy/tasks/esus-sigtap-depara/adrs/adr-004.md`](../.compozy/tasks/esus-sigtap-depara/adrs/adr-004.md) |

## Modelo de dados

DDL em [`schema_full.sql`](../schema_full.sql) (§5b):

| Tabela | Papel |
|--------|--------|
| `procedimentos` | Mestre SIGTAP (`codigo_sigtap`, `descricao`, `tipo`, `status`, …) |
| `esus_procedimento_map` | De-para: `(secao, descricao_esus)` → `procedimento_id` (`origem`, `status`) |

Soft-delete: `status = 'inativo'` (não apaga linha).

Função compartilhada (export + consolidator):

```sql
SELECT * FROM resolve_mapped_procedures(competencia::date, unidade, equipe);
```

Retorno (contrato `MappingLookup`): `secao`, `descricao_esus`, `codigo_sigtap`, `descricao_sigtap`, `quantidade`.

## Contrato de lookup

1. Match **exato** de strings:  
   `esus_procedimento_map.secao` = `esus_indicadores_raw.secao`  
   **e** `esus_procedimento_map.descricao_esus` = `esus_indicadores_raw.descricao`
2. Só entram mapas e procedimentos com `status = 'ativo'`.
3. `quantidade` = soma de `(valores->>'quantidade')::int` nas linhas raw da carga filtrada.
4. Filtros via `esus_cargas`: `competencia`, `unidade`, `equipe_nome`.
5. Sem mapeamento → linha **omitida** (silent skip). Sem payload de warning no MVP.

Implementações: SQL `resolve_mapped_procedures` + wrapper Node `simpa-backend/src/services/procedimentoMap.js` + chamada Python em `consolidate_dashboard.py`.

## Seções e-SUS usadas no seed

Nomes **exatos** (não renomear sem atualizar o seed/CRUD):

| Seção | Origem típica |
|-------|----------------|
| `Procedimentos / Pequenas cirurgias` | Planilha municipal + LEDI |
| `Procedimentos - Teste rápido` | Planilha municipal + LEDI |
| `Procedimentos - Administração de medicamentos` | Planilha municipal + LEDI |
| `Procedimentos` | Odontologia (FAO / municipal) |
| `Outros procedimentos (SIGTAP)` | Labels nativos já com código no texto e-SUS |

## Seed

Arquivos:

- [`seed_esus_sigtap_depara.sql`](../seed_esus_sigtap_depara.sql) — SQL versionado, idempotente (`ON CONFLICT`)
- [`scripts/generate_seed_esus_sigtap_depara.py`](../scripts/generate_seed_esus_sigtap_depara.py) — regenera o SQL a partir das listas curadas

Fontes documentadas no cabeçalho do seed (LEDI e-SUS APS, planilhas municipais, labels dos CSVs CAFI). Quantidades das planilhas **não** entram no banco.

Aplicar (ajuste usuário/host/porta do Docker local):

```powershell
Get-Content seed_esus_sigtap_depara.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
```

Verificação: `tests/sql/verify_seed_esus_sigtap_depara.sql` e `tests/test_seed_esus_sigtap_depara.py`.

## Manutenção via CRUD (Cadastros)

UI: `/cadastros/procedimentos` (aba Procedimentos e-SUS ↔ SIGTAP).

API (montada em `/api/cadastros`):

| Método | Path |
|--------|------|
| GET/POST/PUT/DELETE | `/api/cadastros/procedimentos` |
| GET/POST/PUT/DELETE | `/api/cadastros/esus-procedimento-map` |

- Listagens omitem `inativo` por padrão (`?status=` para sobrescrever).
- POST de mapa aceita `procedimento_id` **ou** `codigo_sigtap` (+ `descricao` se for criar o mestre).
- DELETE = soft-inactivate.
- Filtros do mapa: `secao`, `q`, `status`.

## Export API

Rota: `GET /api/procedimentos/export`  
Query: `competencia` (obrigatória, `YYYY-MM` ou `YYYY-MM-DD`), `unidade`, `equipe`, `format=json|csv` (default `json`).

Na prática, `unidade` e `equipe` são obrigatórios (mesmo contrato do resolve).

### Colunas CSV (ordem fixa)

```
competencia,unidade,equipe,secao,descricao_esus,codigo_sigtap,descricao_sigtap,quantidade
```

### Exemplo curl

```bash
curl -G "http://localhost:3001/api/procedimentos/export" \
  --data-urlencode "competencia=2026-05" \
  --data-urlencode "unidade=CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO" \
  --data-urlencode "equipe=EQUIPE 9 EAP" \
  --data-urlencode "format=csv" \
  -o procedimentos-mapeados-2026-05.csv
```

JSON (mesmo filtros, sem `format` ou `format=json`): array de objetos `MappingLookup`.

UI: Painel APS e Relatórios — botões Export CSV / JSON usam os filtros ativos da FilterBar.

## Consolidator / Painel

- Script: `consolidate_dashboard.py` (`VERSAO_SCHEMA = "3.2.0"`).
- Campo: `dados_conteudo.modulos.atencao_primaria_esus.procedimentos_mapeados[]`.
- Mesma função SQL `resolve_mapped_procedures`.
- Após deploy do bump, reconsolidar cargas existentes:

```powershell
python consolidate_dashboard.py --all --pg-write
# ou
curl -X POST "http://localhost:3001/api/v1/dashboard/consolidar?all=true"
```

## Fluxo resumido

```text
esus_indicadores_raw ──exact(secao,descricao)──► esus_procedimento_map ──► procedimentos
         │                                              │
         │                                              ├── consolidate_dashboard.py → dados_consolidados
         │                                              └── GET /api/procedimentos/export → JSON | CSV
         └── Cadastros CRUD mantém mapa + mestre
```

## Checklist rápido para quem chega agora

1. Aplicar DDL (`schema_full.sql`) e seed (`seed_esus_sigtap_depara.sql`).
2. Abrir Cadastros → Procedimentos; conferir seções e códigos.
3. Importar CSV e-SUS (ou usar carga existente) com a equipe correta.
4. Chamar export (curl ou UI) e/ou reconsolidar e ver a tabela no Painel APS.
5. Se um label sumiu: conferir texto **exato** da seção/descrição e status `ativo`.
