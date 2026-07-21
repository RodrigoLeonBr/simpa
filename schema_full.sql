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
                                    'atendimento_domiciliar',
                                    'atendimento_odontologico',
                                    'atividade_coletiva',
                                    'marcadores_consumo_alimentar',
                                    'procedimentos_individualizados',
                                    'cadastro_individual'
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
    estabelecimento_id          BIGINT,
    equipe_id                   BIGINT,
    UNIQUE (tipo_relatorio, competencia, unidade, equipe_nome)
);

CREATE INDEX IF NOT EXISTS idx_esus_cargas_competencia
    ON esus_cargas (competencia, tipo_relatorio, unidade, equipe_nome);
CREATE INDEX IF NOT EXISTS idx_esus_cargas_estabelecimento
    ON esus_cargas (competencia, estabelecimento_id, equipe_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_esus_cargas_ids
    ON esus_cargas (tipo_relatorio, competencia, estabelecimento_id, equipe_id)
    WHERE estabelecimento_id IS NOT NULL AND equipe_id IS NOT NULL;

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

-- populacao_cadastrada: criada em migration_012 (depende de estabelecimentos, migration_004).

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
    estabelecimento_id BIGINT,
    equipe_id          BIGINT,
    UNIQUE (competencia, unidade, equipe)
);

CREATE INDEX IF NOT EXISTS idx_dados_consolidados_gin
    ON dados_consolidados USING GIN (dados_conteudo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dados_consolidados_ids
    ON dados_consolidados (competencia, estabelecimento_id, equipe_id)
    WHERE estabelecimento_id IS NOT NULL AND equipe_id IS NOT NULL;

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

-- ----------------------------------------------------------------------------
-- 8. rubricas_sia (s_rub MySQL espelho)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rubricas_sia (
    codigo_rubrica  VARCHAR(4) PRIMARY KEY,
    descricao       VARCHAR(160) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'ativo',
    sincronizado_em TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rubricas_sia_status_descricao
    ON rubricas_sia (status, descricao);

COMMENT ON TABLE rubricas_sia IS
    'Espelho read-only de s_rub (MySQL/XAMPP). codigo_rubrica = RUB_ID canônico 4 chars.';

-- ----------------------------------------------------------------------------
-- 9. sih_sincronizacoes (migration_013)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sih_sincronizacoes (
    id                BIGSERIAL    PRIMARY KEY,
    competencia       DATE         NOT NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'pendente'
                          CONSTRAINT chk_sih_sync_status
                          CHECK (status IN ('ok', 'parcial', 'erro', 'pendente')),
    qtd_internacoes   INT          NOT NULL DEFAULT 0,
    qtd_procedimentos INT          NOT NULL DEFAULT 0,
    orphan_cnes       INT          NOT NULL DEFAULT 0,
    erros             INT          NOT NULL DEFAULT 0,
    sincronizado_em   TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sih_sync_competencia
    ON sih_sincronizacoes (competencia);

COMMENT ON TABLE sih_sincronizacoes IS
    'Registro de cada importação SIHD por competência. Uma linha por competência.';

-- ----------------------------------------------------------------------------
-- 10. sih_internacoes (migration_013)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sih_internacoes (
    id                  BIGSERIAL     PRIMARY KEY,
    sincronizacao_id    BIGINT        NOT NULL
                            REFERENCES sih_sincronizacoes(id) ON DELETE CASCADE,
    competencia         DATE          NOT NULL,
    cnes                VARCHAR(7)    NOT NULL,
    estabelecimento_id  INT           REFERENCES estabelecimentos(id),
    proc_principal      VARCHAR(10),
    diag_principal      VARCHAR(4),
    complexidade        VARCHAR(2),
    financiamento       VARCHAR(2),
    motivo_saida        VARCHAR(2),
    sexo                VARCHAR(1),
    qtd_aih             INT           NOT NULL DEFAULT 0,
    total_diarias       INT           NOT NULL DEFAULT 0,
    total_diarias_uti   INT           NOT NULL DEFAULT 0,
    total_valor         NUMERIC(15,2) NOT NULL DEFAULT 0,
    media_idade         NUMERIC(5,2),
    media_diarias       NUMERIC(5,2)
);

CREATE INDEX IF NOT EXISTS idx_sih_int_cns_cmp
    ON sih_internacoes (competencia, cnes);
CREATE INDEX IF NOT EXISTS idx_sih_int_estab
    ON sih_internacoes (competencia, estabelecimento_id);
CREATE INDEX IF NOT EXISTS idx_sih_int_diag
    ON sih_internacoes (competencia, diag_principal);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sih_int_grain
    ON sih_internacoes
    (sincronizacao_id, cnes,
     COALESCE(proc_principal, ''),
     COALESCE(diag_principal, ''),
     COALESCE(complexidade, ''),
     COALESCE(financiamento, ''),
     COALESCE(motivo_saida, ''),
     COALESCE(sexo, ''));

COMMENT ON TABLE sih_internacoes IS
    'Internações SIHD (s_aih) agregadas. financiamento = 2 chars = RUB_ID direto.';

-- ----------------------------------------------------------------------------
-- 11. sih_procedimentos (migration_013)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sih_procedimentos (
    id                    BIGSERIAL     PRIMARY KEY,
    sincronizacao_id      BIGINT        NOT NULL
                              REFERENCES sih_sincronizacoes(id) ON DELETE CASCADE,
    competencia           DATE          NOT NULL,
    cnes                  VARCHAR(7)    NOT NULL,
    estabelecimento_id    INT           REFERENCES estabelecimentos(id),
    proc_detalhado        VARCHAR(10),
    cbo_profissional      VARCHAR(6),
    financiamento_detalhe VARCHAR(2),
    qtd_aih_distintas     INT           NOT NULL DEFAULT 0,
    total_quantidade      INT           NOT NULL DEFAULT 0,
    total_valor_item      NUMERIC(15,2) NOT NULL DEFAULT 0,
    qtd_linhas            INT           NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sih_proc_cns_cmp
    ON sih_procedimentos (competencia, cnes);
CREATE INDEX IF NOT EXISTS idx_sih_proc_estab
    ON sih_procedimentos (competencia, estabelecimento_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sih_proc_grain
    ON sih_procedimentos
    (sincronizacao_id, cnes,
     COALESCE(proc_detalhado, ''),
     COALESCE(cbo_profissional, ''),
     COALESCE(financiamento_detalhe, ''));

COMMENT ON TABLE sih_procedimentos IS
    'Procedimentos por internação SIHD (s_aih_pa) agregados.';
