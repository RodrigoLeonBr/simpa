-- Shared resolve: e-SUS raw × active map × active procedimentos (silent skip unmapped)
-- Used by Node export and Python consolidator (ADR-004).
CREATE OR REPLACE FUNCTION resolve_mapped_procedures(
    p_competencia date,
    p_unidade text,
    p_equipe text
)
RETURNS TABLE (
    secao text,
    descricao_esus text,
    codigo_sigtap varchar,
    descricao_sigtap text,
    quantidade int
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        r.secao::text,
        r.descricao::text AS descricao_esus,
        p.codigo_sigtap,
        p.descricao::text AS descricao_sigtap,
        COALESCE(SUM((r.valores->>'quantidade')::int), 0)::int AS quantidade
    FROM esus_indicadores_raw r
    JOIN esus_cargas c ON c.id = r.carga_id
    JOIN esus_procedimento_map m
      ON m.secao = r.secao
     AND m.descricao_esus = r.descricao
     AND m.status = 'ativo'
    JOIN procedimentos p
      ON p.id = m.procedimento_id
     AND p.status = 'ativo'
    WHERE c.competencia = p_competencia
      AND c.unidade = p_unidade
      AND c.equipe_nome = p_equipe
    GROUP BY r.secao, r.descricao, p.codigo_sigtap, p.descricao
    ORDER BY r.secao, r.descricao;
$$;

COMMENT ON FUNCTION resolve_mapped_procedures(date, text, text) IS
    'Shared e-SUS→SIGTAP resolve. Exact (secao, descricao); active maps only; silent skip unmapped.';
