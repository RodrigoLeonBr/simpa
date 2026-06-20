-- ============================================================================
-- SIMPA — Migration 005: perfil_editado + profile-specific enrichment tables
-- Depends on: schema_full.sql … migration_004_cadastros_sync.sql
-- Apply order: 01 schema → 02 auth → 03 cadastros fase2 → 04 cadastros sync → 05 perfil enrichment
-- Safe to re-run on existing databases (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
--
-- Manual apply (non-Docker Postgres):
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_005_estabelecimentos_perfil_enrichment.sql
-- Docker (existing container):
--   Get-Content migration_005_estabelecimentos_perfil_enrichment.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- ============================================================================

ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS perfil_editado BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN estabelecimentos.perfil_editado IS
  'Quando true, sync MySQL não sobrescreve perfil derivado de tipouni.';

CREATE TABLE IF NOT EXISTS enriquecimento_aps (
  estabelecimento_id BIGINT PRIMARY KEY REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  notas_territorio TEXT,
  cobertura_populacional VARCHAR(200),
  vinculo_esus TEXT,
  prioridades_planejamento TEXT,
  notas TEXT,
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enriquecimento_mac (
  estabelecimento_id BIGINT PRIMARY KEY REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  capacidades TEXT[] NOT NULL DEFAULT '{}',
  relacionamento_referencia TEXT,
  autorizacoes TEXT,
  notas TEXT,
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enriquecimento_hospitalar (
  estabelecimento_id BIGINT PRIMARY KEY REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  leitos JSONB NOT NULL DEFAULT '{}',
  especialidades TEXT[] NOT NULL DEFAULT '{}',
  habilitacoes TEXT[] NOT NULL DEFAULT '{}',
  capacidade_notas TEXT,
  notas TEXT,
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enriquecimento_misto (
  estabelecimento_id BIGINT PRIMARY KEY REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  leitos JSONB NOT NULL DEFAULT '{}',
  capacidades_ambulatoriais TEXT[] NOT NULL DEFAULT '{}',
  notas_mac TEXT,
  notas TEXT,
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enriquecimento_outro (
  estabelecimento_id BIGINT PRIMARY KEY REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  notas TEXT,
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

COMMENT ON TABLE enriquecimento_aps IS 'Enriquecimento SIMPA para perfil APS (1:1 com estabelecimentos).';
COMMENT ON TABLE enriquecimento_mac IS 'Enriquecimento SIMPA para perfil MAC (1:1 com estabelecimentos).';
COMMENT ON TABLE enriquecimento_hospitalar IS 'Enriquecimento SIMPA para perfil Hospitalar (1:1 com estabelecimentos).';
COMMENT ON TABLE enriquecimento_misto IS 'Enriquecimento SIMPA para perfil Misto (1:1 com estabelecimentos).';
COMMENT ON TABLE enriquecimento_outro IS 'Enriquecimento SIMPA para perfil Outro (1:1 com estabelecimentos).';

-- Backfill legacy JSONB → normalized tables (idempotent: fill empty normalized rows)
INSERT INTO enriquecimento_hospitalar (
  estabelecimento_id,
  leitos,
  especialidades,
  habilitacoes,
  capacidade_notas,
  notas
)
SELECT
  e.id,
  CASE
    WHEN jsonb_typeof(e.enriquecimento->'leitos') = 'object'
      THEN e.enriquecimento->'leitos'
    ELSE '{}'::jsonb
  END,
  CASE
    WHEN jsonb_typeof(e.enriquecimento->'especialidades') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(e.enriquecimento->'especialidades'))
    ELSE '{}'::text[]
  END,
  CASE
    WHEN jsonb_typeof(e.enriquecimento->'habilitacoes') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(e.enriquecimento->'habilitacoes'))
    ELSE '{}'::text[]
  END,
  e.enriquecimento->>'capacidade_notas',
  e.enriquecimento->>'notas'
FROM estabelecimentos e
WHERE e.perfil = 'Hospitalar'
  AND e.enriquecimento IS NOT NULL
  AND e.enriquecimento <> '{}'::jsonb
ON CONFLICT (estabelecimento_id) DO UPDATE SET
  leitos = CASE
    WHEN enriquecimento_hospitalar.leitos = '{}'::jsonb
      AND EXCLUDED.leitos <> '{}'::jsonb
      THEN EXCLUDED.leitos
    ELSE enriquecimento_hospitalar.leitos
  END,
  especialidades = CASE
    WHEN enriquecimento_hospitalar.especialidades = '{}'::text[]
      AND EXCLUDED.especialidades <> '{}'::text[]
      THEN EXCLUDED.especialidades
    ELSE enriquecimento_hospitalar.especialidades
  END,
  habilitacoes = CASE
    WHEN enriquecimento_hospitalar.habilitacoes = '{}'::text[]
      AND EXCLUDED.habilitacoes <> '{}'::text[]
      THEN EXCLUDED.habilitacoes
    ELSE enriquecimento_hospitalar.habilitacoes
  END,
  capacidade_notas = COALESCE(enriquecimento_hospitalar.capacidade_notas, EXCLUDED.capacidade_notas),
  notas = COALESCE(enriquecimento_hospitalar.notas, EXCLUDED.notas);

INSERT INTO enriquecimento_misto (
  estabelecimento_id,
  leitos,
  capacidades_ambulatoriais,
  notas
)
SELECT
  e.id,
  CASE
    WHEN jsonb_typeof(e.enriquecimento->'leitos') = 'object'
      THEN e.enriquecimento->'leitos'
    ELSE '{}'::jsonb
  END,
  CASE
    WHEN jsonb_typeof(e.enriquecimento->'especialidades') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(e.enriquecimento->'especialidades'))
    ELSE '{}'::text[]
  END,
  e.enriquecimento->>'notas'
FROM estabelecimentos e
WHERE e.perfil = 'Misto'
  AND e.enriquecimento IS NOT NULL
  AND e.enriquecimento <> '{}'::jsonb
ON CONFLICT (estabelecimento_id) DO UPDATE SET
  leitos = CASE
    WHEN enriquecimento_misto.leitos = '{}'::jsonb
      AND EXCLUDED.leitos <> '{}'::jsonb
      THEN EXCLUDED.leitos
    ELSE enriquecimento_misto.leitos
  END,
  capacidades_ambulatoriais = CASE
    WHEN enriquecimento_misto.capacidades_ambulatoriais = '{}'::text[]
      AND EXCLUDED.capacidades_ambulatoriais <> '{}'::text[]
      THEN EXCLUDED.capacidades_ambulatoriais
    ELSE enriquecimento_misto.capacidades_ambulatoriais
  END,
  notas = COALESCE(enriquecimento_misto.notas, EXCLUDED.notas);
