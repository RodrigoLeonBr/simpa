-- ============================================================================
-- SIMPA - Sistema Integrado de Monitoramento e Planejamento de Americana
-- Schema inicial PostgreSQL — Módulo 1 (Atenção Primária / e-SUS APS)
--
-- Baseado nos relatórios analíticos exportados do e-SUS APS:
--   1) Relatório de atendimento individual          -> tipo 'atendimento_individual'
--   2) Relatório de atendimento domiciliar           -> tipo 'atendimento_domiciliar'
--   3) Relatório de atendimento odontológico        -> tipo 'atendimento_odontologico'
--   4) Relatório de atividade coletiva               -> tipo 'atividade_coletiva'
--   5) Relatório de marcadores de consumo alimentar  -> tipo 'marcadores_consumo_alimentar'
--   6) Relatório de procedimentos individualizados   -> tipo 'procedimentos_individualizados'
--
-- Estratégia (Spec-Driven, ver PRD Seção 5):
--   esus_cargas            -> 1 linha por arquivo importado (metadados da carga)
--   esus_indicadores_raw   -> EAV genérico: 1 linha por (seção, descrição) do relatório,
--                              com os valores numéricos em JSONB. Espelha fielmente
--                              a estrutura "Descrição;Col1;Col2;..." de cada seção do CSV.
--   dados_consolidados     -> payload final por competência/unidade/equipe, no formato
--                              do contrato JSON da Seção 5 do PRD (preenchido pelo ETL
--                              a partir de esus_indicadores_raw).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. esus_cargas — controle de importação (1 linha por arquivo de relatório)
-- ----------------------------------------------------------------------------
CREATE TABLE esus_cargas (
    id                          BIGSERIAL PRIMARY KEY,

    tipo_relatorio              VARCHAR(60) NOT NULL CHECK (tipo_relatorio IN (
                                    'atendimento_individual',
                                    'atendimento_domiciliar',
                                    'atendimento_odontologico',
                                    'atividade_coletiva',
                                    'marcadores_consumo_alimentar',
                                    'procedimentos_individualizados'
                                )),

    -- Competência de referência (1º dia do mês do período do relatório)
    competencia                 DATE NOT NULL,
    periodo_inicio               DATE NOT NULL,
    periodo_fim                  DATE NOT NULL,

    -- Identificação organizacional (cabeçalho do relatório)
    municipio                   VARCHAR(120) NOT NULL DEFAULT 'AMERICANA',
    unidade                     VARCHAR(200),          -- ex: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO'
    equipe_codigo               VARCHAR(40),           -- ex: '0002200376'
    equipe_nome                 VARCHAR(200),          -- ex: 'EQUIPE 9 EAP' ou 'Todas'
    profissional                VARCHAR(200) DEFAULT 'Todos',
    cbo                         VARCHAR(200) DEFAULT 'Todos',
    filtros_personalizados      VARCHAR(200) DEFAULT 'Nenhum',

    -- Metadados de geração (rodapé do relatório)
    dados_processados_em        TIMESTAMP,
    relatorio_gerado_em         TIMESTAMP,
    relatorio_gerado_por        VARCHAR(200),

    -- Indicadores de "Resumo de produção"
    registros_identificados      INT,
    registros_nao_identificados  INT,

    -- Rastreabilidade do arquivo de origem
    arquivo_origem              VARCHAR(300) NOT NULL,
    hash_arquivo                VARCHAR(64),
    importado_em                TIMESTAMP NOT NULL DEFAULT now(),

    UNIQUE (tipo_relatorio, competencia, unidade, equipe_nome)
);

CREATE INDEX idx_esus_cargas_competencia ON esus_cargas (competencia, tipo_relatorio, unidade, equipe_nome);

COMMENT ON TABLE esus_cargas IS 'Uma linha por arquivo de relatório analítico do e-SUS importado (Fase 1: upload manual de .csv).';
COMMENT ON COLUMN esus_cargas.competencia IS 'Primeiro dia do mês de referência do relatório (ex: 2026-05-01).';
COMMENT ON COLUMN esus_cargas.equipe_nome IS 'Nome da equipe ou "Todas" quando o relatório não é filtrado por equipe.';

-- ----------------------------------------------------------------------------
-- 2. esus_indicadores_raw — indicadores brutos (EAV genérico por seção do CSV)
-- ----------------------------------------------------------------------------
CREATE TABLE esus_indicadores_raw (
    id          BIGSERIAL PRIMARY KEY,
    carga_id    BIGINT NOT NULL REFERENCES esus_cargas(id) ON DELETE CASCADE,

    secao       VARCHAR(150) NOT NULL,   -- ex: 'Turno', 'Faixa etária', 'Temas para saúde'
    descricao   VARCHAR(300) NOT NULL,   -- ex: 'Manhã', '05 a 09 anos', 'K02 - CÁRIE DENTÁRIA'
    ordem       INT NOT NULL,            -- posição original na seção (preserva ordem de exibição)

    -- Valores da linha, com chaves normalizadas a partir do cabeçalho da seção
    -- ex: {"quantidade": 108}
    --     {"masculino": 7, "feminino": 6, "indeterminado": 0, "nao_informado": 0}
    --     {"quantidade_avaliada": 58, "quantidade_solicitada": 96}
    valores     JSONB NOT NULL,

    UNIQUE (carga_id, secao, descricao)
);

CREATE INDEX idx_esus_raw_secao       ON esus_indicadores_raw (carga_id, secao);
CREATE INDEX idx_esus_raw_valores_gin ON esus_indicadores_raw USING GIN (valores);

COMMENT ON TABLE esus_indicadores_raw IS 'Espelha as tabelas "Descrição;Valor1;Valor2;..." de cada seção dos relatórios analíticos do e-SUS.';

-- ----------------------------------------------------------------------------
-- 3. dados_consolidados — payload final (contrato Seção 5 do PRD)
-- ----------------------------------------------------------------------------
CREATE TABLE dados_consolidados (
    id              BIGSERIAL PRIMARY KEY,

    competencia     DATE NOT NULL,
    municipio       VARCHAR(120) NOT NULL DEFAULT 'AMERICANA',
    unidade         VARCHAR(200) NOT NULL,
    equipe          VARCHAR(200) NOT NULL,

    versao_schema   VARCHAR(20) NOT NULL DEFAULT '3.0.0',

    -- Estrutura completa conforme contrato /api/v1/dashboard/planejamento
    -- (chaves: kpis_gerais, modulos.atencao_primaria_esus, modulos.ambulatorial_sia,
    --  modulos.hospitalar_sihd, modulos.elementos_futuros)
    dados_conteudo  JSONB NOT NULL,

    atualizado_em   TIMESTAMP NOT NULL DEFAULT now(),

    UNIQUE (competencia, unidade, equipe)
);

CREATE INDEX idx_dados_consolidados_gin ON dados_consolidados USING GIN (dados_conteudo);

COMMENT ON TABLE dados_consolidados IS 'Payload final por competência/unidade/equipe, consumido pela API (/api/v1/dashboard/planejamento). Populado pelo ETL a partir de esus_indicadores_raw (e, futuramente, ambulatorial_sia e hospitalar_sihd).';