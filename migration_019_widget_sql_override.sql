-- ============================================================================
-- SIMPA — Migration 019: SQL override por widget (principal + sparkline)
-- Depends on: migration_008_painel_widgets.sql … migration_018
-- Apply order: … → 18 → 19 widget_sql_override
-- Safe to re-run (IF NOT EXISTS).
-- ============================================================================

ALTER TABLE painel_widgets
    ADD COLUMN IF NOT EXISTS sql_override TEXT NULL,
    ADD COLUMN IF NOT EXISTS spark_sql_override TEXT NULL;

COMMENT ON COLUMN painel_widgets.sql_override IS
    'SQL customizado deste widget. Quando preenchido, substitui painel_metricas_catalogo.sql_template na execução.';
COMMENT ON COLUMN painel_widgets.spark_sql_override IS
    'SQL customizado da sparkline. Quando preenchido, substitui o template da spark_metrica_id.';
