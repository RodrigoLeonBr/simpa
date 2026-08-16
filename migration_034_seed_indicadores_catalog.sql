-- =============================================================================
-- SIMPA — Migration 034: seed do catálogo `indicadores` (13 códigos de qualidade)
-- =============================================================================
-- Espelha INDICADORES_QUALIDADE_CATALOG de etl_contract.py. Necessário porque
-- metas_financiamento.indicador_id é FK para indicadores(id). Sem essas linhas
-- não há como cadastrar meta pactuada.
--
-- NÃO define metas aqui — valor_meta é regulatório (parâmetro MS/Secretaria) e
-- entra em metas_financiamento (ver template ao final). Idempotente.
-- =============================================================================

INSERT INTO indicadores (codigo, nome, categoria, fonte_dados, periodicidade, unidade_medida)
VALUES
  ('C1',        'Acesso e Vínculo — 1ªs consultas programadas vs. demanda espontânea', 'Componente Qualidade APS', 'Relatório de Atendimento Individual',        'Quadrimestral', 'proporcao'),
  ('B1',        '1ª consulta odontológica programada na APS',                          'Componente Qualidade APS', 'Relatório de Atendimento Odontológico',      'Quadrimestral', 'proporcao'),
  ('B2',        'Tratamentos odontológicos concluídos',                                'Componente Qualidade APS', 'Relatório de Atendimento Odontológico',      'Quadrimestral', 'proporcao'),
  ('B3',        'Taxa de exodontias na APS',                                           'Componente Qualidade APS', 'Relatório de Procedimentos Individualizados', 'Quadrimestral', 'proporcao'),
  ('B4',        'Escovação supervisionada (6 a 12 anos)',                              'Componente Qualidade APS', 'Relatório de Atividade Coletiva',            'Quadrimestral', 'proporcao'),
  ('B5',        'Procedimentos preventivos odontológicos',                             'Componente Qualidade APS', 'Relatório de Procedimentos Individualizados', 'Quadrimestral', 'proporcao'),
  ('B6',        'Tratamento Restaurador Atraumático (ART)',                            'Componente Qualidade APS', 'Relatório de Procedimentos Individualizados', 'Quadrimestral', 'proporcao'),
  ('M1',        'Média de atendimentos por pessoa assistida pela eMulti',              'Componente Qualidade APS', 'Relatórios Individual + Coletiva',           'Quadrimestral', 'media'),
  ('M2',        'Proporção de ações interprofissionais compartilhadas pela eMulti',    'Componente Qualidade APS', 'Relatório de Atividade Coletiva',            'Quadrimestral', 'proporcao'),
  ('IGM-APS',   'Cobertura de Atenção Primária (eSF/eAP)',                             'IGM SUS Paulista',         'Cadastro territorial e-SUS',                 'Mensal',        'proporcao'),
  ('IGM-PN',    'Proporção de gestantes com 7 ou mais consultas de pré-natal',         'IGM SUS Paulista',         'Relatório de Atendimento Individual',        'Mensal',        'proporcao'),
  ('IGM-VAC',   'Cobertura vacinal de menores de 1 ano',                               'IGM SUS Paulista',         'Sistema de imunização (parcial Fase 1)',     'Mensal',        'proporcao'),
  ('IGM-ICSAP', 'Internações por Condições Sensíveis à Atenção Primária',              'IGM SUS Paulista',         'e-SUS + SIHD (parcial Fase 1)',              'Mensal',        'proporcao')
ON CONFLICT (codigo) DO UPDATE SET
  nome          = EXCLUDED.nome,
  categoria     = EXCLUDED.categoria,
  fonte_dados   = EXCLUDED.fonte_dados,
  periodicidade = EXCLUDED.periodicidade,
  unidade_medida = EXCLUDED.unidade_medida;

-- -----------------------------------------------------------------------------
-- Template para cadastrar metas oficiais (valor_meta em proporção 0–1; 0.50 = 50%).
-- Meta municipal = estabelecimento_id/unidade_id/equipe_id NULL. origem obrigatória
-- (CHECK): 'Componente Qualidade APS' | 'IGM SUS Paulista' | 'Emenda Parlamentar' | 'Meta Local'.
-- Repetir por competência pactuada.
--
-- INSERT INTO metas_financiamento (indicador_id, competencia, valor_meta, origem)
-- SELECT id, DATE '2026-01-01', 0.50, 'Componente Qualidade APS' FROM indicadores WHERE codigo = 'C1'
-- ON CONFLICT (indicador_id, unidade_id, equipe_id, competencia, origem) DO UPDATE
--   SET valor_meta = EXCLUDED.valor_meta;
-- -----------------------------------------------------------------------------
