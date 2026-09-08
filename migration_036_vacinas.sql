-- =============================================================================
-- SIMPA — Migration 036: módulo Vacinas (importação NIES + cobertura)
-- Depends on: schema_full.sql … migration_035_seed_metas_default_2026.sql
-- Apply order: 01 schema → … → 35 metas_default → 36 vacinas
-- Idempotente (IF NOT EXISTS / ON CONFLICT DO NOTHING). Re-run seguro.
--
-- Manual (non-Docker PG):
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_036_vacinas.sql
-- Docker:
--   Get-Content migration_036_vacinas.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- =============================================================================

CREATE TABLE IF NOT EXISTS vacina_cargas (
    id            BIGSERIAL PRIMARY KEY,
    competencia   DATE        NOT NULL,
    arquivo_nome  TEXT        NOT NULL,
    linhas        INT         NOT NULL DEFAULT 0,
    doses_total   INT         NOT NULL DEFAULT 0,
    importado_por TEXT,
    importado_em  TIMESTAMP   NOT NULL DEFAULT now(),
    status        TEXT        NOT NULL DEFAULT 'ok'
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vacina_cargas_competencia
    ON vacina_cargas (competencia);

CREATE TABLE IF NOT EXISTS vacina_doses (
    id             BIGSERIAL PRIMARY KEY,
    carga_id       BIGINT NOT NULL REFERENCES vacina_cargas(id) ON DELETE CASCADE,
    competencia    DATE   NOT NULL,
    cnes_sala      TEXT,
    sala_nome      TEXT,
    imuno_codigo   TEXT   NOT NULL,
    imuno_nome     TEXT   NOT NULL,
    faixa_nies     TEXT   NOT NULL,
    sistema_origem TEXT,
    doses          INT    NOT NULL DEFAULT 0,
    UNIQUE (carga_id, cnes_sala, imuno_codigo, faixa_nies, sistema_origem)
);
CREATE INDEX IF NOT EXISTS idx_vacina_doses_competencia
    ON vacina_doses (competencia, imuno_codigo);
CREATE INDEX IF NOT EXISTS idx_vacina_doses_faixa
    ON vacina_doses (faixa_nies);

CREATE TABLE IF NOT EXISTS vacina_imunobiologicos (
    imuno_codigo TEXT PRIMARY KEY,
    imuno_nome   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vacina_grupos (
    id    BIGSERIAL PRIMARY KEY,
    nome  TEXT NOT NULL,
    slug  TEXT NOT NULL UNIQUE,
    ordem INT  NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS vacina_faixa_grupo (
    faixa_nies TEXT PRIMARY KEY,
    grupo_id   BIGINT REFERENCES vacina_grupos(id) ON DELETE SET NULL
);

-- Seed das 20 faixas etárias REAIS extraídas dos xlsx do NIES (grupo_id NULL = não mapeado)
INSERT INTO vacina_faixa_grupo (faixa_nies) VALUES
    ('< 30 dias'), ('< 01 ano'), ('01 ano'), ('02 a 04 anos'),
    ('05 a 11 anos'), ('12 a 17 anos'), ('18 a 19 anos'), ('20 a 24 anos'),
    ('25 a 29 anos'), ('30 a 34 anos'), ('35 a 39 anos'), ('40 a 44 anos'),
    ('45 a 49 anos'), ('50 a 54 anos'), ('55 a 59 anos'), ('60 a 64 anos'),
    ('65 a 69 anos'), ('70 a 74 anos'), ('75 a 79 anos'), ('80 anos ou mais')
ON CONFLICT (faixa_nies) DO NOTHING;

CREATE TABLE IF NOT EXISTS vacina_populacao_alvo (
    id        BIGSERIAL PRIMARY KEY,
    ano       INT    NOT NULL,
    grupo_id  BIGINT NOT NULL REFERENCES vacina_grupos(id) ON DELETE CASCADE,
    populacao INT    NOT NULL DEFAULT 0,
    UNIQUE (ano, grupo_id)
);

CREATE TABLE IF NOT EXISTS vacina_esquema (
    id           BIGSERIAL PRIMARY KEY,
    imuno_codigo TEXT   NOT NULL,
    grupo_id     BIGINT NOT NULL REFERENCES vacina_grupos(id) ON DELETE CASCADE,
    num_doses    INT    NOT NULL CHECK (num_doses > 0),
    UNIQUE (imuno_codigo, grupo_id)
);

COMMENT ON TABLE vacina_doses IS
    'Fato de doses aplicadas (NIES). Grão: carga × sala × imuno × faixa × sistema.';
COMMENT ON TABLE vacina_esquema IS
    'Nº de doses do esquema por vacina×grupo. Ausência de linha = vacina não-alvo no grupo.';
