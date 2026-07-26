-- ============================================================================
-- SIMPA — Seed de-para e-SUS ↔ SIGTAP
-- Arquivo: seed_esus_sigtap_depara.sql
-- ============================================================================
-- Fontes:
--   * Planilhas municipais (screenshots 2026-07-26): Pequenas cirurgias +
--     Teste rápido + Administração de medicamentos; Procedimentos odonto
--   * LEDI e-SUS APS v7.3.2 dicionario-fp.html / dicionario-fao.html (SIGTAP 08/2025)
--   * Labels exatos: seed_esus_2026-05.sql / CSVs e-SUS CAFI 2026-05
-- Exclusões:
--   * Teste do olhinho (TRV) — LEDI sem código SIGTAP (ABEX022)
--   * 3ª planilha clínica truncada — sem seção e-SUS correspondente no export CAFI
-- Idempotente: ON CONFLICT upsert
-- ============================================================================

BEGIN;

-- Master procedimentos
INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0101020058', 'APLICAÇÃO DE CARIOSTÁTICO (POR DENTE)', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0101020066', 'APLICAÇÃO DE SELANTE (POR DENTE)', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0101020074', 'APLICAÇÃO TÓPICA DE FLÚOR (INDIVIDUAL POR SESSÃO)', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0101020082', 'EVIDENCIAÇÃO DE PLACA BACTERIANA', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0101020090', 'SELAMENTO PROVISÓRIO DE CAVIDADE DENTÁRIA', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0101020104', 'ORIENTAÇÃO DE HIGIENE BUCAL', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0101040024', 'AVALIAÇÃO ANTROPOMÉTRICA', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0101040059', 'ADMINISTRAÇÃO DE VITAMINA A', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0201020033', 'COLETA DE MATERIAL DO COLO DE ÚTERO PARA EXAME CITOPATOLÓGICO', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0204010217', 'RADIOGRAFIA INTERPROXIMAL (BITE WING)', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0204010225', 'RADIOGRAFIA PERIAPICAL', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0211020036', 'ELETROCARDIOGRAMA', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0211060100', 'FUNDOSCOPIA', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0211060275', 'TRIAGEM OFTALMOLÓGICA', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0214010015', 'GLICEMIA CAPILAR', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0214010058', 'TESTE RÁPIDO PARA DETECÇÃO DE ANTICORPOS ANTI-HIV PARA POPULAÇÃO GERAL', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0214010066', 'TESTE RÁPIDO DE GRAVIDEZ', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0214010074', 'TESTE RÁPIDO TREPONÊMICO (SÍFILIS) PARA POPULAÇÃO GERAL', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0214010090', 'TESTE RÁPIDO PARA HEPATITE C', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0214010155', 'TESTE RÁPIDO DE PROTEINÚRIA', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301010030', 'CONSULTA DE PROFISSIONAIS DE NÍVEL SUPERIOR NA ATENÇÃO PRIMÁRIA (EXCETO MÉDICO)', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301010064', 'CONSULTA MÉDICA EM ATENÇÃO PRIMÁRIA', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301010153', 'PRIMEIRA CONSULTA ODONTOLÓGICA PROGRAMÁTICA', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301040095', 'EXAME DO PÉ DIABÉTICO', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301100039', 'AFERIÇÃO DE PRESSÃO ARTERIAL', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301100047', 'CATETERISMO VESICAL DE ALÍVIO', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301100063', 'CUIDADOS COM ESTOMAS', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301100101', 'INALAÇÃO / NEBULIZAÇÃO', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301100152', 'RETIRADA DE PONTOS DE CIRURGIAS (POR PACIENTE)', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301100195', 'ADMINISTRAÇÃO DE MEDICAMENTOS POR VIA ENDOVENOSA', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301100209', 'ADMINISTRAÇÃO DE MEDICAMENTOS POR VIA INTRAMUSCULAR', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301100217', 'ADMINISTRAÇÃO DE MEDICAMENTOS POR VIA ORAL', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301100225', 'ADMINISTRAÇÃO DE MEDICAMENTOS POR VIA SUBCUTÂNEA (SC)', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301100233', 'ADMINISTRAÇÃO TÓPICA DE MEDICAMENTO(S)', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301100241', 'ADMINISTRAÇÃO DE PENICILINA PARA TRATAMENTO DE SÍFILIS', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0301100276', 'CURATIVO ESPECIAL', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0303080019', 'CAUTERIZAÇÃO QUÍMICA DE PEQUENAS LESÕES', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0303090030', 'INFILTRAÇÃO DE SUBSTÂNCIAS EM CAVIDADE SINOVIAL', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0307010015', 'CAPEAMENTO PULPAR', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0307010031', 'RESTAURAÇÃO DE DENTE PERMANENTE ANTERIOR COM RESINA COMPOSTA', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0307010120', 'RESTAURAÇÃO DE DENTE PERMANENTE POSTERIOR COM RESINA COMPOSTA', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0307020010', 'ACESSO A POLPA DENTÁRIA E MEDICAÇÃO (POR DENTE)', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0307020029', 'CURATIVO DE DEMORA C/ OU S/ PREPARO BIOMECÂNICO', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0307020070', 'PULPOTOMIA DENTÁRIA', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0307030024', 'RASPAGEM ALISAMENTO SUBGENGIVAIS (POR SEXTANTE)', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0307030040', 'PROFILAXIA / REMOÇÃO DA PLACA BACTERIANA', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0307030059', 'RASPAGEM ALISAMENTO E POLIMENTO SUPRAGENGIVAIS (POR SEXTANTE)', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0307040070', 'MOLDAGEM DENTO-GENGIVAL P/ CONSTRUÇÃO DE PRÓTESE DENTÁRIA', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0307040135', 'CIMENTAÇÃO DE PRÓTESE DENTÁRIA', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0307040143', 'ADAPTAÇÃO DE PRÓTESE DENTÁRIA', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0307040160', 'INSTALAÇÃO DE PRÓTESE DENTÁRIA', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0309050022', 'SESSÃO DE ACUPUNTURA COM INSERÇÃO DE AGULHAS', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0401010031', 'DRENAGEM DE ABSCESSO', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0401010066', 'EXCISÃO E/OU SUTURA SIMPLES DE PEQUENAS LESÕES / FERIMENTOS DE PELE / ANEXOS E MUCOSA', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0401010074', 'EXÉRESE DE TUMOR DE PELE E ANEXOS / CISTO SEBÁCEO / LIPOMA', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0401010112', 'RETIRADA DE CORPO ESTRANHO SUBCUTÂNEO', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0401020177', 'CIRURGIA DE UNHA (CANTOPLASTIA)', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0404010270', 'REMOÇÃO DE CERUMEN DE CONDUTO AUDITIVO EXTERNO UNI / BILATERAL', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0404010300', 'RETIRADA DE CORPO ESTRANHO DA CAVIDADE AUDITIVA E NASAL', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0404010342', 'TAMPONAMENTO NASAL ANTERIOR E/OU POSTERIOR', 'ambulatorial', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0414020120', 'EXODONTIA DE DENTE DECÍDUO', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0414020138', 'EXODONTIA DE DENTE PERMANENTE', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0414020383', 'TRATAMENTO DE ALVEOLITE', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
VALUES ('0414020405', 'ULOTOMIA/ULECTOMIA', 'odontologico', 'SIGTAP', 'ativo', 'seed')
ON CONFLICT (codigo_sigtap) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),
  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),
  status = 'ativo',
  atualizado_em = now();

-- Maps e-SUS → procedimentos
INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Acupuntura com inserção de agulhas', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0309050022'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Administração de vitamina A', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0101040059'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Cateterismo vesical de alívio', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301100047'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Cauterização química de pequenas lesões', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0303080019'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Cirurgia de unha (cantoplastia)', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0401020177'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Coleta de citopatológico de colo uterino', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0201020033'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Cuidado de estomas', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301100063'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Curativo especial', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301100276'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Drenagem de abscesso', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0401010031'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Eletrocardiograma', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0211020036'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Exame de fundo de olho (Fundoscopia)', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0211060100'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Exame do pé diabético', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301040095'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Exérese / Biópsia / Punção de tumores superficiais de pele', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0401010074'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Infiltração em cavidade sinovial', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0303090030'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Remoção de corpo estranho da cavidade auditiva e nasal', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0404010300'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Remoção de corpo estranho subcutâneo', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0401010112'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Retirada de cerume', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0404010270'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Retirada de pontos de cirurgias básicas (por paciente)', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301100152'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Sutura simples', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0401010066'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Tamponamento de epistaxe', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0404010342'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos / Pequenas cirurgias', 'Triagem oftalmológica', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0211060275'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos - Teste rápido', 'De gravidez', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0214010066'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos - Teste rápido', 'Dosagem de proteinúria', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0214010155'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos - Teste rápido', 'Para HIV', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0214010058'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos - Teste rápido', 'Para hepatite C', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0214010090'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos - Teste rápido', 'Para sífilis', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0214010074'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos - Administração de medicamentos', 'Endovenosa', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301100195'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos - Administração de medicamentos', 'Inalação / Nebulização', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301100101'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos - Administração de medicamentos', 'Intramuscular', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301100209'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos - Administração de medicamentos', 'Oral', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301100217'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos - Administração de medicamentos', 'Penicilina para tratamento de sífilis', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301100241'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos - Administração de medicamentos', 'Subcutânea (SC)', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301100225'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos - Administração de medicamentos', 'Tópica', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301100233'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Acesso à polpa dentária e medicação (por dente)', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0307020010'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Adaptação de prótese dentária', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0307040143'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Aplicação de cariostático (por dente)', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0101020058'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Aplicação de selante (por dente)', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0101020066'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Aplicação tópica de flúor (individual por sessão)', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0101020074'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Capeamento pulpar', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0307010015'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Cimentação de prótese dentária', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0307040135'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Curativo de demora com ou sem preparo biomecânico', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0307020029'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Drenagem de abscesso', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0401010031'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Evidenciação de placa bacteriana', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0101020082'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Exodontia de dente decíduo', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0414020120'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Exodontia de dente permanente', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0414020138'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Instalação de prótese dentária', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0307040160'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Moldagem dentogengival para construção de prótese dentária', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0307040070'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Orientação de higiene bucal', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0101020104'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Profilaxia / Remoção da placa bacteriana', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0307030040'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Pulpotomia dentária', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0307020070'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Radiografia interproximal (bite wing)', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0204010217'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Radiografia periapical', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0204010225'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Raspagem alisamento e polimento supragengivais (por sextante)', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0307030059'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Raspagem alisamento subgengivais (por sextante)', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0307030024'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Restauração de dente permanente anterior com resina composta', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0307010031'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Restauração de dente permanente posterior com resina composta', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0307010120'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Retirada de pontos de cirurgias básicas (por paciente)', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301100152'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Selamento provisório de cavidade dentária', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0101020090'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Tratamento de alveolite', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0414020383'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Procedimentos', 'Ulotomia / Ulectomia', p.id, 'seed', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0414020405'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Outros procedimentos (SIGTAP)', '0101040024 - AVALIAÇÃO ANTROPOMÉTRICA', p.id, 'nativo_sigtap', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0101040024'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Outros procedimentos (SIGTAP)', '0214010015 - GLICEMIA CAPILAR', p.id, 'nativo_sigtap', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0214010015'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Outros procedimentos (SIGTAP)', '0301010030 - CONSULTA DE PROFISSIONAIS DE NÍVEL SUPERIOR NA ATENÇÃO PRIMÁRIA (EXCETO MÉDICO)', p.id, 'nativo_sigtap', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301010030'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Outros procedimentos (SIGTAP)', '0301010064 - CONSULTA MEDICA EM ATENÇÃO PRIMÁRIA', p.id, 'nativo_sigtap', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301010064'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Outros procedimentos (SIGTAP)', '0301100039 - AFERIÇÃO DE PRESSÃO ARTERIAL', p.id, 'nativo_sigtap', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301100039'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
SELECT 'Outros procedimentos (SIGTAP)', '0301010153 - PRIMEIRA CONSULTA ODONTOLOGICA PROGRAMÁTICA', p.id, 'nativo_sigtap', 'ativo'
FROM procedimentos p WHERE p.codigo_sigtap = '0301010153'
ON CONFLICT (secao, descricao_esus) DO UPDATE SET
  procedimento_id = EXCLUDED.procedimento_id,
  origem = EXCLUDED.origem,
  status = 'ativo',
  atualizado_em = now();

COMMIT;

