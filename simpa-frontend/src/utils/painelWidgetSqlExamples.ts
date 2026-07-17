export interface PainelSqlExample {
  id: string;
  title: string;
  hint: string;
  sql: string;
  target: 'main' | 'spark' | 'both';
}

export interface PainelSqlExampleGroup {
  id: string;
  label: string;
  examples: PainelSqlExample[];
}

export const PAINEL_SQL_EXAMPLE_GROUPS: PainelSqlExampleGroup[] = [
  {
    id: 'contrato',
    label: 'Contrato & placeholders',
    examples: [
      {
        id: 'placeholders',
        title: 'Placeholders permitidos',
        hint: 'Substituídos no servidor (bind seguro). Não use $1/$2 manualmente.',
        target: 'both',
        sql: `-- :competencia       → YYYY-MM (vira date YYYY-MM-01)
-- :estabelecimento_id → bigint ou NULL (visão municipal)
-- :equipe_id          → bigint ou NULL (SIA ignora; e-SUS APS usa)

WHERE sp.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)`,
      },
      {
        id: 'valor-unico',
        title: 'Formato card (1 linha, coluna valor)',
        hint: 'Cards e KPIs esperam alias valor numérico ou NULL.',
        target: 'main',
        sql: `SELECT COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)`,
      },
      {
        id: 'serie-historica',
        title: 'Formato sparkline / gráfico linha',
        hint: 'Múltiplas linhas: competencia (YYYY-MM) + valor. LIMIT recomendado.',
        target: 'spark',
        sql: `SELECT to_char(sp.competencia, 'YYYY-MM') AS competencia,
       COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia >= (:competencia::date - INTERVAL '11 months')
  AND sp.competencia <= :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY sp.competencia
ORDER BY sp.competencia
LIMIT 12`,
      },
    ],
  },
  {
    id: 'sia-financeiro',
    label: 'SIA — financeiro',
    examples: [
      {
        id: 'taxa-glosa',
        title: 'Taxa de glosa (%)',
        hint: 'Percentual armazenado como fração 0–1 quando formato=percentual.',
        target: 'main',
        sql: `SELECT ROUND(
    (COALESCE(SUM(sp.valor_apresentado), 0) - COALESCE(SUM(sp.valor_aprovado), 0))
    / NULLIF(COALESCE(SUM(sp.valor_apresentado), 0), 0),
    4
) AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)`,
      },
      {
        id: 'valor-mac',
        title: 'Produção MAC (rubrica 0301)',
        hint: 'financiamento SIA usa rubrica 4 chars; SIH usa 2 chars.',
        target: 'main',
        sql: `SELECT COALESCE(SUM(sp.valor_aprovado), 0) AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND sp.rubrica = '0301'
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)`,
      },
      {
        id: 'pate-ambulatorial',
        title: 'PATE ambulatorial (0301/0602/0604)',
        hint: 'Ajuste rubricas conforme contrato local.',
        target: 'main',
        sql: `SELECT COALESCE(SUM(sp.valor_aprovado), 0) AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND sp.rubrica IN ('0301', '0602', '0604')
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)`,
      },
    ],
  },
  {
    id: 'sia-producao',
    label: 'SIA — produção & SIGTAP',
    examples: [
      {
        id: 'grupo-cirurgico',
        title: 'Procedimentos grupo 04 (cirúrgico)',
        hint: 'LEFT(codigo_sigtap, 2) = grupo SIGTAP.',
        target: 'main',
        sql: `SELECT COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND LEFT(sp.codigo_sigtap, 2) = '04'
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)`,
      },
      {
        id: 'consultas-0303',
        title: 'Consultas especializadas (0303)',
        hint: 'Subgrupo SIGTAP de 4 dígitos.',
        target: 'main',
        sql: `SELECT COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND LEFT(sp.codigo_sigtap, 4) = '0303'
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)`,
      },
      {
        id: 'ranking-unidades',
        title: 'Ranking por unidade (gráfico ranking)',
        hint: 'Colunas: label/unidade + valor. Backend limita via fonte_config.limite.',
        target: 'main',
        sql: `SELECT e.nome AS unidade,
       COALESCE(SUM(sp.valor_aprovado), 0) AS valor,
       sp.estabelecimento_id
FROM sia_producao sp
JOIN estabelecimentos e ON e.id = sp.estabelecimento_id
WHERE sp.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY e.nome, sp.estabelecimento_id
ORDER BY valor DESC
LIMIT 20`,
      },
    ],
  },
  {
    id: 'sih',
    label: 'SIH — internações',
    examples: [
      {
        id: 'total-aih',
        title: 'Total internações (agregado PG)',
        hint: 'Tabela sih_internacoes — sem número AIH individual.',
        target: 'main',
        sql: `SELECT COALESCE(SUM(si.qtd_aih), 0)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)`,
      },
      {
        id: 'aih-mascara-eletiva',
        title: 'Cirurgia eletiva PATE — 5º dígito AIH = 5',
        hint: 'Máscara ????5???????? via SUBSTRING(aih, 5, 1). Índice idx_sih_aih_digito5 acelera.',
        target: 'main',
        sql: `SELECT COUNT(*)::bigint AS valor
FROM sih_aih sa
WHERE sa.competencia = :competencia::date
  AND SUBSTRING(sa.aih FROM 5 FOR 1) = '5'
  AND (:estabelecimento_id::bigint IS NULL
       OR sa.estabelecimento_id = :estabelecimento_id::bigint)`,
      },
      {
        id: 'aih-spark-eletiva',
        title: 'Série mensal — AIH 5º dígito = 5',
        hint: 'Sparkline alinhada à métrica principal (mesma máscara).',
        target: 'spark',
        sql: `SELECT to_char(sa.competencia, 'YYYY-MM') AS competencia,
       COUNT(*)::bigint AS valor
FROM sih_aih sa
WHERE sa.competencia >= (:competencia::date - INTERVAL '11 months')
  AND sa.competencia <= :competencia::date
  AND SUBSTRING(sa.aih FROM 5 FOR 1) = '5'
  AND (:estabelecimento_id::bigint IS NULL
       OR sa.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY sa.competencia
ORDER BY sa.competencia
LIMIT 12`,
      },
      {
        id: 'sih-spark',
        title: 'Série mensal SIH',
        hint: 'Sparkline com mesma regra de filtros da métrica principal.',
        target: 'spark',
        sql: `SELECT to_char(si.competencia, 'YYYY-MM') AS competencia,
       COALESCE(SUM(si.qtd_aih), 0)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia >= (:competencia::date - INTERVAL '11 months')
  AND si.competencia <= :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY si.competencia
ORDER BY si.competencia
LIMIT 12`,
      },
    ],
  },
];

export function findSqlExample(id: string): PainelSqlExample | undefined {
  for (const group of PAINEL_SQL_EXAMPLE_GROUPS) {
    const match = group.examples.find((item) => item.id === id);
    if (match) return match;
  }
  return undefined;
}
