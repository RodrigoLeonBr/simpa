-- ============================================================================
-- SIMPA — Schema completo PostgreSQL v3.1.0
-- Substitui schema_esus.sql (nunca foi aplicado ao banco)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. esus_cargas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS esus_cargas (
    id                          BIGSERIAL PRIMARY KEY,
    tipo_relatorio              VARCHAR(60) NOT NULL CHECK (tipo_relatorio IN (
                                    'atendimento_individual',
                                    'atendimento_odontologico',
                                    'atividade_coletiva',
                                    'marcadores_consumo_alimentar',
                                    'procedimentos_individualizados'
                                )),
    competencia                 DATE NOT NULL,
    periodo_inicio              DATE NOT NULL,
    periodo_fim                 DATE NOT NULL,
    municipio                   VARCHAR(120) NOT NULL DEFAULT 'AMERICANA',
    unidade                     VARCHAR(200),
    equipe_codigo               VARCHAR(40),
    equipe_nome                 VARCHAR(200),
    profissional                VARCHAR(200) DEFAULT 'Todos',
    cbo                         VARCHAR(200) DEFAULT 'Todos',
    filtros_personalizados      VARCHAR(200) DEFAULT 'Nenhum',
    dados_processados_em        TIMESTAMP,
    relatorio_gerado_em         TIMESTAMP,
    relatorio_gerado_por        VARCHAR(200),
    registros_identificados     INT,
    registros_nao_identificados INT,
    arquivo_origem              VARCHAR(300) NOT NULL,
    arquivo_path                VARCHAR(500),
    hash_arquivo                VARCHAR(64),
    importado_em                TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (tipo_relatorio, competencia, unidade, equipe_nome)
);

CREATE INDEX IF NOT EXISTS idx_esus_cargas_competencia
    ON esus_cargas (competencia, tipo_relatorio, unidade, equipe_nome);

COMMENT ON TABLE esus_cargas IS
    'Uma linha por arquivo CSV do e-SUS importado. arquivo_path = caminho físico no servidor.';
COMMENT ON COLUMN esus_cargas.arquivo_path IS
    'Caminho físico do CSV original: uploads/esus/{ano}/{mes}/{unidade}/arquivo.csv';

-- ----------------------------------------------------------------------------
-- 2. esus_indicadores_raw
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS esus_indicadores_raw (
    id          BIGSERIAL PRIMARY KEY,
    carga_id    BIGINT NOT NULL REFERENCES esus_cargas(id) ON DELETE CASCADE,
    secao       VARCHAR(150) NOT NULL,
    descricao   VARCHAR(300) NOT NULL,
    ordem       INT NOT NULL,
    valores     JSONB NOT NULL,
    UNIQUE (carga_id, secao, descricao)
);

CREATE INDEX IF NOT EXISTS idx_esus_raw_secao
    ON esus_indicadores_raw (carga_id, secao);
CREATE INDEX IF NOT EXISTS idx_esus_raw_valores_gin
    ON esus_indicadores_raw USING GIN (valores);

COMMENT ON TABLE esus_indicadores_raw IS
    'EAV: uma linha por (seção, descrição) de cada relatório e-SUS. valores = JSONB com colunas normalizadas.';

-- ----------------------------------------------------------------------------
-- 3. dados_consolidados
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dados_consolidados (
    id              BIGSERIAL PRIMARY KEY,
    competencia     DATE NOT NULL,
    municipio       VARCHAR(120) NOT NULL DEFAULT 'AMERICANA',
    unidade         VARCHAR(200) NOT NULL,
    equipe          VARCHAR(200) NOT NULL,
    versao_schema   VARCHAR(20) NOT NULL DEFAULT '3.1.0',
    dados_conteudo  JSONB NOT NULL,
    atualizado_em   TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (competencia, unidade, equipe)
);

CREATE INDEX IF NOT EXISTS idx_dados_consolidados_gin
    ON dados_consolidados USING GIN (dados_conteudo);

COMMENT ON TABLE dados_consolidados IS
    'Payload final /api/v1/dashboard/planejamento por competência/unidade/equipe.';

-- ----------------------------------------------------------------------------
-- 4. unidades_saude
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unidades_saude (
    id          BIGSERIAL PRIMARY KEY,
    codigo      VARCHAR(40) UNIQUE NOT NULL,
    nome        VARCHAR(200) NOT NULL,
    tipo        VARCHAR(40) CHECK (tipo IN ('APS','MAC','Hospitalar','Misto')),
    cnes        VARCHAR(20),
    status      VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em   TIMESTAMP NOT NULL DEFAULT now()
);

COMMENT ON TABLE unidades_saude IS
    'Cadastro de unidades de saúde do município. Substitui texto livre em esus_cargas.unidade no futuro.';

-- ----------------------------------------------------------------------------
-- 5. equipes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipes (
    id          BIGSERIAL PRIMARY KEY,
    codigo      VARCHAR(40) UNIQUE NOT NULL,
    nome        VARCHAR(200) NOT NULL,
    unidade_id  BIGINT REFERENCES unidades_saude(id),
    tipo        VARCHAR(40) CHECK (tipo IN ('ESF','EAP','eSB','eMulti','Outra')),
    status      VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em   TIMESTAMP NOT NULL DEFAULT now()
);

COMMENT ON TABLE equipes IS
    'Cadastro de equipes. codigo = equipe_codigo do e-SUS.';

-- ----------------------------------------------------------------------------
-- 5b. procedimentos (mestre SIGTAP) + esus_procedimento_map (de-para e-SUS)
--     Colocado após cadastros (unidades/equipes) e antes do bloco SIA.
--     Ver TechSpec esus-sigtap-depara / ADR-002.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS procedimentos (
    id                 BIGSERIAL PRIMARY KEY,
    codigo_sigtap      VARCHAR(20) NOT NULL UNIQUE,
    descricao          TEXT NOT NULL,
    tipo               VARCHAR(40),
    tabela_referencia  VARCHAR(40) NOT NULL DEFAULT 'SIGTAP',
    status             VARCHAR(20) NOT NULL DEFAULT 'ativo',
    fonte              VARCHAR(20) NOT NULL DEFAULT 'seed',
    criado_em          TIMESTAMP NOT NULL DEFAULT now(),
    atualizado_em      TIMESTAMP NOT NULL DEFAULT now()
);

COMMENT ON TABLE procedimentos IS
    'Catálogo mestre de procedimentos (SIGTAP / SUS Paulista). Soft-delete via status.';

-- Upgrade path when procedimentos already existed (ex.: sync MySQL) without atualizado_em/fonte
ALTER TABLE procedimentos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT now();
ALTER TABLE procedimentos ADD COLUMN IF NOT EXISTS fonte VARCHAR(20) DEFAULT 'mysql_sync';

CREATE TABLE IF NOT EXISTS esus_procedimento_map (
    id               BIGSERIAL PRIMARY KEY,
    secao            TEXT NOT NULL,
    descricao_esus   TEXT NOT NULL,
    procedimento_id  BIGINT NOT NULL REFERENCES procedimentos(id),
    origem           VARCHAR(20) NOT NULL
                     CHECK (origem IN ('seed', 'nativo_sigtap', 'manual')),
    status           VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em        TIMESTAMP NOT NULL DEFAULT now(),
    atualizado_em    TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (secao, descricao_esus)
);

CREATE INDEX IF NOT EXISTS idx_esus_procedimento_map_status
    ON esus_procedimento_map (status);

COMMENT ON TABLE esus_procedimento_map IS
    'De-para: label e-SUS (secao + descricao_esus exatos) → procedimentos.id. Soft-delete via status.';

-- Shared resolve: e-SUS raw × active map × active procedimentos (silent skip unmapped)
-- Used by Node export and Python consolidator (ADR-004).
CREATE OR REPLACE FUNCTION resolve_mapped_procedures(
    p_competencia date,
    p_unidade text,
    p_equipe text
)
RETURNS TABLE (
    secao text,
    descricao_esus text,
    codigo_sigtap varchar,
    descricao_sigtap text,
    quantidade int
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        r.secao::text,
        r.descricao::text AS descricao_esus,
        p.codigo_sigtap,
        p.descricao::text AS descricao_sigtap,
        COALESCE(SUM((r.valores->>'quantidade')::int), 0)::int AS quantidade
    FROM esus_indicadores_raw r
    JOIN esus_cargas c ON c.id = r.carga_id
    JOIN esus_procedimento_map m
      ON m.secao = r.secao
     AND m.descricao_esus = r.descricao
     AND m.status = 'ativo'
    JOIN procedimentos p
      ON p.id = m.procedimento_id
     AND p.status = 'ativo'
    WHERE c.competencia = p_competencia
      AND c.unidade = p_unidade
      AND c.equipe_nome = p_equipe
    GROUP BY r.secao, r.descricao, p.codigo_sigtap, p.descricao
    ORDER BY r.secao, r.descricao;
$$;

COMMENT ON FUNCTION resolve_mapped_procedures(date, text, text) IS
    'Shared e-SUS→SIGTAP resolve. Exact (secao, descricao); active maps only; silent skip unmapped.';

-- ----------------------------------------------------------------------------
-- 6. sia_sincronizacoes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sia_sincronizacoes (
    id              BIGSERIAL PRIMARY KEY,
    competencia     DATE NOT NULL,
    municipio       VARCHAR(120) NOT NULL DEFAULT 'AMERICANA',
    status          VARCHAR(20) NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','ok','parcial','erro')),
    registros       INT,
    erros           INT NOT NULL DEFAULT 0,
    sincronizado_em TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (competencia)
);

COMMENT ON TABLE sia_sincronizacoes IS
    'Uma linha por competência sincronizada do MySQL/XAMPP (SIA/SUS).';

-- ----------------------------------------------------------------------------
-- 7. sia_producao
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sia_producao (
    id                BIGSERIAL PRIMARY KEY,
    sincronizacao_id  BIGINT NOT NULL REFERENCES sia_sincronizacoes(id) ON DELETE CASCADE,
    competencia       DATE NOT NULL,
    unidade           VARCHAR(200),
    codigo_sigtap     VARCHAR(20) NOT NULL,
    descricao         VARCHAR(300),
    quantidade        INT NOT NULL DEFAULT 0,
    valor_aprovado    NUMERIC(12,2),
    faixa_etaria      VARCHAR(20),
    sexo              CHAR(1) CHECK (sexo IN ('M','F','I')),
    cbo               VARCHAR(10),
    dados_extras      JSONB,
    UNIQUE (sincronizacao_id, unidade, codigo_sigtap, faixa_etaria, sexo, cbo)
);

CREATE INDEX IF NOT EXISTS idx_sia_producao_grupo
    ON sia_producao (competencia, unidade, codigo_sigtap);
CREATE INDEX IF NOT EXISTS idx_sia_producao_demografico
    ON sia_producao (competencia, faixa_etaria, sexo);
CREATE INDEX IF NOT EXISTS idx_sia_producao_cbo
    ON sia_producao (competencia, cbo);
CREATE INDEX IF NOT EXISTS idx_sia_producao_gin
    ON sia_producao USING GIN (dados_extras);

COMMENT ON TABLE sia_producao IS
    'Produção ambulatorial SIA/SUS. faixa_etaria/sexo/cbo são colunas relacionais para GROUP BY eficiente.';
COMMENT ON COLUMN sia_producao.faixa_etaria IS
    'Faixas: 0-4, 5-9, 10-14, 15-19, 20-29, 30-39, 40-49, 50-59, 60-69, 70-79, 80+';
COMMENT ON COLUMN sia_producao.dados_extras IS
    'Colunas adicionais do MySQL ainda não mapeadas — sem exigir migração de schema.';
