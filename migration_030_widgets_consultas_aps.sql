-- ============================================================================
-- SIMPA — Migration 030: widgets "Consultas" e "Consultas médicas" (APS Layout A)
-- Depends on: migration_008_painel_widgets.sql (painel_metricas_catalogo,
--             painel_widgets) e migration_010_sia_producao.sql (sia_producao).
-- Apply order: … → 29 esus_sigtap_blocos → 30 widgets_consultas_aps
-- Safe to re-run (ON CONFLICT DO NOTHING).
--
-- Manual apply (Postgres não-Docker / OUTRO SERVIDOR):
--   psql -h <host> -p <port> -U postgres -d simpa -f migration_030_widgets_consultas_aps.sql
-- Docker (container existente) — UTF-8 SAFE:
--   docker cp migration_030_widgets_consultas_aps.sql <container>:/tmp/m.sql
--   docker exec <container> psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/m.sql
-- NÃO use `Get-Content ... | docker exec -i psql` (corrompe acento no Windows).
--
-- Fonte: SIA (sia_producao) — e-SUS não codifica consulta em SIGTAP.
--   Consultas          = forma 030101 inteira  (codigo_sigtap LIKE '030101%')
--   Consultas médicas  = 030101 exceto 0301010030/0301010048 (nível superior
--                        exceto médico)
-- Métrica somada: quantidade_apresentada (convenção "apresentado" do SIA).
--   Para usar aprovado, trocar quantidade_apresentada → quantidade nos 2 templates.
-- Sem grão de equipe: sia_producao só tem estabelecimento_id (placeholder
--   :equipe_id é omitido de propósito).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Métricas curadas (fonte SIA)
-- ----------------------------------------------------------------------------
INSERT INTO painel_metricas_catalogo (
    chave, fonte_tipo, label, descricao,
    tipo_relatorio, secao, descricao_linha, campo_json, agregacao, sql_template, ocorrencias
) VALUES
(
    'sia.consultas.030101',
    'sia',
    'Consultas (forma 030101)',
    'Produção SIA da forma 030101 — Consultas médicas / outros profissionais de nível superior (apresentado).',
    NULL, NULL, NULL, 'quantidade_apresentada', 'sum',
    $sql$
SELECT COALESCE(SUM(quantidade_apresentada), 0) AS valor
FROM sia_producao
WHERE competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR estabelecimento_id = :estabelecimento_id::bigint)
  AND codigo_sigtap LIKE '030101%'
$sql$,
    0
),
(
    'sia.consultas_medicas.030101',
    'sia',
    'Consultas médicas (forma 030101)',
    'Produção SIA da forma 030101 excluindo 0301010030 e 0301010048 (nível superior exceto médico) — apresentado.',
    NULL, NULL, NULL, 'quantidade_apresentada', 'sum',
    $sql$
SELECT COALESCE(SUM(quantidade_apresentada), 0) AS valor
FROM sia_producao
WHERE competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR estabelecimento_id = :estabelecimento_id::bigint)
  AND codigo_sigtap LIKE '030101%'
  AND codigo_sigtap NOT IN ('0301010030', '0301010048')
$sql$,
    0
)
ON CONFLICT (chave) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Widgets APS Layout A (cards, ordem 9 e 10). metrica_id resolvido por chave.
-- ----------------------------------------------------------------------------
INSERT INTO painel_widgets (
    slug, perfil, layout, ordem, tipo, titulo, subtitulo, formato,
    metrica_id, fonte_config, spark_metrica_id, spark_config, sql_preview, delta_config
)
SELECT
    w.slug, 'APS', 'A', w.ordem, w.tipo, w.titulo, w.subtitulo, w.formato,
    m.id, w.fonte_config::jsonb, NULL, NULL, m.sql_template, w.delta_config::jsonb
FROM (VALUES
    (
        'consultas',
        9,
        'card',
        'Consultas',
        'SIA · forma 030101',
        'numero',
        'sia.consultas.030101',
        '{}',
        '{"tipo":"fixo","label":"SIA"}'
    ),
    (
        'consultas_medicas',
        10,
        'card',
        'Consultas médicas',
        'SIA · 030101 exceto não-médico',
        'numero',
        'sia.consultas_medicas.030101',
        '{}',
        '{"tipo":"fixo","label":"SIA"}'
    )
) AS w(
    slug, ordem, tipo, titulo, subtitulo, formato, metrica_chave, fonte_config, delta_config
)
JOIN painel_metricas_catalogo m ON m.chave = w.metrica_chave
ON CONFLICT (perfil, layout, slug) DO NOTHING;
