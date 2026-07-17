-- ============================================================================
-- SIMPA — Migration 021: Corrige labels/descrições UTF-8 em painel_metricas_catalogo
-- Depends on: migration_008 … migration_020
--
-- Causa: migrations 008/014/015 aplicadas manualmente via PowerShell sem
-- -Encoding UTF8 corrompem acentos (?? no lugar de é, ã, ç, etc.).
-- Migration 016 corrigiu painel_widgets; esta corrige o catálogo de métricas.
--
-- Manual apply (Windows — NÃO use pipe Get-Content; corrompe UTF-8):
--   docker cp migration_021_fix_painel_metricas_utf8.sql simpa-postgres-1:/tmp/m021.sql
--   docker exec simpa-postgres-1 psql -U postgres -d simpa -f /tmp/m021.sql
-- Linux/macOS:
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_021_fix_painel_metricas_utf8.sql
-- ============================================================================

UPDATE painel_metricas_catalogo m
SET
    label = v.label,
    descricao = v.descricao,
    secao = COALESCE(v.secao, m.secao),
    descricao_linha = COALESCE(v.descricao_linha, m.descricao_linha)
FROM (
    VALUES
        -- e-SUS (migration 008)
        (
            'esus.atendimento_individual.resumo.registros.quantidade',
            'Atendimentos individuais (resumo)',
            'Total de registros identificados — Relatório de Atendimento Individual.',
            'Resumo de produção'::varchar,
            'Registros identificados'::varchar
        ),
        (
            'esus.atendimento_individual.turnos.soma.quantidade',
            'Atendimentos individuais (soma turnos)',
            'Fallback quando o export omite Resumo de produção — soma seção Turno.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'esus.atendimento_odontologico.resumo.registros.quantidade',
            'Produção odontológica (resumo)',
            'Total de registros — Relatório de Atendimento Odontológico.',
            'Resumo de produção'::varchar,
            'Registros identificados'::varchar
        ),
        (
            'esus.atividade_coletiva.participantes.total.quantidade',
            'Participantes — atividade coletiva',
            'Total de participantes identificados em atividades coletivas.',
            'Número de participantes'::varchar,
            'Total de participantes'::varchar
        ),
        (
            'esus.atendimento_individual.historico.mensal',
            'Série histórica — atendimentos individuais',
            'Atendimentos por competência (até 12 meses) a partir do consolidado municipal.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'esus.atendimento_individual.ranking.unidade',
            'Ranking produção por unidade',
            'Top unidades por atendimentos individuais na competência (visão município).',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'placeholder.cobertura_aps',
            'Cobertura APS',
            'Indicador IGM — ainda não apurado na Fase 1.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'placeholder.equipes_ativas',
            'Equipes ativas',
            'Contagem de equipes — ainda não apurado na Fase 1.',
            NULL::varchar,
            NULL::varchar
        ),
        -- SIA produção e financeiro (migration 014)
        (
            'sia.producao_qtd_aprovada',
            'Procedimentos aprovados (SIA)',
            'Soma de quantidade aprovada na competência (PRD_QT_A espelhada em sia_producao).',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.producao_valor_aprovado',
            'Valor aprovado (SIA)',
            'Soma do valor aprovado na competência (PRD_VL_A).',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.producao_valor_apresentado',
            'Valor apresentado (SIA)',
            'Soma do valor apresentado na competência (PRD_VL_P).',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.taxa_aprovacao_qtd_pct',
            'Taxa de aprovação quantidade (%)',
            'Quantidade aprovada / apresentada × 100 na competência.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.taxa_glosa_valor_pct',
            'Taxa de glosa financeira (%)',
            '(Valor apresentado − aprovado) / apresentado × 100.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.producao_mac_valor',
            'Produção MAC (rubrica 0301)',
            'Valor aprovado com rubrica MAC — média/alta complexidade ambulatorial.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.producao_ab_valor',
            'Produção Atenção Básica (rubrica 0101)',
            'Valor aprovado com rubrica de Atenção Básica.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.grupo_diagnostico_qtd',
            'Exames diagnósticos (grupo 02)',
            'Procedimentos aprovados do grupo SIGTAP 02 — proxy de exames OCI/PATE.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.grupo_clinico_qtd',
            'Procedimentos clínicos (grupo 03)',
            'Procedimentos aprovados do grupo SIGTAP 03 — consultas e atendimentos.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.grupo_cirurgico_qtd',
            'Procedimentos cirúrgicos (grupo 04)',
            'Procedimentos aprovados do grupo SIGTAP 04 — componente cirúrgico PATE.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.consultas_especializadas_qtd',
            'Consultas especializadas (subgrupo 0303)',
            'Procedimentos do subgrupo 0303 — consultas e atendimentos ambulatoriais especializados.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.historico_mensal_qtd',
            'Série histórica mensal — procedimentos',
            'Quantidade aprovada por competência (até 12 meses).',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.historico_mensal_valor',
            'Série histórica mensal — valor aprovado',
            'Valor aprovado por competência (até 12 meses).',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.historico_quadrimestral_valor',
            'Série histórica quadrimestral — valor',
            'Valor aprovado agregado por quadrimestre SUS (jan-abr, mai-ago, set-dez).',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.historico_anual_valor',
            'Série histórica anual — valor aprovado',
            'Valor aprovado acumulado por ano civil (até 5 anos).',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.variacao_quadrimestre_anterior_pct',
            'Variação quadrimestral valor (%)',
            'Variação percentual do valor aprovado vs quadrimestre SUS anterior.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.variacao_ano_anterior_pct',
            'Variação anual valor acumulado (%)',
            'Variação percentual do valor aprovado acumulado no ano vs mesmo recorte do ano anterior.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.ranking_unidades_valor',
            'Ranking unidades por valor SIA',
            'Top 6 estabelecimentos por valor aprovado na competência.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.ranking_rubricas_valor',
            'Produção por rubrica/financiamento',
            'Valor aprovado por rubrica na competência.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.oci_alcance_meta_par_pct',
            'OCI — alcance meta PAR (%)',
            'Produção APAC / meta_quantidade PAR × 100 na competência.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.oci_absenteismo_pct',
            'OCI — absenteísmo (%)',
            'Indicador PMAE #2. Requer integração SISREG/filas (lacuna conhecida).',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.oci_apac_producao_qtd',
            'Produção APAC (procedimentos)',
            'Soma de procedimentos aprovados em linhas com APAC (PRD_APANUM).',
            NULL::varchar,
            NULL::varchar
        ),
        -- PATE (migration 014)
        (
            'pate.ambulatorial_valor_mes',
            'PATE ambulatorial — valor mensal',
            'Valor aprovado SIA na competência — componente ambulatorial do Programa Agora Tem Especialistas.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'pate.consultas_especializadas_qtd',
            'PATE — consultas especializadas',
            'Volume mensal de consultas (subgrupo 0303) — proxy de produção ambulatorial especializada.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'pate.exames_diagnostico_qtd',
            'PATE — exames diagnósticos',
            'Volume mensal grupo 02 — exames da linha de cuidado OCI/PATE.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'pate.historico_mensal_valor',
            'PATE — série histórica valor ambulatorial',
            'Valor aprovado mensal (rubricas MAC/FAEC/TFD) até 12 meses.',
            NULL::varchar,
            NULL::varchar
        ),
        -- APAC (migration 015)
        (
            'sia.apac_distintas_mes',
            'APAC distintas (mês)',
            'Contagem de números APAC distintos com produção na competência.',
            NULL::varchar,
            NULL::varchar
        ),
        (
            'sia.apac_por_tipo_oci',
            'APAC por tipo OCI (PAR)',
            'APAC distintas por tipo OCI conforme metas PAR da competência.',
            NULL::varchar,
            NULL::varchar
        )
) AS v(chave, label, descricao, secao, descricao_linha)
WHERE m.chave = v.chave;
