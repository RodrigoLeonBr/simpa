-- ============================================================================
-- SIMPA — Widgets Hospitalar (perfil='Hospitalar') — export para outro servidor
-- Gerado de: painel_metricas_catalogo + painel_widgets
-- metrica_id/spark_metrica_id resolvidos por chave (SERIAL difere entre bancos).
-- Aplicar UTF-8-safe:  docker cp este.sql <container>:/tmp/w.sql
--                      docker exec <container> psql -U postgres -d simpa -f /tmp/w.sql
-- ============================================================================
BEGIN;

INSERT INTO painel_metricas_catalogo (chave,fonte_tipo,label,descricao,tipo_relatorio,secao,descricao_linha,campo_json,agregacao,sql_template,status) VALUES ('esus.procedimentos.individualizados.dados.gerais.escuta.inicial.orientacao.quantidade','esus_raw','Dados gerais · Escuta inicial / Orientação (quantidade)','Descoberta automática de e-SUS (procedimentos_individualizados)','procedimentos_individualizados','Dados gerais','Escuta inicial / Orientação','quantidade','valor_unico','SELECT NULLIF(r.valores->>''quantidade'', '''')::numeric AS valor
FROM esus_cargas c
JOIN esus_indicadores_raw r ON r.carga_id = c.id
WHERE c.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR c.estabelecimento_id = :estabelecimento_id::bigint)
  AND (:equipe_id::bigint IS NULL OR c.equipe_id = :equipe_id::bigint)
  AND c.tipo_relatorio = ''procedimentos_individualizados''
  AND r.secao = ''Dados gerais''
  AND r.descricao = ''Escuta inicial / Orientação''
LIMIT 1','ativo') ON CONFLICT (chave) DO UPDATE SET fonte_tipo=EXCLUDED.fonte_tipo,label=EXCLUDED.label,descricao=EXCLUDED.descricao,tipo_relatorio=EXCLUDED.tipo_relatorio,secao=EXCLUDED.secao,descricao_linha=EXCLUDED.descricao_linha,campo_json=EXCLUDED.campo_json,agregacao=EXCLUDED.agregacao,sql_template=EXCLUDED.sql_template,status=EXCLUDED.status;
INSERT INTO painel_metricas_catalogo (chave,fonte_tipo,label,descricao,tipo_relatorio,secao,descricao_linha,campo_json,agregacao,sql_template,status) VALUES ('sih.historico_mensal','sih','Série histórica — internações mensais','AIH por competência (até 12 meses).',NULL,NULL,NULL,'valor','historico','
SELECT to_char(si.competencia, ''YYYY-MM'') AS competencia,
       SUM(si.qtd_aih)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia <= :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY si.competencia
ORDER BY si.competencia
LIMIT 12
','ativo') ON CONFLICT (chave) DO UPDATE SET fonte_tipo=EXCLUDED.fonte_tipo,label=EXCLUDED.label,descricao=EXCLUDED.descricao,tipo_relatorio=EXCLUDED.tipo_relatorio,secao=EXCLUDED.secao,descricao_linha=EXCLUDED.descricao_linha,campo_json=EXCLUDED.campo_json,agregacao=EXCLUDED.agregacao,sql_template=EXCLUDED.sql_template,status=EXCLUDED.status;
INSERT INTO painel_metricas_catalogo (chave,fonte_tipo,label,descricao,tipo_relatorio,secao,descricao_linha,campo_json,agregacao,sql_template,status) VALUES ('sih.internacoes_por_carater','sih','Internações por caráter','AIH por caráter de internação (eletiva / urgência / não informado).',NULL,NULL,NULL,'valor','ranking_unidade','
SELECT
    CASE sa.carater_internacao
        WHEN ''01'' THEN ''Eletiva''
        WHEN ''02'' THEN ''Urgência''
        ELSE COALESCE(NULLIF(sa.carater_internacao, ''''), ''Não informado'')
    END                         AS unidade,
    COUNT(*)::bigint            AS valor
FROM sih_aih sa
WHERE sa.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sa.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY 1
ORDER BY valor DESC
','ativo') ON CONFLICT (chave) DO UPDATE SET fonte_tipo=EXCLUDED.fonte_tipo,label=EXCLUDED.label,descricao=EXCLUDED.descricao,tipo_relatorio=EXCLUDED.tipo_relatorio,secao=EXCLUDED.secao,descricao_linha=EXCLUDED.descricao_linha,campo_json=EXCLUDED.campo_json,agregacao=EXCLUDED.agregacao,sql_template=EXCLUDED.sql_template,status=EXCLUDED.status;
INSERT INTO painel_metricas_catalogo (chave,fonte_tipo,label,descricao,tipo_relatorio,secao,descricao_linha,campo_json,agregacao,sql_template,status) VALUES ('sih.internacoes_por_cid','sih','Internações por capítulo CID-10','Top 10 capítulos CID-10 por número de AIH na competência.',NULL,NULL,NULL,'valor','ranking_unidade','
SELECT LEFT(si.diag_principal, 1) AS unidade,
       SUM(si.qtd_aih)::bigint    AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
  AND si.diag_principal IS NOT NULL
  AND si.diag_principal <> ''''
GROUP BY LEFT(si.diag_principal, 1)
ORDER BY valor DESC
LIMIT 10
','ativo') ON CONFLICT (chave) DO UPDATE SET fonte_tipo=EXCLUDED.fonte_tipo,label=EXCLUDED.label,descricao=EXCLUDED.descricao,tipo_relatorio=EXCLUDED.tipo_relatorio,secao=EXCLUDED.secao,descricao_linha=EXCLUDED.descricao_linha,campo_json=EXCLUDED.campo_json,agregacao=EXCLUDED.agregacao,sql_template=EXCLUDED.sql_template,status=EXCLUDED.status;
INSERT INTO painel_metricas_catalogo (chave,fonte_tipo,label,descricao,tipo_relatorio,secao,descricao_linha,campo_json,agregacao,sql_template,status) VALUES ('sih.media_permanencia','sih','Permanência média (dias)','Média de diárias por AIH na competência.',NULL,NULL,NULL,'valor','valor_unico','
SELECT ROUND(
    SUM(si.total_diarias)::numeric / NULLIF(SUM(si.qtd_aih), 0),
    1
) AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
','ativo') ON CONFLICT (chave) DO UPDATE SET fonte_tipo=EXCLUDED.fonte_tipo,label=EXCLUDED.label,descricao=EXCLUDED.descricao,tipo_relatorio=EXCLUDED.tipo_relatorio,secao=EXCLUDED.secao,descricao_linha=EXCLUDED.descricao_linha,campo_json=EXCLUDED.campo_json,agregacao=EXCLUDED.agregacao,sql_template=EXCLUDED.sql_template,status=EXCLUDED.status;
INSERT INTO painel_metricas_catalogo (chave,fonte_tipo,label,descricao,tipo_relatorio,secao,descricao_linha,campo_json,agregacao,sql_template,status) VALUES ('sih.pct_diarias_uti','sih','Ocupação UTI (%)','Diárias UTI sobre total de diárias × 100.',NULL,NULL,NULL,'valor','valor_unico','
SELECT ROUND(
    SUM(si.total_diarias_uti)::numeric * 100.0
    / NULLIF(SUM(si.total_diarias), 0),
    2
) AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
','ativo') ON CONFLICT (chave) DO UPDATE SET fonte_tipo=EXCLUDED.fonte_tipo,label=EXCLUDED.label,descricao=EXCLUDED.descricao,tipo_relatorio=EXCLUDED.tipo_relatorio,secao=EXCLUDED.secao,descricao_linha=EXCLUDED.descricao_linha,campo_json=EXCLUDED.campo_json,agregacao=EXCLUDED.agregacao,sql_template=EXCLUDED.sql_template,status=EXCLUDED.status;
INSERT INTO painel_metricas_catalogo (chave,fonte_tipo,label,descricao,tipo_relatorio,secao,descricao_linha,campo_json,agregacao,sql_template,status) VALUES ('sih.pct_obito_cid','sih','AIH com CID de óbito (%)','Percentual de AIH com cid_obito preenchido na competência.',NULL,NULL,NULL,'valor','valor_unico','
SELECT ROUND(
    SUM(CASE WHEN sa.cid_obito IS NOT NULL AND sa.cid_obito <> '''' THEN 1 ELSE 0 END)::numeric
    * 100.0 / NULLIF(COUNT(*), 0),
    2
) AS valor
FROM sih_aih sa
WHERE sa.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sa.estabelecimento_id = :estabelecimento_id::bigint)
','ativo') ON CONFLICT (chave) DO UPDATE SET fonte_tipo=EXCLUDED.fonte_tipo,label=EXCLUDED.label,descricao=EXCLUDED.descricao,tipo_relatorio=EXCLUDED.tipo_relatorio,secao=EXCLUDED.secao,descricao_linha=EXCLUDED.descricao_linha,campo_json=EXCLUDED.campo_json,agregacao=EXCLUDED.agregacao,sql_template=EXCLUDED.sql_template,status=EXCLUDED.status;
INSERT INTO painel_metricas_catalogo (chave,fonte_tipo,label,descricao,tipo_relatorio,secao,descricao_linha,campo_json,agregacao,sql_template,status) VALUES ('sih.permanencia_media_real','sih','Permanência média real (dias)','Média de (dt_saida − dt_internacao) por AIH com ambas as datas preenchidas.',NULL,NULL,NULL,'valor','valor_unico','
SELECT ROUND(AVG(sa.dt_saida - sa.dt_internacao)::numeric, 1) AS valor
FROM sih_aih sa
WHERE sa.competencia = :competencia::date
  AND sa.dt_internacao IS NOT NULL
  AND sa.dt_saida IS NOT NULL
  AND (:estabelecimento_id::bigint IS NULL
       OR sa.estabelecimento_id = :estabelecimento_id::bigint)
','ativo') ON CONFLICT (chave) DO UPDATE SET fonte_tipo=EXCLUDED.fonte_tipo,label=EXCLUDED.label,descricao=EXCLUDED.descricao,tipo_relatorio=EXCLUDED.tipo_relatorio,secao=EXCLUDED.secao,descricao_linha=EXCLUDED.descricao_linha,campo_json=EXCLUDED.campo_json,agregacao=EXCLUDED.agregacao,sql_template=EXCLUDED.sql_template,status=EXCLUDED.status;
INSERT INTO painel_metricas_catalogo (chave,fonte_tipo,label,descricao,tipo_relatorio,secao,descricao_linha,campo_json,agregacao,sql_template,status) VALUES ('sih.taxa_mortalidade','sih','Taxa de mortalidade (%)','AIH com motivo de saída óbito (31 ou 32) sobre total de AIH × 100.',NULL,NULL,NULL,'valor','valor_unico','
SELECT ROUND(
    SUM(CASE WHEN si.motivo_saida IN (''31'',''32'') THEN si.qtd_aih ELSE 0 END)::numeric
    * 100.0 / NULLIF(SUM(si.qtd_aih), 0),
    2
) AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
','ativo') ON CONFLICT (chave) DO UPDATE SET fonte_tipo=EXCLUDED.fonte_tipo,label=EXCLUDED.label,descricao=EXCLUDED.descricao,tipo_relatorio=EXCLUDED.tipo_relatorio,secao=EXCLUDED.secao,descricao_linha=EXCLUDED.descricao_linha,campo_json=EXCLUDED.campo_json,agregacao=EXCLUDED.agregacao,sql_template=EXCLUDED.sql_template,status=EXCLUDED.status;
INSERT INTO painel_metricas_catalogo (chave,fonte_tipo,label,descricao,tipo_relatorio,secao,descricao_linha,campo_json,agregacao,sql_template,status) VALUES ('sih.total_aih','sih','Total de internações (AIH)','Soma de AIH distintas no grão gerencial da competência.',NULL,NULL,NULL,'valor','sum','
SELECT SUM(si.qtd_aih)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
','ativo') ON CONFLICT (chave) DO UPDATE SET fonte_tipo=EXCLUDED.fonte_tipo,label=EXCLUDED.label,descricao=EXCLUDED.descricao,tipo_relatorio=EXCLUDED.tipo_relatorio,secao=EXCLUDED.secao,descricao_linha=EXCLUDED.descricao_linha,campo_json=EXCLUDED.campo_json,agregacao=EXCLUDED.agregacao,sql_template=EXCLUDED.sql_template,status=EXCLUDED.status;
INSERT INTO painel_metricas_catalogo (chave,fonte_tipo,label,descricao,tipo_relatorio,secao,descricao_linha,campo_json,agregacao,sql_template,status) VALUES ('sih.total_diarias_uti','sih','Diárias em UTI','Soma de diárias em UTI na competência.',NULL,NULL,NULL,'valor','sum','
SELECT SUM(si.total_diarias_uti)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
','ativo') ON CONFLICT (chave) DO UPDATE SET fonte_tipo=EXCLUDED.fonte_tipo,label=EXCLUDED.label,descricao=EXCLUDED.descricao,tipo_relatorio=EXCLUDED.tipo_relatorio,secao=EXCLUDED.secao,descricao_linha=EXCLUDED.descricao_linha,campo_json=EXCLUDED.campo_json,agregacao=EXCLUDED.agregacao,sql_template=EXCLUDED.sql_template,status=EXCLUDED.status;
INSERT INTO painel_metricas_catalogo (chave,fonte_tipo,label,descricao,tipo_relatorio,secao,descricao_linha,campo_json,agregacao,sql_template,status) VALUES ('sih.total_valor','sih','Valor total das AIH','Soma do valor total das internações (VALOR_TOTAL_AIH pré-calculado pelo SIHD).',NULL,NULL,NULL,'valor','sum','
SELECT SUM(si.total_valor) AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
','ativo') ON CONFLICT (chave) DO UPDATE SET fonte_tipo=EXCLUDED.fonte_tipo,label=EXCLUDED.label,descricao=EXCLUDED.descricao,tipo_relatorio=EXCLUDED.tipo_relatorio,secao=EXCLUDED.secao,descricao_linha=EXCLUDED.descricao_linha,campo_json=EXCLUDED.campo_json,agregacao=EXCLUDED.agregacao,sql_template=EXCLUDED.sql_template,status=EXCLUDED.status;
INSERT INTO painel_widgets (slug,perfil,layout,ordem,tipo,titulo,subtitulo,formato,metrica_id,fonte_config,spark_metrica_id,spark_config,sql_preview,delta_config,status,sql_override,spark_sql_override) VALUES ('ocupacao_tipo_leito','Hospitalar','A',1,'grafico_ranking','Ocupação por Tipo de Leito',NULL,'numero',(SELECT id FROM painel_metricas_catalogo WHERE chave='esus.procedimentos.individualizados.dados.gerais.escuta.inicial.orientacao.quantidade'),'{}',NULL,NULL,'WITH dados_competencia AS (
    SELECT 
        CASE 
            WHEN LENGTH(:competencia::text) = 6 THEN TO_DATE(:competencia::text || ''01'', ''YYYYMMDD'')
            WHEN LENGTH(:competencia::text) = 8 THEN TO_DATE(:competencia::text, ''YYYYMMDD'')
            ELSE TO_DATE(:competencia::text, ''YYYY-MM-DD'')
        END AS dt_comp
),
comp_processada AS (
    SELECT 
        dc.dt_comp,
        TO_CHAR(dc.dt_comp, ''YYYYMM'') AS comp_yyyymm,
        EXTRACT(DAY FROM (DATE_TRUNC(''month'', dc.dt_comp) + INTERVAL ''1 month - 1 day''))::numeric AS dias_no_mes
    FROM dados_competencia dc
),
leitos_cadastrados AS (
    SELECT 
        v.estabelecimento_id,
        COALESCE((v.leitos->>''clinico'')::numeric, 0) AS leitos_clinico,
        COALESCE((v.leitos->>''cirurgico'')::numeric, 0) AS leitos_cirurgico,
        COALESCE((v.leitos->>''obstetrico'')::numeric, 0) AS leitos_obstetrico,
        COALESCE((v.leitos->>''pediatrico'')::numeric, 0) AS leitos_pediatrico,
        COALESCE((v.leitos->>''uti_adulto'')::numeric, 0) AS leitos_uti_adulto,
        COALESCE((v.leitos->>''uti_neonatal'')::numeric, 0) AS leitos_uti_neonatal
    FROM enriquecimento_hospitalar_leitos_vigencia v
    CROSS JOIN comp_processada cp
    WHERE cp.comp_yyyymm BETWEEN v.vigencia_inicio AND v.vigencia_fim
      AND (:estabelecimento_id::bigint IS NULL OR v.estabelecimento_id = :estabelecimento_id::bigint)
),
-- Step 1: Classifica cada AIH em uma categoria de leito
aihs_classificadas AS (
    SELECT 
        sa.estabelecimento_id,
        CASE 
            WHEN sa.diarias_uti > 0 AND sa.idade > 12 THEN ''UTI Adulto''
            WHEN sa.diarias_uti > 0 AND sa.idade <= 12 THEN ''UTI Neonatal / Pediátrica''
            WHEN (sa.diarias_uti IS NULL OR sa.diarias_uti = 0) AND sa.idade <= 12 THEN ''Leito Pediátrico''
            WHEN (sa.diarias_uti IS NULL OR sa.diarias_uti = 0) AND sa.idade > 12 AND sa.diag_principal >= ''O00'' AND sa.diag_principal <= ''O99'' THEN ''Leito Obstétrico''
            WHEN (sa.diarias_uti IS NULL OR sa.diarias_uti = 0) AND sa.idade > 12 AND sa.carater_internacao = ''01'' THEN ''Leito Cirúrgico''
            ELSE ''Leito Clínico''
        END AS tipo_leito,
        COALESCE(
            CASE 
                WHEN sa.diarias_uti > 0 THEN sa.diarias_uti 
                ELSE sa.diarias 
            END, 
            0
        ) AS qtd_diarias
    FROM sih_aih sa
    CROSS JOIN comp_processada cp
    WHERE sa.competencia = cp.dt_comp
      AND (:estabelecimento_id::bigint IS NULL OR sa.estabelecimento_id = :estabelecimento_id::bigint)
),
-- Step 2: Agrupa o total de diárias por tipo de leito
diarias_agregadas AS (
    SELECT 
        ac.tipo_leito,
        SUM(ac.qtd_diarias)::numeric AS total_diarias
    FROM aihs_classificadas ac
    GROUP BY ac.tipo_leito
),
-- Step 3: Cruza com a capacidade cadastrada na vigência
capacidade_leitos AS (
    SELECT ''UTI Adulto'' AS tipo_leito, SUM(l.leitos_uti_adulto) AS total_leitos FROM leitos_cadastrados l
    UNION ALL
    SELECT ''UTI Neonatal / Pediátrica'', SUM(l.leitos_uti_neonatal) FROM leitos_cadastrados l
    UNION ALL
    SELECT ''Leito Pediátrico'', SUM(l.leitos_pediatrico) FROM leitos_cadastrados l
    UNION ALL
    SELECT ''Leito Obstétrico'', SUM(l.leitos_obstetrico) FROM leitos_cadastrados l
    UNION ALL
    SELECT ''Leito Cirúrgico'', SUM(l.leitos_cirurgico) FROM leitos_cadastrados l
    UNION ALL
    SELECT ''Leito Clínico'', SUM(l.leitos_clinico) FROM leitos_cadastrados l
)
SELECT 
    c.tipo_leito AS unidade,
    ROUND(
        (COALESCE(d.total_diarias, 0) / NULLIF(c.total_leitos * cp.dias_no_mes, 0)) * 100.0,
        2
    ) AS valor
FROM capacidade_leitos c
LEFT JOIN diarias_agregadas d ON c.tipo_leito = d.tipo_leito
CROSS JOIN comp_processada cp
WHERE c.total_leitos > 0
ORDER BY valor DESC;',NULL,'ativo','WITH dados_competencia AS (
    SELECT 
        CASE 
            WHEN LENGTH(:competencia::text) = 6 THEN TO_DATE(:competencia::text || ''01'', ''YYYYMMDD'')
            WHEN LENGTH(:competencia::text) = 8 THEN TO_DATE(:competencia::text, ''YYYYMMDD'')
            ELSE TO_DATE(:competencia::text, ''YYYY-MM-DD'')
        END AS dt_comp
),
comp_processada AS (
    SELECT 
        dc.dt_comp,
        TO_CHAR(dc.dt_comp, ''YYYYMM'') AS comp_yyyymm,
        EXTRACT(DAY FROM (DATE_TRUNC(''month'', dc.dt_comp) + INTERVAL ''1 month - 1 day''))::numeric AS dias_no_mes
    FROM dados_competencia dc
),
leitos_cadastrados AS (
    SELECT 
        v.estabelecimento_id,
        COALESCE((v.leitos->>''clinico'')::numeric, 0) AS leitos_clinico,
        COALESCE((v.leitos->>''cirurgico'')::numeric, 0) AS leitos_cirurgico,
        COALESCE((v.leitos->>''obstetrico'')::numeric, 0) AS leitos_obstetrico,
        COALESCE((v.leitos->>''pediatrico'')::numeric, 0) AS leitos_pediatrico,
        COALESCE((v.leitos->>''uti_adulto'')::numeric, 0) AS leitos_uti_adulto,
        COALESCE((v.leitos->>''uti_neonatal'')::numeric, 0) AS leitos_uti_neonatal
    FROM enriquecimento_hospitalar_leitos_vigencia v
    CROSS JOIN comp_processada cp
    WHERE cp.comp_yyyymm BETWEEN v.vigencia_inicio AND v.vigencia_fim
      AND (:estabelecimento_id::bigint IS NULL OR v.estabelecimento_id = :estabelecimento_id::bigint)
),
-- Step 1: Classifica cada AIH em uma categoria de leito
aihs_classificadas AS (
    SELECT 
        sa.estabelecimento_id,
        CASE 
            WHEN sa.diarias_uti > 0 AND sa.idade > 12 THEN ''UTI Adulto''
            WHEN sa.diarias_uti > 0 AND sa.idade <= 12 THEN ''UTI Neonatal / Pediátrica''
            WHEN (sa.diarias_uti IS NULL OR sa.diarias_uti = 0) AND sa.idade <= 12 THEN ''Leito Pediátrico''
            WHEN (sa.diarias_uti IS NULL OR sa.diarias_uti = 0) AND sa.idade > 12 AND sa.diag_principal >= ''O00'' AND sa.diag_principal <= ''O99'' THEN ''Leito Obstétrico''
            WHEN (sa.diarias_uti IS NULL OR sa.diarias_uti = 0) AND sa.idade > 12 AND sa.carater_internacao = ''01'' THEN ''Leito Cirúrgico''
            ELSE ''Leito Clínico''
        END AS tipo_leito,
        COALESCE(
            CASE 
                WHEN sa.diarias_uti > 0 THEN sa.diarias_uti 
                ELSE sa.diarias 
            END, 
            0
        ) AS qtd_diarias
    FROM sih_aih sa
    CROSS JOIN comp_processada cp
    WHERE sa.competencia = cp.dt_comp
      AND (:estabelecimento_id::bigint IS NULL OR sa.estabelecimento_id = :estabelecimento_id::bigint)
),
-- Step 2: Agrupa o total de diárias por tipo de leito
diarias_agregadas AS (
    SELECT 
        ac.tipo_leito,
        SUM(ac.qtd_diarias)::numeric AS total_diarias
    FROM aihs_classificadas ac
    GROUP BY ac.tipo_leito
),
-- Step 3: Cruza com a capacidade cadastrada na vigência
capacidade_leitos AS (
    SELECT ''UTI Adulto'' AS tipo_leito, SUM(l.leitos_uti_adulto) AS total_leitos FROM leitos_cadastrados l
    UNION ALL
    SELECT ''UTI Neonatal / Pediátrica'', SUM(l.leitos_uti_neonatal) FROM leitos_cadastrados l
    UNION ALL
    SELECT ''Leito Pediátrico'', SUM(l.leitos_pediatrico) FROM leitos_cadastrados l
    UNION ALL
    SELECT ''Leito Obstétrico'', SUM(l.leitos_obstetrico) FROM leitos_cadastrados l
    UNION ALL
    SELECT ''Leito Cirúrgico'', SUM(l.leitos_cirurgico) FROM leitos_cadastrados l
    UNION ALL
    SELECT ''Leito Clínico'', SUM(l.leitos_clinico) FROM leitos_cadastrados l
)
SELECT 
    c.tipo_leito AS unidade,
    ROUND(
        (COALESCE(d.total_diarias, 0) / NULLIF(c.total_leitos * cp.dias_no_mes, 0)) * 100.0,
        2
    ) AS valor
FROM capacidade_leitos c
LEFT JOIN diarias_agregadas d ON c.tipo_leito = d.tipo_leito
CROSS JOIN comp_processada cp
WHERE c.total_leitos > 0
ORDER BY valor DESC;',NULL) ON CONFLICT (perfil,layout,slug) DO UPDATE SET ordem=EXCLUDED.ordem,tipo=EXCLUDED.tipo,titulo=EXCLUDED.titulo,subtitulo=EXCLUDED.subtitulo,formato=EXCLUDED.formato,metrica_id=EXCLUDED.metrica_id,fonte_config=EXCLUDED.fonte_config,spark_metrica_id=EXCLUDED.spark_metrica_id,spark_config=EXCLUDED.spark_config,sql_preview=EXCLUDED.sql_preview,delta_config=EXCLUDED.delta_config,status=EXCLUDED.status,sql_override=EXCLUDED.sql_override,spark_sql_override=EXCLUDED.spark_sql_override;
INSERT INTO painel_widgets (slug,perfil,layout,ordem,tipo,titulo,subtitulo,formato,metrica_id,fonte_config,spark_metrica_id,spark_config,sql_preview,delta_config,status,sql_override,spark_sql_override) VALUES ('ranking_cid','Hospitalar','A',2,'grafico_ranking','Internações por capítulo CID-10',NULL,'numero',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.internacoes_por_cid'),'{"limite": 10, "eixo_label": "unidade", "eixo_valor": "valor"}',NULL,NULL,'SELECT 
    CASE 
        WHEN LEFT(si.diag_principal, 1) BETWEEN ''A'' AND ''B'' THEN ''I. Algumas doenças infecciosas e parasitárias''
        WHEN si.diag_principal >= ''C00'' AND si.diag_principal <= ''D48'' THEN ''II. Neoplasias (tumores)''
        WHEN si.diag_principal >= ''D50'' AND si.diag_principal <= ''D89'' THEN ''III. Doenças sangue/órgãos hematopoiéticos''
        WHEN si.diag_principal >= ''E00'' AND si.diag_principal <= ''E90'' THEN ''IV. Doenças endócrinas, nutricionais e metabólicas''
        WHEN si.diag_principal >= ''F00'' AND si.diag_principal <= ''F99'' THEN ''V. Transtornos mentais e de comportamento''
        WHEN si.diag_principal >= ''G00'' AND si.diag_principal <= ''G99'' THEN ''VI. Doenças do sistema nervoso''
        WHEN si.diag_principal >= ''H00'' AND si.diag_principal <= ''H59'' THEN ''VII. Doenças do olho e anexos''
        WHEN si.diag_principal >= ''H60'' AND si.diag_principal <= ''H95'' THEN ''VIII. Doenças do ouvido e da apófise mastóide''
        WHEN si.diag_principal >= ''I00'' AND si.diag_principal <= ''I99'' THEN ''IX. Doenças do aparelho circulatório''
        WHEN si.diag_principal >= ''J00'' AND si.diag_principal <= ''J99'' THEN ''X. Doenças do aparelho respiratório''
        WHEN si.diag_principal >= ''K00'' AND si.diag_principal <= ''K93'' THEN ''XI. Doenças do aparelho digestivo''
        WHEN si.diag_principal >= ''L00'' AND si.diag_principal <= ''L99'' THEN ''XII. Doenças da pele e do tecido subcutâneo''
        WHEN si.diag_principal >= ''M00'' AND si.diag_principal <= ''M99'' THEN ''XIII. Doenças do sistema osteomuscular e tecido conjuntivo''
        WHEN si.diag_principal >= ''N00'' AND si.diag_principal <= ''N99'' THEN ''XIV. Doenças do aparelho geniturinário''
        WHEN si.diag_principal >= ''O00'' AND si.diag_principal <= ''O99'' THEN ''XV. Gravidez, parto e puerpério''
        WHEN si.diag_principal >= ''P00'' AND si.diag_principal <= ''P96'' THEN ''XVI. Algumas afecções originadas no período perinatal''
        WHEN si.diag_principal >= ''Q00'' AND si.diag_principal <= ''Q99'' THEN ''XVII. Malformações congênitas e deformidades cromossômicas''
        WHEN si.diag_principal >= ''R00'' AND si.diag_principal <= ''R99'' THEN ''XVIII. Sintomas, sinais e achados anômalos''
        WHEN si.diag_principal >= ''S00'' AND si.diag_principal <= ''T98'' THEN ''XIX. Lesões, envenenamentos e causas externas''
        WHEN si.diag_principal >= ''V01'' AND si.diag_principal <= ''Y98'' THEN ''XX. Causas externas de morbidade e mortalidade''
        WHEN si.diag_principal >= ''Z00'' AND si.diag_principal <= ''Z99'' THEN ''XXI. Contatos com serviços de saúde''
        WHEN si.diag_principal >= ''U00'' AND si.diag_principal <= ''U99'' THEN ''XXII. Códigos para fins especiais''
        ELSE ''Outros / Não Identificado''
    END AS unidade,
    SUM(si.qtd_aih)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR si.estabelecimento_id = :estabelecimento_id::bigint)
  AND si.diag_principal IS NOT NULL 
  AND si.diag_principal <> ''''
GROUP BY 1
ORDER BY valor DESC
LIMIT 10;',NULL,'ativo','SELECT 
    CASE 
        WHEN LEFT(si.diag_principal, 1) BETWEEN ''A'' AND ''B'' THEN ''I. Algumas doenças infecciosas e parasitárias''
        WHEN si.diag_principal >= ''C00'' AND si.diag_principal <= ''D48'' THEN ''II. Neoplasias (tumores)''
        WHEN si.diag_principal >= ''D50'' AND si.diag_principal <= ''D89'' THEN ''III. Doenças sangue/órgãos hematopoiéticos''
        WHEN si.diag_principal >= ''E00'' AND si.diag_principal <= ''E90'' THEN ''IV. Doenças endócrinas, nutricionais e metabólicas''
        WHEN si.diag_principal >= ''F00'' AND si.diag_principal <= ''F99'' THEN ''V. Transtornos mentais e de comportamento''
        WHEN si.diag_principal >= ''G00'' AND si.diag_principal <= ''G99'' THEN ''VI. Doenças do sistema nervoso''
        WHEN si.diag_principal >= ''H00'' AND si.diag_principal <= ''H59'' THEN ''VII. Doenças do olho e anexos''
        WHEN si.diag_principal >= ''H60'' AND si.diag_principal <= ''H95'' THEN ''VIII. Doenças do ouvido e da apófise mastóide''
        WHEN si.diag_principal >= ''I00'' AND si.diag_principal <= ''I99'' THEN ''IX. Doenças do aparelho circulatório''
        WHEN si.diag_principal >= ''J00'' AND si.diag_principal <= ''J99'' THEN ''X. Doenças do aparelho respiratório''
        WHEN si.diag_principal >= ''K00'' AND si.diag_principal <= ''K93'' THEN ''XI. Doenças do aparelho digestivo''
        WHEN si.diag_principal >= ''L00'' AND si.diag_principal <= ''L99'' THEN ''XII. Doenças da pele e do tecido subcutâneo''
        WHEN si.diag_principal >= ''M00'' AND si.diag_principal <= ''M99'' THEN ''XIII. Doenças do sistema osteomuscular e tecido conjuntivo''
        WHEN si.diag_principal >= ''N00'' AND si.diag_principal <= ''N99'' THEN ''XIV. Doenças do aparelho geniturinário''
        WHEN si.diag_principal >= ''O00'' AND si.diag_principal <= ''O99'' THEN ''XV. Gravidez, parto e puerpério''
        WHEN si.diag_principal >= ''P00'' AND si.diag_principal <= ''P96'' THEN ''XVI. Algumas afecções originadas no período perinatal''
        WHEN si.diag_principal >= ''Q00'' AND si.diag_principal <= ''Q99'' THEN ''XVII. Malformações congênitas e deformidades cromossômicas''
        WHEN si.diag_principal >= ''R00'' AND si.diag_principal <= ''R99'' THEN ''XVIII. Sintomas, sinais e achados anômalos''
        WHEN si.diag_principal >= ''S00'' AND si.diag_principal <= ''T98'' THEN ''XIX. Lesões, envenenamentos e causas externas''
        WHEN si.diag_principal >= ''V01'' AND si.diag_principal <= ''Y98'' THEN ''XX. Causas externas de morbidade e mortalidade''
        WHEN si.diag_principal >= ''Z00'' AND si.diag_principal <= ''Z99'' THEN ''XXI. Contatos com serviços de saúde''
        WHEN si.diag_principal >= ''U00'' AND si.diag_principal <= ''U99'' THEN ''XXII. Códigos para fins especiais''
        ELSE ''Outros / Não Identificado''
    END AS unidade,
    SUM(si.qtd_aih)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR si.estabelecimento_id = :estabelecimento_id::bigint)
  AND si.diag_principal IS NOT NULL 
  AND si.diag_principal <> ''''
GROUP BY 1
ORDER BY valor DESC
LIMIT 10;',NULL) ON CONFLICT (perfil,layout,slug) DO UPDATE SET ordem=EXCLUDED.ordem,tipo=EXCLUDED.tipo,titulo=EXCLUDED.titulo,subtitulo=EXCLUDED.subtitulo,formato=EXCLUDED.formato,metrica_id=EXCLUDED.metrica_id,fonte_config=EXCLUDED.fonte_config,spark_metrica_id=EXCLUDED.spark_metrica_id,spark_config=EXCLUDED.spark_config,sql_preview=EXCLUDED.sql_preview,delta_config=EXCLUDED.delta_config,status=EXCLUDED.status,sql_override=EXCLUDED.sql_override,spark_sql_override=EXCLUDED.spark_sql_override;
INSERT INTO painel_widgets (slug,perfil,layout,ordem,tipo,titulo,subtitulo,formato,metrica_id,fonte_config,spark_metrica_id,spark_config,sql_preview,delta_config,status,sql_override,spark_sql_override) VALUES ('total_aih','Hospitalar','A',3,'card','Total de internações',NULL,'numero',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.total_aih'),'{}',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.historico_mensal'),'{"campo": "valor", "limite": 12}','
SELECT SUM(si.qtd_aih)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
','{"tipo": "competencia_anterior", "campo": "total_aih"}','ativo',NULL,NULL) ON CONFLICT (perfil,layout,slug) DO UPDATE SET ordem=EXCLUDED.ordem,tipo=EXCLUDED.tipo,titulo=EXCLUDED.titulo,subtitulo=EXCLUDED.subtitulo,formato=EXCLUDED.formato,metrica_id=EXCLUDED.metrica_id,fonte_config=EXCLUDED.fonte_config,spark_metrica_id=EXCLUDED.spark_metrica_id,spark_config=EXCLUDED.spark_config,sql_preview=EXCLUDED.sql_preview,delta_config=EXCLUDED.delta_config,status=EXCLUDED.status,sql_override=EXCLUDED.sql_override,spark_sql_override=EXCLUDED.spark_sql_override;
INSERT INTO painel_widgets (slug,perfil,layout,ordem,tipo,titulo,subtitulo,formato,metrica_id,fonte_config,spark_metrica_id,spark_config,sql_preview,delta_config,status,sql_override,spark_sql_override) VALUES ('total_valor','Hospitalar','A',4,'card','Valor total AIH',NULL,'moeda',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.total_valor'),'{}',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.total_valor'),NULL,'
SELECT SUM(si.total_valor) AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
','{"tipo": "competencia_anterior", "campo": "total_valor"}','ativo',NULL,NULL) ON CONFLICT (perfil,layout,slug) DO UPDATE SET ordem=EXCLUDED.ordem,tipo=EXCLUDED.tipo,titulo=EXCLUDED.titulo,subtitulo=EXCLUDED.subtitulo,formato=EXCLUDED.formato,metrica_id=EXCLUDED.metrica_id,fonte_config=EXCLUDED.fonte_config,spark_metrica_id=EXCLUDED.spark_metrica_id,spark_config=EXCLUDED.spark_config,sql_preview=EXCLUDED.sql_preview,delta_config=EXCLUDED.delta_config,status=EXCLUDED.status,sql_override=EXCLUDED.sql_override,spark_sql_override=EXCLUDED.spark_sql_override;
INSERT INTO painel_widgets (slug,perfil,layout,ordem,tipo,titulo,subtitulo,formato,metrica_id,fonte_config,spark_metrica_id,spark_config,sql_preview,delta_config,status,sql_override,spark_sql_override) VALUES ('media_permanencia','Hospitalar','A',5,'card','Permanência média','dias/AIH','numero',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.media_permanencia'),'{}',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.media_permanencia'),NULL,'
SELECT ROUND(
    SUM(si.total_diarias)::numeric / NULLIF(SUM(si.qtd_aih), 0),
    1
) AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
','{"tipo": "fixo", "label": "dias/internação"}','ativo',NULL,NULL) ON CONFLICT (perfil,layout,slug) DO UPDATE SET ordem=EXCLUDED.ordem,tipo=EXCLUDED.tipo,titulo=EXCLUDED.titulo,subtitulo=EXCLUDED.subtitulo,formato=EXCLUDED.formato,metrica_id=EXCLUDED.metrica_id,fonte_config=EXCLUDED.fonte_config,spark_metrica_id=EXCLUDED.spark_metrica_id,spark_config=EXCLUDED.spark_config,sql_preview=EXCLUDED.sql_preview,delta_config=EXCLUDED.delta_config,status=EXCLUDED.status,sql_override=EXCLUDED.sql_override,spark_sql_override=EXCLUDED.spark_sql_override;
INSERT INTO painel_widgets (slug,perfil,layout,ordem,tipo,titulo,subtitulo,formato,metrica_id,fonte_config,spark_metrica_id,spark_config,sql_preview,delta_config,status,sql_override,spark_sql_override) VALUES ('taxa_mortalidade','Hospitalar','A',6,'card','Taxa de mortalidade',NULL,'percentual',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.taxa_mortalidade'),'{}',NULL,NULL,'SELECT 
    SUM(CASE WHEN si.motivo_saida LIKE ''4%'' THEN si.qtd_aih ELSE 0 END)::numeric 
    / NULLIF(SUM(si.qtd_aih), 0) AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL 
       OR si.estabelecimento_id = :estabelecimento_id::bigint);','{"tipo": "fixo", "label": "óbitos/AIH × 100"}','ativo','SELECT 
    SUM(CASE WHEN si.motivo_saida LIKE ''4%'' THEN si.qtd_aih ELSE 0 END)::numeric 
    / NULLIF(SUM(si.qtd_aih), 0) AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL 
       OR si.estabelecimento_id = :estabelecimento_id::bigint);',NULL) ON CONFLICT (perfil,layout,slug) DO UPDATE SET ordem=EXCLUDED.ordem,tipo=EXCLUDED.tipo,titulo=EXCLUDED.titulo,subtitulo=EXCLUDED.subtitulo,formato=EXCLUDED.formato,metrica_id=EXCLUDED.metrica_id,fonte_config=EXCLUDED.fonte_config,spark_metrica_id=EXCLUDED.spark_metrica_id,spark_config=EXCLUDED.spark_config,sql_preview=EXCLUDED.sql_preview,delta_config=EXCLUDED.delta_config,status=EXCLUDED.status,sql_override=EXCLUDED.sql_override,spark_sql_override=EXCLUDED.spark_sql_override;
INSERT INTO painel_widgets (slug,perfil,layout,ordem,tipo,titulo,subtitulo,formato,metrica_id,fonte_config,spark_metrica_id,spark_config,sql_preview,delta_config,status,sql_override,spark_sql_override) VALUES ('pct_diarias_uti_adulto','Hospitalar','A',7,'card','Ocupação UTI Adulto',NULL,'percentual',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.pct_diarias_uti'),'{}',NULL,NULL,'WITH dados_competencia AS (
    SELECT 
        :competencia::date AS dt_comp,
        TO_CHAR(:competencia::date, ''YYYYMM'') AS comp_yyyymm,
        EXTRACT(DAY FROM (DATE_TRUNC(''month'', :competencia::date) + INTERVAL ''1 month - 1 day''))::numeric AS dias_no_mes
),
diarias_adulto AS (
    SELECT 
        sa.estabelecimento_id,
        SUM(sa.diarias_uti)::numeric AS soma_diarias_uti
    FROM sih_aih sa
    WHERE sa.competencia = :competencia::date
      AND sa.idade > 12 -- Critério UTI Adulto
      AND (:estabelecimento_id::bigint IS NULL OR sa.estabelecimento_id = :estabelecimento_id::bigint)
    GROUP BY sa.estabelecimento_id
),
leitos_adulto AS (
    SELECT 
        v.estabelecimento_id,
        SUM(COALESCE((v.leitos->>''uti_adulto'')::numeric, 0)) AS qtd_leitos
    FROM enriquecimento_hospitalar_leitos_vigencia v
    CROSS JOIN dados_competencia dc
    WHERE dc.comp_yyyymm BETWEEN v.vigencia_inicio AND v.vigencia_fim
      AND (:estabelecimento_id::bigint IS NULL OR v.estabelecimento_id = :estabelecimento_id::bigint)
    GROUP BY v.estabelecimento_id
)
SELECT 
    SUM(d.soma_diarias_uti) 
    / NULLIF(SUM(l.qtd_leitos * dc.dias_no_mes), 0) AS valor
FROM diarias_adulto d
JOIN leitos_adulto l ON d.estabelecimento_id = l.estabelecimento_id
CROSS JOIN dados_competencia dc;','{"tipo": "fixo", "label": "diárias UTI / total"}','ativo','WITH dados_competencia AS (
    SELECT 
        :competencia::date AS dt_comp,
        TO_CHAR(:competencia::date, ''YYYYMM'') AS comp_yyyymm,
        EXTRACT(DAY FROM (DATE_TRUNC(''month'', :competencia::date) + INTERVAL ''1 month - 1 day''))::numeric AS dias_no_mes
),
diarias_adulto AS (
    SELECT 
        sa.estabelecimento_id,
        SUM(sa.diarias_uti)::numeric AS soma_diarias_uti
    FROM sih_aih sa
    WHERE sa.competencia = :competencia::date
      AND sa.idade > 12 -- Critério UTI Adulto
      AND (:estabelecimento_id::bigint IS NULL OR sa.estabelecimento_id = :estabelecimento_id::bigint)
    GROUP BY sa.estabelecimento_id
),
leitos_adulto AS (
    SELECT 
        v.estabelecimento_id,
        SUM(COALESCE((v.leitos->>''uti_adulto'')::numeric, 0)) AS qtd_leitos
    FROM enriquecimento_hospitalar_leitos_vigencia v
    CROSS JOIN dados_competencia dc
    WHERE dc.comp_yyyymm BETWEEN v.vigencia_inicio AND v.vigencia_fim
      AND (:estabelecimento_id::bigint IS NULL OR v.estabelecimento_id = :estabelecimento_id::bigint)
    GROUP BY v.estabelecimento_id
)
SELECT 
    SUM(d.soma_diarias_uti) 
    / NULLIF(SUM(l.qtd_leitos * dc.dias_no_mes), 0) AS valor
FROM diarias_adulto d
JOIN leitos_adulto l ON d.estabelecimento_id = l.estabelecimento_id
CROSS JOIN dados_competencia dc;',NULL) ON CONFLICT (perfil,layout,slug) DO UPDATE SET ordem=EXCLUDED.ordem,tipo=EXCLUDED.tipo,titulo=EXCLUDED.titulo,subtitulo=EXCLUDED.subtitulo,formato=EXCLUDED.formato,metrica_id=EXCLUDED.metrica_id,fonte_config=EXCLUDED.fonte_config,spark_metrica_id=EXCLUDED.spark_metrica_id,spark_config=EXCLUDED.spark_config,sql_preview=EXCLUDED.sql_preview,delta_config=EXCLUDED.delta_config,status=EXCLUDED.status,sql_override=EXCLUDED.sql_override,spark_sql_override=EXCLUDED.spark_sql_override;
INSERT INTO painel_widgets (slug,perfil,layout,ordem,tipo,titulo,subtitulo,formato,metrica_id,fonte_config,spark_metrica_id,spark_config,sql_preview,delta_config,status,sql_override,spark_sql_override) VALUES ('total_diarias_uti','Hospitalar','A',8,'card','Diárias em UTI',NULL,'numero',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.total_diarias_uti'),'{}',NULL,NULL,'
SELECT SUM(si.total_diarias_uti)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
','{"tipo": "competencia_anterior", "campo": "total_diarias_uti"}','ativo',NULL,NULL) ON CONFLICT (perfil,layout,slug) DO UPDATE SET ordem=EXCLUDED.ordem,tipo=EXCLUDED.tipo,titulo=EXCLUDED.titulo,subtitulo=EXCLUDED.subtitulo,formato=EXCLUDED.formato,metrica_id=EXCLUDED.metrica_id,fonte_config=EXCLUDED.fonte_config,spark_metrica_id=EXCLUDED.spark_metrica_id,spark_config=EXCLUDED.spark_config,sql_preview=EXCLUDED.sql_preview,delta_config=EXCLUDED.delta_config,status=EXCLUDED.status,sql_override=EXCLUDED.sql_override,spark_sql_override=EXCLUDED.spark_sql_override;
INSERT INTO painel_widgets (slug,perfil,layout,ordem,tipo,titulo,subtitulo,formato,metrica_id,fonte_config,spark_metrica_id,spark_config,sql_preview,delta_config,status,sql_override,spark_sql_override) VALUES ('trend_internacoes','Hospitalar','A',9,'grafico_linha','Internações mensais','Série histórica','numero',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.historico_mensal'),'{"eixo_x": "competencia", "eixo_y": "valor"}',NULL,NULL,'
SELECT to_char(si.competencia, ''YYYY-MM'') AS competencia,
       SUM(si.qtd_aih)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia <= :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY si.competencia
ORDER BY si.competencia
LIMIT 12
',NULL,'ativo',NULL,NULL) ON CONFLICT (perfil,layout,slug) DO UPDATE SET ordem=EXCLUDED.ordem,tipo=EXCLUDED.tipo,titulo=EXCLUDED.titulo,subtitulo=EXCLUDED.subtitulo,formato=EXCLUDED.formato,metrica_id=EXCLUDED.metrica_id,fonte_config=EXCLUDED.fonte_config,spark_metrica_id=EXCLUDED.spark_metrica_id,spark_config=EXCLUDED.spark_config,sql_preview=EXCLUDED.sql_preview,delta_config=EXCLUDED.delta_config,status=EXCLUDED.status,sql_override=EXCLUDED.sql_override,spark_sql_override=EXCLUDED.spark_sql_override;
INSERT INTO painel_widgets (slug,perfil,layout,ordem,tipo,titulo,subtitulo,formato,metrica_id,fonte_config,spark_metrica_id,spark_config,sql_preview,delta_config,status,sql_override,spark_sql_override) VALUES ('permanencia_media_real','Hospitalar','A',10,'card','Permanência média real','dias (saída − internação)','numero',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.permanencia_media_real'),'{}',NULL,NULL,'
SELECT ROUND(AVG(sa.dt_saida - sa.dt_internacao)::numeric, 1) AS valor
FROM sih_aih sa
WHERE sa.competencia = :competencia::date
  AND sa.dt_internacao IS NOT NULL
  AND sa.dt_saida IS NOT NULL
  AND (:estabelecimento_id::bigint IS NULL
       OR sa.estabelecimento_id = :estabelecimento_id::bigint)
','{"tipo": "fixo", "label": "dias/internação"}','ativo',NULL,NULL) ON CONFLICT (perfil,layout,slug) DO UPDATE SET ordem=EXCLUDED.ordem,tipo=EXCLUDED.tipo,titulo=EXCLUDED.titulo,subtitulo=EXCLUDED.subtitulo,formato=EXCLUDED.formato,metrica_id=EXCLUDED.metrica_id,fonte_config=EXCLUDED.fonte_config,spark_metrica_id=EXCLUDED.spark_metrica_id,spark_config=EXCLUDED.spark_config,sql_preview=EXCLUDED.sql_preview,delta_config=EXCLUDED.delta_config,status=EXCLUDED.status,sql_override=EXCLUDED.sql_override,spark_sql_override=EXCLUDED.spark_sql_override;
INSERT INTO painel_widgets (slug,perfil,layout,ordem,tipo,titulo,subtitulo,formato,metrica_id,fonte_config,spark_metrica_id,spark_config,sql_preview,delta_config,status,sql_override,spark_sql_override) VALUES ('tc_mort_cid_ripsa','Hospitalar','A',11,'card','Taxa de Mortalidade RIPSA',NULL,'percentual',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.pct_obito_cid'),'{}',NULL,NULL,'SELECT 
    SUM(CASE WHEN sa.motivo_saida LIKE ''4%'' THEN 1 ELSE 0 END)::numeric
    / NULLIF(
        SUM(
            CASE 
                WHEN sa.motivo_saida IN (''11'',''12'',''31'',''41'',''42'',''43'',''61'',''62'',''63'',''64'',''65'',''66'',''67'') THEN 1 
                ELSE 0 
            END
        ), 
        0
    ) AS valor
FROM sih_aih sa
WHERE sa.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL 
       OR sa.estabelecimento_id = :estabelecimento_id::bigint);','{"tipo": "fixo", "label": "cid_obito preenchido"}','ativo','SELECT 
    SUM(CASE WHEN sa.motivo_saida LIKE ''4%'' THEN 1 ELSE 0 END)::numeric
    / NULLIF(
        SUM(
            CASE 
                WHEN sa.motivo_saida IN (''11'',''12'',''31'',''41'',''42'',''43'',''61'',''62'',''63'',''64'',''65'',''66'',''67'') THEN 1 
                ELSE 0 
            END
        ), 
        0
    ) AS valor
FROM sih_aih sa
WHERE sa.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL 
       OR sa.estabelecimento_id = :estabelecimento_id::bigint);',NULL) ON CONFLICT (perfil,layout,slug) DO UPDATE SET ordem=EXCLUDED.ordem,tipo=EXCLUDED.tipo,titulo=EXCLUDED.titulo,subtitulo=EXCLUDED.subtitulo,formato=EXCLUDED.formato,metrica_id=EXCLUDED.metrica_id,fonte_config=EXCLUDED.fonte_config,spark_metrica_id=EXCLUDED.spark_metrica_id,spark_config=EXCLUDED.spark_config,sql_preview=EXCLUDED.sql_preview,delta_config=EXCLUDED.delta_config,status=EXCLUDED.status,sql_override=EXCLUDED.sql_override,spark_sql_override=EXCLUDED.spark_sql_override;
INSERT INTO painel_widgets (slug,perfil,layout,ordem,tipo,titulo,subtitulo,formato,metrica_id,fonte_config,spark_metrica_id,spark_config,sql_preview,delta_config,status,sql_override,spark_sql_override) VALUES ('ranking_carater','Hospitalar','A',12,'grafico_ranking','Internações por caráter',NULL,'numero',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.internacoes_por_carater'),'{"limite": 10, "eixo_label": "unidade", "eixo_valor": "valor"}',NULL,NULL,'
SELECT
    CASE sa.carater_internacao
        WHEN ''01'' THEN ''Eletiva''
        WHEN ''02'' THEN ''Urgência''
        ELSE COALESCE(NULLIF(sa.carater_internacao, ''''), ''Não informado'')
    END                         AS unidade,
    COUNT(*)::bigint            AS valor
FROM sih_aih sa
WHERE sa.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sa.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY 1
ORDER BY valor DESC
',NULL,'ativo',NULL,NULL) ON CONFLICT (perfil,layout,slug) DO UPDATE SET ordem=EXCLUDED.ordem,tipo=EXCLUDED.tipo,titulo=EXCLUDED.titulo,subtitulo=EXCLUDED.subtitulo,formato=EXCLUDED.formato,metrica_id=EXCLUDED.metrica_id,fonte_config=EXCLUDED.fonte_config,spark_metrica_id=EXCLUDED.spark_metrica_id,spark_config=EXCLUDED.spark_config,sql_preview=EXCLUDED.sql_preview,delta_config=EXCLUDED.delta_config,status=EXCLUDED.status,sql_override=EXCLUDED.sql_override,spark_sql_override=EXCLUDED.spark_sql_override;
INSERT INTO painel_widgets (slug,perfil,layout,ordem,tipo,titulo,subtitulo,formato,metrica_id,fonte_config,spark_metrica_id,spark_config,sql_preview,delta_config,status,sql_override,spark_sql_override) VALUES ('ocupacao_uti_neonatal','Hospitalar','A',13,'card','Ocupação UTI Neonatal',NULL,'percentual',(SELECT id FROM painel_metricas_catalogo WHERE chave='sih.total_diarias_uti'),'{}',NULL,NULL,'WITH dados_competencia AS (
    SELECT 
        :competencia::date AS dt_comp,
        TO_CHAR(:competencia::date, ''YYYYMM'') AS comp_yyyymm,
        EXTRACT(DAY FROM (DATE_TRUNC(''month'', :competencia::date) + INTERVAL ''1 month - 1 day''))::numeric AS dias_no_mes
),
diarias_neo AS (
    SELECT 
        sa.estabelecimento_id,
        SUM(sa.diarias_uti)::numeric AS soma_diarias_uti
    FROM sih_aih sa
    WHERE sa.competencia = :competencia::date
      AND sa.idade <= 12 -- Critério UTI Neonatal / Pediátrica
      AND (:estabelecimento_id::bigint IS NULL OR sa.estabelecimento_id = :estabelecimento_id::bigint)
    GROUP BY sa.estabelecimento_id
),
leitos_neo AS (
    SELECT 
        v.estabelecimento_id,
        SUM(COALESCE((v.leitos->>''uti_neonatal'')::numeric, 0)) AS qtd_leitos
    FROM enriquecimento_hospitalar_leitos_vigencia v
    CROSS JOIN dados_competencia dc
    WHERE dc.comp_yyyymm BETWEEN v.vigencia_inicio AND v.vigencia_fim
      AND (:estabelecimento_id::bigint IS NULL OR v.estabelecimento_id = :estabelecimento_id::bigint)
    GROUP BY v.estabelecimento_id
)
SELECT 
    SUM(d.soma_diarias_uti) 
    / NULLIF(SUM(l.qtd_leitos * dc.dias_no_mes), 0) AS valor
FROM diarias_neo d
JOIN leitos_neo l ON d.estabelecimento_id = l.estabelecimento_id
CROSS JOIN dados_competencia dc;',NULL,'ativo','WITH dados_competencia AS (
    SELECT 
        :competencia::date AS dt_comp,
        TO_CHAR(:competencia::date, ''YYYYMM'') AS comp_yyyymm,
        EXTRACT(DAY FROM (DATE_TRUNC(''month'', :competencia::date) + INTERVAL ''1 month - 1 day''))::numeric AS dias_no_mes
),
diarias_neo AS (
    SELECT 
        sa.estabelecimento_id,
        SUM(sa.diarias_uti)::numeric AS soma_diarias_uti
    FROM sih_aih sa
    WHERE sa.competencia = :competencia::date
      AND sa.idade <= 12 -- Critério UTI Neonatal / Pediátrica
      AND (:estabelecimento_id::bigint IS NULL OR sa.estabelecimento_id = :estabelecimento_id::bigint)
    GROUP BY sa.estabelecimento_id
),
leitos_neo AS (
    SELECT 
        v.estabelecimento_id,
        SUM(COALESCE((v.leitos->>''uti_neonatal'')::numeric, 0)) AS qtd_leitos
    FROM enriquecimento_hospitalar_leitos_vigencia v
    CROSS JOIN dados_competencia dc
    WHERE dc.comp_yyyymm BETWEEN v.vigencia_inicio AND v.vigencia_fim
      AND (:estabelecimento_id::bigint IS NULL OR v.estabelecimento_id = :estabelecimento_id::bigint)
    GROUP BY v.estabelecimento_id
)
SELECT 
    SUM(d.soma_diarias_uti) 
    / NULLIF(SUM(l.qtd_leitos * dc.dias_no_mes), 0) AS valor
FROM diarias_neo d
JOIN leitos_neo l ON d.estabelecimento_id = l.estabelecimento_id
CROSS JOIN dados_competencia dc;',NULL) ON CONFLICT (perfil,layout,slug) DO UPDATE SET ordem=EXCLUDED.ordem,tipo=EXCLUDED.tipo,titulo=EXCLUDED.titulo,subtitulo=EXCLUDED.subtitulo,formato=EXCLUDED.formato,metrica_id=EXCLUDED.metrica_id,fonte_config=EXCLUDED.fonte_config,spark_metrica_id=EXCLUDED.spark_metrica_id,spark_config=EXCLUDED.spark_config,sql_preview=EXCLUDED.sql_preview,delta_config=EXCLUDED.delta_config,status=EXCLUDED.status,sql_override=EXCLUDED.sql_override,spark_sql_override=EXCLUDED.spark_sql_override;
COMMIT;
