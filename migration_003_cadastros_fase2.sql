-- ============================================================================
-- SIMPA — Migration 003: Cadastros Phase 2 + metas + indicadores catalog
-- ============================================================================

CREATE TABLE IF NOT EXISTS procedimentos (
    id                BIGSERIAL PRIMARY KEY,
    codigo_sigtap     VARCHAR(20) UNIQUE NOT NULL,
    descricao         VARCHAR(300) NOT NULL,
    tipo              VARCHAR(40) CHECK (tipo IN ('ambulatorial', 'hospitalar', 'odontologico', 'outro')),
    tabela_referencia VARCHAR(40) DEFAULT 'SIGTAP',
    valor_referencia  NUMERIC(12,2),
    status            VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prestadores_mac (
    id            BIGSERIAL PRIMARY KEY,
    nome          VARCHAR(200) NOT NULL,
    cnes          VARCHAR(20),
    tipo_contrato VARCHAR(60),
    status        VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hospitais (
    id        BIGSERIAL PRIMARY KEY,
    nome      VARCHAR(200) NOT NULL,
    cnes      VARCHAR(20),
    tipo      VARCHAR(40) CHECK (tipo IN ('proprio', 'contratualizado', 'OSS', 'outro')),
    num_leitos INT,
    status    VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emendas_parlamentares (
    id              BIGSERIAL PRIMARY KEY,
    id_emenda       VARCHAR(40) UNIQUE NOT NULL,
    esfera          VARCHAR(20) NOT NULL CHECK (esfera IN ('federal', 'estadual', 'municipal')),
    tipo            VARCHAR(40),
    autor           VARCHAR(200),
    objeto          TEXT,
    valor_repassado NUMERIC(14,2),
    status          VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS indicadores (
    id             BIGSERIAL PRIMARY KEY,
    codigo         VARCHAR(20) UNIQUE NOT NULL,
    nome           VARCHAR(300) NOT NULL,
    descricao      TEXT,
    categoria      VARCHAR(80),
    numerador_expr TEXT,
    denominador_expr TEXT,
    fonte_dados    VARCHAR(120),
    periodicidade  VARCHAR(40),
    unidade_medida VARCHAR(40),
    versao_formula VARCHAR(20) DEFAULT '1.0',
    status         VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metas_financiamento (
    id           BIGSERIAL PRIMARY KEY,
    indicador_id BIGINT REFERENCES indicadores(id),
    unidade_id   BIGINT REFERENCES unidades_saude(id) ON DELETE SET NULL,
    equipe_id    BIGINT REFERENCES equipes(id) ON DELETE SET NULL,
    competencia  DATE NOT NULL,
    valor_meta   NUMERIC(12,4),
    origem       VARCHAR(80) CHECK (origem IN (
                     'Componente Qualidade APS',
                     'IGM SUS Paulista',
                     'Emenda Parlamentar',
                     'Meta Local'
                 )),
    emenda_id    BIGINT REFERENCES emendas_parlamentares(id) ON DELETE SET NULL,
    criado_em    TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (indicador_id, unidade_id, equipe_id, competencia, origem)
);

CREATE TABLE IF NOT EXISTS emendas_metas_producao (
    id              BIGSERIAL PRIMARY KEY,
    emenda_id       BIGINT NOT NULL REFERENCES emendas_parlamentares(id) ON DELETE CASCADE,
    codigo_sigtap   VARCHAR(20),
    meta_fisica     NUMERIC(12,2),
    executado_fisico NUMERIC(12,2),
    competencia     DATE NOT NULL,
    atualizado_em   TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (emenda_id, codigo_sigtap, competencia)
);

CREATE INDEX IF NOT EXISTS idx_metas_competencia
    ON metas_financiamento (competencia, indicador_id);
CREATE INDEX IF NOT EXISTS idx_emendas_metas_emenda
    ON emendas_metas_producao (emenda_id, competencia);

COMMENT ON TABLE procedimentos IS 'Catálogo SIGTAP auxiliar para metas e emendas.';
COMMENT ON TABLE indicadores IS 'Catálogo de indicadores (C1, B1-B6, IGM, locais).';
COMMENT ON TABLE metas_financiamento IS 'Metas pactuadas por indicador/unidade/competência.';
