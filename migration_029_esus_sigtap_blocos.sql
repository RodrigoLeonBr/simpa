-- ============================================================================
-- SIMPA — Migration 029: blocos SIGTAP do e-SUS no de-para + view unificada
-- Depends on: … migration_028_esus_producao_view.sql (view v_esus_producao)
-- Apply order: … → 28 esus_producao_view → 29 esus_sigtap_blocos
-- Safe to re-run (IF NOT EXISTS + ON CONFLICT DO NOTHING + CREATE OR REPLACE).
--
-- Manual apply (Postgres não-Docker):
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_029_esus_sigtap_blocos.sql
-- Docker (container existente) — UTF-8 SAFE:
--   docker cp migration_029_esus_sigtap_blocos.sql simpa-postgres-1:/tmp/m.sql
--   docker exec simpa-postgres-1 psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/m.sql
-- NÃO use `Get-Content ... | docker exec -i psql` (corrompe acento no Windows).
--
-- Objetivo: seções e-SUS que já trazem o código SIGTAP na descrição (secao
-- ILIKE '%SIGTAP%', ex. "Outros exames solicitados e avaliados (código do
-- SIGTAP)") passam a virar linhas em procedimentos_esus_sigtap — os 10 dígitos
-- iniciais da descrição = codigo_sigtap. Com isso TODO mapeamento e-SUS→SIGTAP
-- (curado + descoberto) fica numa fonte única, e a produção e-SUS por SIGTAP
-- vira um JOIN só (sem a branch regexp em tempo de query).
--
-- Conjunto ABERTO: cada importação pode trazer código novo. O backfill abaixo
-- cobre o que já está importado; a rotina discoverEsusSigtapFromBlocks()
-- (producaoSigtapService.js), chamada no fluxo de importação, mantém em dia.
-- ============================================================================

-- 1. Marca a origem de cada mapeamento (curado à mão vs. descoberto do e-SUS).
ALTER TABLE procedimentos_esus_sigtap
    ADD COLUMN IF NOT EXISTS origem VARCHAR(20) NOT NULL DEFAULT 'curado';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_proc_esus_sigtap_origem'
  ) THEN
    ALTER TABLE procedimentos_esus_sigtap
      ADD CONSTRAINT chk_proc_esus_sigtap_origem
      CHECK (origem IN ('curado', 'descoberto'));
  END IF;
END $$;

COMMENT ON COLUMN procedimentos_esus_sigtap.origem IS
    'curado = seed manual; descoberto = extraído de bloco SIGTAP do e-SUS (10 dígitos iniciais da descrição).';

-- 2. Backfill dos blocos SIGTAP já importados. ON CONFLICT DO NOTHING preserva
--    qualquer linha curada com a mesma (tipo_relatorio, descricao_esus).
INSERT INTO procedimentos_esus_sigtap
    (tipo_relatorio, bloco, descricao_esus, codigo_sigtap, descricao_sigtap, origem)
SELECT DISTINCT
    c.tipo_relatorio,
    r.secao,
    r.descricao,
    substring(r.descricao from '^\s*(\d{10})'),
    btrim(regexp_replace(r.descricao, '^[^A-Za-zÀ-ÿ]+', '')),
    'descoberto'
FROM esus_indicadores_raw r
JOIN esus_cargas c ON c.id = r.carga_id
WHERE r.secao ILIKE '%SIGTAP%'
  AND substring(r.descricao from '^\s*(\d{10})') IS NOT NULL
ON CONFLICT (tipo_relatorio, descricao_esus) DO NOTHING;

-- 3. View unificada e-SUS × SIGTAP — agora JOIN único (blocos vivem no de-para).
--    Row-level (sem GROUP BY) para os filtros externos sofrerem pushdown.
CREATE OR REPLACE VIEW v_esus_producao_sigtap AS
SELECT p.competencia,
       p.estabelecimento_id,
       p.unidade,
       p.tipo_relatorio,
       m.bloco,
       p.descricao                                    AS descricao_esus,
       m.codigo_sigtap,
       m.descricao_sigtap,
       COALESCE((p.valores->>'quantidade')::int, 0)   AS quantidade
FROM v_esus_producao p
JOIN procedimentos_esus_sigtap m
  ON m.tipo_relatorio = p.tipo_relatorio
 AND m.descricao_esus = p.descricao
WHERE m.status = 'ativo';

COMMENT ON VIEW v_esus_producao_sigtap IS
    'Produção e-SUS chaveada por código SIGTAP (JOIN único com procedimentos_esus_sigtap, curado + descoberto). Filtrar codigo_sigtap LIKE ''NNNN%'' na query externa. NÃO contém consultas 0301 (e-SUS não codifica consulta) — consulta é SIA.';
