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
