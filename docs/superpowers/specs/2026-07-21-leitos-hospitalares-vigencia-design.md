# Leitos hospitalares — UTI split, detalhe CNES e vigências

**Data:** 2026-07-21 · **Status:** Aprovado (aguardando plano de implementação)  
**Contexto:** `/cadastros/estabelecimentos` — enriquecimento Hospitalar e Misto

## Problema

O formulário de leitos hoje tem um único total de UTI e um snapshot JSONB sem histórico. Hospitais precisam:

1. Separar **UTI Adulto** e **UTI Neonatal**
2. Manter o resumo atual (Clínico, Cirúrgico, Obstétrico, Pediátrico, UTIs)
3. Opcionalmente detalhar por tipos CNES (catálogo fixo)
4. Versionar resumo + detalhe por **vigência** (competência início/fim), ex.: `01/2021–06/2023`, `07/2023–09/2024`, `10/2024–99/9999`

## Decisões

| Tópico | Decisão |
|--------|---------|
| Quantidade por tipo | Um número inteiro ≥ 0 (não pares existentes/SUS) |
| UI | Resumo sempre visível + seção opcional Detalhamento |
| Catálogo detalhe | Fixo (códigos CNES listados abaixo) |
| Consistência | Se detalhe tiver qualquer qtd > 0, somas por grupo **obrigam** bater com o resumo |
| Vigência | Pacote único: cada período guarda `leitos` + `leitos_detalhe` |
| Persistência | Nova tabela PG (não só JSONB no enriquecimento pai) |
| Overlap | Vigências do mesmo estabelecimento **não** se sobrepõem |
| Fim aberto | UI `99/9999` → grava `999999` |
| Painel por competência | **Fora de escopo** nesta entrega (só cadastro + API) |
| Sync CNES automático | Fora de escopo |

## Schema

Migration sugerida: `migration_026_leitos_vigencia.sql` (próximo número após `025`).

```sql
CREATE TABLE enriquecimento_hospitalar_leitos_vigencia (
  id                  SERIAL PRIMARY KEY,
  estabelecimento_id  INT NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  vigencia_inicio     CHAR(6) NOT NULL,  -- YYYYMM
  vigencia_fim        CHAR(6) NOT NULL,  -- YYYYMM; 999999 = aberto
  leitos              JSONB NOT NULL DEFAULT '{}',
  leitos_detalhe      JSONB NOT NULL DEFAULT '{}',
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_leitos_vigencia_ym CHECK (
    vigencia_inicio ~ '^[0-9]{6}$' AND vigencia_fim ~ '^[0-9]{6}$'
  ),
  CONSTRAINT chk_leitos_vigencia_ordem CHECK (vigencia_inicio <= vigencia_fim)
);

CREATE INDEX idx_leitos_vigencia_estab
  ON enriquecimento_hospitalar_leitos_vigencia (estabelecimento_id);
```

Overlap: validado na aplicação (e, se viável, exclusão com `EXCLUDE`/`daterange` em migration futura). Nome da tabela mantém prefixo `enriquecimento_hospitalar_*`; aplica-se também a estabelecimentos **Misto** (FK só em `estabelecimentos`).

### Formato `leitos` (resumo)

```json
{
  "clinico": 44,
  "cirurgico": 47,
  "obstetrico": 22,
  "pediatrico": 8,
  "uti_adulto": 17,
  "uti_neonatal": 5
}
```

Chaves canônicas: `clinico`, `cirurgico`, `obstetrico`, `pediatrico`, `uti_adulto`, `uti_neonatal`.  
Chave legada `uti` **não** é mais escrita; na migração `uti` → `uti_adulto`.

### Formato `leitos_detalhe`

Mapa código → quantidade:

```json
{
  "75": 17,
  "81": 5,
  "03": 30,
  "13": 17,
  "33": 44,
  "10": 13,
  "43": 9,
  "47": 3,
  "68": 2,
  "45": 6
}
```

Códigos fora do catálogo → 400. Valores omitidos ou 0 = tipo não usado.

## Catálogo fixo (detalhe → grupo)

| Código | Descrição | Grupo resumo |
|--------|-----------|--------------|
| 75 | UTI-A Tipo II | `uti_adulto` |
| 81 | UTI Neonatal Tipo II | `uti_neonatal` |
| 03 | Cirurgia Geral | `cirurgico` |
| 13 | Ortopedia/Traumatologia | `cirurgico` |
| 33 | Clínica Geral | `clinico` |
| 10 | Obstetrícia Cirúrgica | `obstetrico` |
| 43 | Obstetrícia Clínica | `obstetrico` |
| 47 | Psiquiatria | `clinico` |
| 68 | Pediatria Cirúrgica | `pediatrico` |
| 45 | Pediatria Clínica | `pediatrico` |

Psiquiatria (CNES “Outras especialidades”) mapeia para `clinico` neste MVP — sem sétimo bucket `outros`.

## Regra de consistência

1. Se `leitos_detalhe` estiver vazio ou todas as quantidades forem 0 → só valida o resumo (inteiros ≥ 0).
2. Se existir qualquer quantidade > 0 no detalhe → para cada grupo do resumo,  
   `soma(detalhe onde grupo = G) === leitos[G]` (tratando ausente como 0).  
   Divergência → 400 com mensagem por grupo.

## Migração de dados

Para cada linha em `enriquecimento_hospitalar` e `enriquecimento_misto` com `leitos` não vazio:

1. Normalizar chaves (`uti` → `uti_adulto`).
2. Inserir **uma** vigência: `vigencia_inicio = '000001'`, `vigencia_fim = '999999'`, `leitos` normalizado, `leitos_detalhe = {}`.
3. Colunas `leitos` nas tabelas pai permanecem por compatibilidade de leitura legada, mas **deixam de ser fonte de verdade**. CRUD de leitos só via `/leitos-vigencias`. Após create/update/delete de vigência, o serviço **espelha** em `enriquecimento_hospitalar.leitos` / `enriquecimento_misto.leitos` o resumo da vigência aberta (`vigencia_fim = '999999'`); se não houver vigência aberta, espelha `{}`.

   **Decisão de implementação (2026-07-21, abordagem leve):** o caminho legado de PUT de enriquecimento **não** foi alterado para rejeitar/strip de `leitos` — o espelho + a remoção do campo no formulário (Task 7) já tornam o `leitos` do body inofensivo, evitando churn/risco na validação compartilhada por todos os perfis. O GET passa a incluir `leitos_vigencias`.

## API

Base (JWT + `requirePlanningStaff`), sob cadastros de estabelecimentos:

| Método | Rota | Função |
|--------|------|--------|
| GET | `/api/cadastros/estabelecimentos/:id/leitos-vigencias` | Lista ordenada por `vigencia_inicio` |
| POST | `/api/cadastros/estabelecimentos/:id/leitos-vigencias` | Cria pacote |
| PUT | `/api/cadastros/estabelecimentos/:id/leitos-vigencias/:vigenciaId` | Atualiza |
| DELETE | `/api/cadastros/estabelecimentos/:id/leitos-vigencias/:vigenciaId` | Remove |

Body create/update:

```json
{
  "vigencia_inicio": "202410",
  "vigencia_fim": "999999",
  "leitos": { "clinico": 44, "cirurgico": 47, "obstetrico": 22, "pediatrico": 8, "uti_adulto": 17, "uti_neonatal": 5 },
  "leitos_detalhe": { "75": 17, "81": 5 }
}
```

Erros: 400 (validação/overlap/consistência), 404 (estab/vigência).

GET do estabelecimento inclui `leitos_vigencias: [...]` e mantém `enrichment.leitos` como espelho da vigência aberta (`vigencia_fim = '999999'`), para consumidores legados.

## Frontend

- Formulário Hospitalar/Misto: bloco **Leitos por vigência** (lista + criar/editar/excluir).
- Editor de vigência: datas início/fim (MM/YYYY; fim permite 99/9999) + 6 campos do resumo + fieldset Detalhamento (catálogo fixo).
- Validação client-side espelhando backend (overlap local na lista + consistência detalhe).
- `LEITOS_KEYS` atualizado: remove `uti`, adiciona `uti_adulto`, `uti_neonatal`.
- Resumo em listagens (`formatLeitosSummary`) usa chaves novas; se só existir `uti` legado, exibir como UTI Adulto.

## Testes

- Backend: CRUD; overlap; consistência detalhe↔resumo; rejeição de código fora do catálogo; migração `uti` → `uti_adulto`.
- Frontend: formulário com split UTI; bloqueio de save inconsistente; vigência aberta `99/9999`.
- Pytest/migration smoke se houver fixtures de enrichment.

## Fora de escopo

- Consumo no Painel filtrando leitos pela competência selecionada
- Import/sync automático do CNES
- Bucket `outros` no resumo
- Pares existentes/SUS no detalhe

## Arquivos prováveis

- `migration_026_leitos_vigencia.sql` + entrada em `docker-compose.yml`
- `simpa-backend/src/services/` (CRUD vigências + validação)
- `simpa-backend/src/routes/cadastros.js` (ou router de estabelecimentos)
- `simpa-frontend/src/utils/enrichmentView.ts`, `enrichmentByPerfil.ts`
- `simpa-frontend/src/components/cadastros/EnrichmentForm*.tsx` (+ componente de vigências)
- `docs/agent/cadastros.md`, `docs/agent/database.md`
