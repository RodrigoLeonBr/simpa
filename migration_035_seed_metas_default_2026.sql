-- =============================================================================
-- SIMPA — Migration 035: metas DEFAULT 2026 (cadastro padrão editável)
-- =============================================================================
-- ATENÇÃO: valores PLACEHOLDER. Referência = faixa de classificação que rende
-- ~80% do financiamento por desempenho (Componente Qualidade APS / IGM SUS
-- Paulista). NÃO são os parâmetros oficiais 2026 confirmados — ajustar no banco
-- (UPDATE metas_financiamento SET valor_meta = … WHERE …) quando a Secretaria
-- fornecer a tabela vigente.
--
-- Escala: proporção 0–1 (0.50 = 50%). Municipal (unidade/equipe/estab NULL).
-- Aplicado a todas as competências 2026-01..12.
--
-- INVERSOS ("quanto menor melhor", meta = teto): B3 e IGM-ICSAP. A lógica de
-- status da UI (exec/meta ≥ 1 = atingida) assume "maior melhor" → nesses dois o
-- verde/vermelho fica invertido até tratar direção do indicador. ponytail: não
-- tratado aqui; adicionar coluna sentido/direção em `indicadores` se virar requisito.
--
-- Idempotente via NOT EXISTS (constraint UNIQUE ignora duplicatas com colunas
-- NULL — NULLS DISTINCT no PG15). Re-execução não sobrescreve edições manuais.
-- =============================================================================

INSERT INTO metas_financiamento (indicador_id, competencia, valor_meta, origem)
SELECT i.id, gs::date, v.valor_meta, v.origem
FROM (VALUES
    -- Componente Qualidade APS
    ('C1',        0.60, 'Componente Qualidade APS'),  -- acesso/vínculo: consultas programadas
    ('B1',        0.30, 'Componente Qualidade APS'),  -- 1ª consulta odonto programática
    ('B2',        0.35, 'Componente Qualidade APS'),  -- tratamentos concluídos
    ('B3',        0.08, 'Componente Qualidade APS'),  -- INVERSO: taxa máxima de exodontias
    ('B4',        0.20, 'Componente Qualidade APS'),  -- escovação supervisionada
    ('B5',        0.30, 'Componente Qualidade APS'),  -- preventivos odonto
    ('B6',        0.05, 'Componente Qualidade APS'),  -- ART
    ('M1',        3.00, 'Componente Qualidade APS'),  -- média eMulti (NÃO é proporção)
    ('M2',        0.40, 'Componente Qualidade APS'),  -- ações interprofissionais
    -- IGM SUS Paulista
    ('IGM-APS',   0.80, 'IGM SUS Paulista'),          -- cobertura APS
    ('IGM-PN',    0.45, 'IGM SUS Paulista'),          -- pré-natal 7+
    ('IGM-VAC',   0.95, 'IGM SUS Paulista'),          -- cobertura vacinal <1 ano
    ('IGM-ICSAP', 0.28, 'IGM SUS Paulista')           -- INVERSO: teto de internações sensíveis
) AS v(codigo, valor_meta, origem)
JOIN indicadores i ON i.codigo = v.codigo
CROSS JOIN generate_series(DATE '2026-01-01', DATE '2026-12-01', INTERVAL '1 month') gs
WHERE NOT EXISTS (
    SELECT 1 FROM metas_financiamento m
    WHERE m.indicador_id = i.id
      AND m.competencia = gs::date
      AND m.origem = v.origem
      AND m.unidade_id IS NULL
      AND m.equipe_id IS NULL
      AND m.estabelecimento_id IS NULL
);
