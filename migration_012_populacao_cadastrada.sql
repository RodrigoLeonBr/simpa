-- ============================================================================
-- SIMPA — Migration 012: Tabela populacao_cadastrada
-- Depends on: schema_full.sql … migration_011_rubricas_sia.sql
-- Apply order: 01 schema → … → 11 rubricas_sia → 12 populacao_cadastrada
-- Safe to re-run on existing databases (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS).
--
-- Manual apply (non-Docker Postgres):
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_012_populacao_cadastrada.sql
-- Docker (existing container):
--   Get-Content migration_012_populacao_cadastrada.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- ============================================================================

-- 1. Adicionar 'cadastro_individual' ao CHECK de esus_cargas.tipo_relatorio
ALTER TABLE esus_cargas
    DROP CONSTRAINT IF EXISTS esus_cargas_tipo_relatorio_check;

ALTER TABLE esus_cargas
    ADD CONSTRAINT esus_cargas_tipo_relatorio_check
    CHECK (tipo_relatorio IN (
        'atendimento_individual',
        'atendimento_domiciliar',
        'atendimento_odontologico',
        'atividade_coletiva',
        'marcadores_consumo_alimentar',
        'procedimentos_individualizados',
        'cadastro_individual'
    ));

-- 2. Nova tabela: snapshot de população cadastrada por unidade/competência
CREATE TABLE IF NOT EXISTS populacao_cadastrada (
    id                  BIGSERIAL PRIMARY KEY,
    carga_id            BIGINT       NOT NULL REFERENCES esus_cargas(id) ON DELETE CASCADE,
    estabelecimento_id  BIGINT       NOT NULL REFERENCES estabelecimentos(id),
    competencia         DATE         NOT NULL,
    cidadaos_ativos     INT          NOT NULL DEFAULT 0,
    saidas              INT          NOT NULL DEFAULT 0,
    sexo_masculino      INT,
    sexo_feminino       INT,
    faixa_etaria        JSONB        NOT NULL DEFAULT '[]',
    condicoes_saude     JSONB        NOT NULL DEFAULT '{}',
    raca_cor            JSONB        NOT NULL DEFAULT '{}',
    sociodemografico    JSONB        NOT NULL DEFAULT '{}',
    extras              JSONB        NOT NULL DEFAULT '{}',
    importado_em        TIMESTAMP    NOT NULL DEFAULT now(),
    UNIQUE (carga_id),
    UNIQUE (competencia, estabelecimento_id)
);

CREATE INDEX IF NOT EXISTS idx_pop_cad_competencia
    ON populacao_cadastrada (competencia, estabelecimento_id);

CREATE INDEX IF NOT EXISTS idx_pop_cad_condicoes_gin
    ON populacao_cadastrada USING GIN (condicoes_saude);

COMMENT ON TABLE populacao_cadastrada IS
    'Snapshot agregado do relatório de cadastro individual e-SUS por unidade e competência. '
    'Uma linha por (competencia, estabelecimento_id). Fonte dos denominadores de indicadores de qualidade APS.';

COMMENT ON COLUMN populacao_cadastrada.carga_id IS
    'FK para esus_cargas (tipo_relatorio = cadastro_individual). CASCADE DELETE limpa este registro automaticamente.';
COMMENT ON COLUMN populacao_cadastrada.faixa_etaria IS
    'Array JSON: [{faixa, masculino, feminino, indeterminado, nao_informado}] na ordem do CSV.';
COMMENT ON COLUMN populacao_cadastrada.condicoes_saude IS
    'Condições de saúde: {hipertensao, diabetes, gestante, fumante, …}: {sim, nao, nao_informado}.';
COMMENT ON COLUMN populacao_cadastrada.extras IS
    'Seções do CSV não mapeadas para colunas estruturadas. Preserva compatibilidade com versões futuras do e-SUS PEC.';
