-- ============================================================================
-- SIMPA — Migration 031: agregação de período por widget
-- Depends on: migration_008_painel_widgets.sql … migration_030
-- Apply order: … → 30 → 31 widget_agregacao_periodo
-- Safe to re-run (IF NOT EXISTS / CHECK idempotente).
--
-- Suporta seleção de período (mês / trimestre / quadrimestre / ano) no Painel.
-- Define como o widget colapsa um período multi-mês:
--   ultimo_mes = snapshot do mês final (default, retrocompatível)
--   soma       = SQL usa :competencia_inicio/:competencia_fim (BETWEEN); produção somável
--   media      = backend roda o SQL mês a mês e tira a média (indicadores/taxas)
-- ============================================================================

ALTER TABLE painel_widgets
    ADD COLUMN IF NOT EXISTS agregacao_periodo TEXT NOT NULL DEFAULT 'ultimo_mes';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'painel_widgets_agregacao_periodo_chk'
    ) THEN
        ALTER TABLE painel_widgets
            ADD CONSTRAINT painel_widgets_agregacao_periodo_chk
            CHECK (agregacao_periodo IN ('ultimo_mes', 'soma', 'media'));
    END IF;
END$$;

COMMENT ON COLUMN painel_widgets.agregacao_periodo IS
    'Como o widget agrega período multi-mês: ultimo_mes (snapshot fim) | soma (BETWEEN inicio/fim) | media (média mês a mês).';
