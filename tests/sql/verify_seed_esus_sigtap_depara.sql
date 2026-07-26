-- ============================================================================
-- Verification: seed_esus_sigtap_depara.sql (task_02)
-- docker exec -i simpa-postgres-1 psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f ...
-- ============================================================================

\set ON_ERROR_STOP on

-- Every active map joins to 10-digit SIGTAP
DO $$
DECLARE
  bad INT;
BEGIN
  SELECT COUNT(*) INTO bad
  FROM esus_procedimento_map m
  JOIN procedimentos p ON p.id = m.procedimento_id
  WHERE m.status = 'ativo'
    AND (p.codigo_sigtap !~ '^[0-9]{10}$');
  IF bad > 0 THEN
    RAISE EXCEPTION 'FAIL: % maps with non-10-digit codigo_sigtap', bad;
  END IF;
END $$;

-- No duplicate (secao, descricao_esus)
DO $$
DECLARE
  dups INT;
BEGIN
  SELECT COUNT(*) INTO dups FROM (
    SELECT secao, descricao_esus FROM esus_procedimento_map
    GROUP BY 1, 2 HAVING COUNT(*) > 1
  ) t;
  IF dups > 0 THEN
    RAISE EXCEPTION 'FAIL: duplicate (secao, descricao_esus)';
  END IF;
END $$;

-- origem enum only
DO $$
DECLARE
  bad INT;
BEGIN
  SELECT COUNT(*) INTO bad
  FROM esus_procedimento_map
  WHERE origem NOT IN ('seed', 'nativo_sigtap', 'manual');
  IF bad > 0 THEN
    RAISE EXCEPTION 'FAIL: invalid origem values';
  END IF;
END $$;

-- Spot-checks
DO $$
DECLARE
  v TEXT;
BEGIN
  SELECT p.codigo_sigtap INTO v
  FROM esus_procedimento_map m
  JOIN procedimentos p ON p.id = m.procedimento_id
  WHERE m.secao = 'Procedimentos / Pequenas cirurgias'
    AND m.descricao_esus = 'Coleta de citopatológico de colo uterino'
    AND m.status = 'ativo';
  IF v IS DISTINCT FROM '0201020033' THEN
    RAISE EXCEPTION 'FAIL: citopatológico expected 0201020033 got %', v;
  END IF;

  SELECT p.codigo_sigtap INTO v
  FROM esus_procedimento_map m
  JOIN procedimentos p ON p.id = m.procedimento_id
  WHERE m.secao = 'Procedimentos - Teste rápido'
    AND m.descricao_esus = 'Para HIV'
    AND m.status = 'ativo';
  IF v IS DISTINCT FROM '0214010058' THEN
    RAISE EXCEPTION 'FAIL: Para HIV expected 0214010058 got %', v;
  END IF;

  SELECT p.codigo_sigtap INTO v
  FROM esus_procedimento_map m
  JOIN procedimentos p ON p.id = m.procedimento_id
  WHERE m.secao = 'Procedimentos'
    AND m.descricao_esus = 'Exodontia de dente permanente'
    AND m.status = 'ativo';
  IF v IS DISTINCT FROM '0414020138' THEN
    RAISE EXCEPTION 'FAIL: Exodontia permanente expected 0414020138 got %', v;
  END IF;
END $$;

-- Coverage: municipal catalog sections
DO $$
DECLARE
  n_pc INT; n_tr INT; n_am INT; n_od INT; n_nat INT;
BEGIN
  SELECT COUNT(*) INTO n_pc FROM esus_procedimento_map WHERE secao = 'Procedimentos / Pequenas cirurgias' AND status='ativo';
  SELECT COUNT(*) INTO n_tr FROM esus_procedimento_map WHERE secao = 'Procedimentos - Teste rápido' AND status='ativo';
  SELECT COUNT(*) INTO n_am FROM esus_procedimento_map WHERE secao = 'Procedimentos - Administração de medicamentos' AND status='ativo';
  SELECT COUNT(*) INTO n_od FROM esus_procedimento_map WHERE secao = 'Procedimentos' AND status='ativo';
  SELECT COUNT(*) INTO n_nat FROM esus_procedimento_map WHERE origem = 'nativo_sigtap' AND status='ativo';

  IF n_pc < 20 THEN RAISE EXCEPTION 'FAIL: Pequenas cirurgias count % < 20', n_pc; END IF;
  IF n_tr < 5 THEN RAISE EXCEPTION 'FAIL: Teste rápido count % < 5', n_tr; END IF;
  IF n_am < 7 THEN RAISE EXCEPTION 'FAIL: Admin medicamentos count % < 7', n_am; END IF;
  IF n_od < 25 THEN RAISE EXCEPTION 'FAIL: Odonto Procedimentos count % < 25', n_od; END IF;
  IF n_nat < 5 THEN RAISE EXCEPTION 'FAIL: nativo_sigtap count % < 5', n_nat; END IF;
END $$;

\echo OK: verify_seed_esus_sigtap_depara passed
