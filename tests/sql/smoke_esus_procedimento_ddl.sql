-- ============================================================================
-- Smoke checks: procedimentos + esus_procedimento_map DDL (task_01)
-- Run: psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f tests/sql/smoke_esus_procedimento_ddl.sql
-- Exit 0 = all assertions passed.
-- ============================================================================

\set ON_ERROR_STOP on

-- 1) Tables exist
DO $$
BEGIN
  IF to_regclass('public.procedimentos') IS NULL THEN
    RAISE EXCEPTION 'FAIL: procedimentos missing';
  END IF;
  IF to_regclass('public.esus_procedimento_map') IS NULL THEN
    RAISE EXCEPTION 'FAIL: esus_procedimento_map missing';
  END IF;
END $$;

-- 2) Idempotent: re-create stubs should not fail (IF NOT EXISTS already applied)
CREATE TABLE IF NOT EXISTS procedimentos (
    id BIGSERIAL PRIMARY KEY,
    codigo_sigtap VARCHAR(20) NOT NULL UNIQUE,
    descricao TEXT NOT NULL,
    tipo VARCHAR(40),
    tabela_referencia VARCHAR(40) NOT NULL DEFAULT 'SIGTAP',
    status VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em TIMESTAMP NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS esus_procedimento_map (
    id BIGSERIAL PRIMARY KEY,
    secao TEXT NOT NULL,
    descricao_esus TEXT NOT NULL,
    procedimento_id BIGINT NOT NULL REFERENCES procedimentos(id),
    origem VARCHAR(20) NOT NULL CHECK (origem IN ('seed', 'nativo_sigtap', 'manual')),
    status VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em TIMESTAMP NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (secao, descricao_esus)
);

-- 3) Unique codigo_sigtap
DO $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO procedimentos (codigo_sigtap, descricao)
  VALUES ('9999999901', 'SMOKE PROC UNIQUE A')
  RETURNING id INTO v_id;

  BEGIN
    INSERT INTO procedimentos (codigo_sigtap, descricao)
    VALUES ('9999999901', 'SMOKE PROC UNIQUE B');
    RAISE EXCEPTION 'FAIL: duplicate codigo_sigtap allowed';
  EXCEPTION WHEN unique_violation THEN
    NULL; -- expected
  END;

  DELETE FROM procedimentos WHERE id = v_id;
END $$;

-- 4) Unique (secao, descricao_esus) + FK
DO $$
DECLARE
  v_proc BIGINT;
  v_map  BIGINT;
BEGIN
  INSERT INTO procedimentos (codigo_sigtap, descricao)
  VALUES ('9999999902', 'SMOKE PROC MAP')
  RETURNING id INTO v_proc;

  INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem)
  VALUES ('SMOKE / Secao', 'Label smoke', v_proc, 'manual')
  RETURNING id INTO v_map;

  BEGIN
    INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem)
    VALUES ('SMOKE / Secao', 'Label smoke', v_proc, 'manual');
    RAISE EXCEPTION 'FAIL: duplicate (secao, descricao_esus) allowed';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem)
    VALUES ('SMOKE / Secao', 'Label FK fail', 0, 'manual');
    RAISE EXCEPTION 'FAIL: invalid procedimento_id allowed';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  DELETE FROM esus_procedimento_map WHERE id = v_map;
  DELETE FROM procedimentos WHERE id = v_proc;
END $$;

-- 5) Defaults
DO $$
DECLARE
  v_ref TEXT;
  v_st  TEXT;
BEGIN
  INSERT INTO procedimentos (codigo_sigtap, descricao)
  VALUES ('9999999903', 'SMOKE DEFAULTS')
  RETURNING tabela_referencia, status INTO v_ref, v_st;

  IF v_ref IS DISTINCT FROM 'SIGTAP' THEN
    RAISE EXCEPTION 'FAIL: tabela_referencia default expected SIGTAP got %', v_ref;
  END IF;
  IF v_st IS DISTINCT FROM 'ativo' THEN
    RAISE EXCEPTION 'FAIL: status default expected ativo got %', v_st;
  END IF;

  DELETE FROM procedimentos WHERE codigo_sigtap = '9999999903';
END $$;

\echo OK: smoke_esus_procedimento_ddl passed
