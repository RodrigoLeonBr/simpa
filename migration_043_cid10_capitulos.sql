-- ============================================================================
-- migration_043_cid10_capitulos.sql
--
-- Tabela de capítulos CID-10 (22 capítulos oficiais DATASUS, pt-BR) com a faixa
-- de categorias de 3 caracteres que define cada capítulo.
--
-- Corrige o indicador "Internações por CID": antes agrupava por LEFT(diag, 1)
-- (apenas a 1ª letra), o que atribui capítulo errado — as letras D (C00-D48 =
-- cap. II vs D50-D89 = cap. III) e H (olho vs ouvido) cruzam dois capítulos.
-- O capítulo correto só se resolve pela categoria de 3 chars (LEFT(diag, 3)).
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + ON CONFLICT + UPDATE.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cid10_capitulos (
    numero       smallint   PRIMARY KEY,   -- 1..22
    rotulo       text       NOT NULL,      -- algarismo romano, ex. 'IX'
    titulo       text       NOT NULL,      -- descrição oficial pt-BR
    faixa_inicio char(3)    NOT NULL,      -- categoria inicial, ex. 'I00'
    faixa_fim    char(3)    NOT NULL       -- categoria final,   ex. 'I99'
);

INSERT INTO cid10_capitulos (numero, rotulo, titulo, faixa_inicio, faixa_fim) VALUES
    (1,  'I',    'Algumas doenças infecciosas e parasitárias',                                                              'A00', 'B99'),
    (2,  'II',   'Neoplasias (tumores)',                                                                                    'C00', 'D48'),
    (3,  'III',  'Doenças do sangue e dos órgãos hematopoéticos e alguns transtornos imunitários',                          'D50', 'D89'),
    (4,  'IV',   'Doenças endócrinas, nutricionais e metabólicas',                                                          'E00', 'E90'),
    (5,  'V',    'Transtornos mentais e comportamentais',                                                                   'F00', 'F99'),
    (6,  'VI',   'Doenças do sistema nervoso',                                                                              'G00', 'G99'),
    (7,  'VII',  'Doenças do olho e anexos',                                                                                'H00', 'H59'),
    (8,  'VIII', 'Doenças do ouvido e da apófise mastóide',                                                                 'H60', 'H95'),
    (9,  'IX',   'Doenças do aparelho circulatório',                                                                        'I00', 'I99'),
    (10, 'X',    'Doenças do aparelho respiratório',                                                                        'J00', 'J99'),
    (11, 'XI',   'Doenças do aparelho digestivo',                                                                           'K00', 'K93'),
    (12, 'XII',  'Doenças da pele e do tecido subcutâneo',                                                                  'L00', 'L99'),
    (13, 'XIII', 'Doenças do sistema osteomuscular e do tecido conjuntivo',                                                 'M00', 'M99'),
    (14, 'XIV',  'Doenças do aparelho geniturinário',                                                                       'N00', 'N99'),
    (15, 'XV',   'Gravidez, parto e puerpério',                                                                             'O00', 'O99'),
    (16, 'XVI',  'Algumas afecções originadas no período perinatal',                                                        'P00', 'P96'),
    (17, 'XVII', 'Malformações congênitas, deformidades e anomalias cromossômicas',                                         'Q00', 'Q99'),
    (18, 'XVIII','Sintomas, sinais e achados anormais de exames clínicos e de laboratório, não classificados em outra parte', 'R00', 'R99'),
    (19, 'XIX',  'Lesões, envenenamento e algumas outras consequências de causas externas',                                 'S00', 'T98'),
    (20, 'XX',   'Causas externas de morbidade e de mortalidade',                                                           'V01', 'Y98'),
    (21, 'XXI',  'Fatores que influenciam o estado de saúde e o contato com os serviços de saúde',                          'Z00', 'Z99'),
    (22, 'XXII', 'Códigos para propósitos especiais',                                                                       'U04', 'U99')
ON CONFLICT (numero) DO UPDATE
    SET rotulo       = EXCLUDED.rotulo,
        titulo       = EXCLUDED.titulo,
        faixa_inicio = EXCLUDED.faixa_inicio,
        faixa_fim    = EXCLUDED.faixa_fim;

-- ----------------------------------------------------------------------------
-- Corrige o sql_template da métrica dinâmica sih.internacoes_por_cid:
-- resolve o capítulo pela categoria de 3 chars contra cid10_capitulos.
-- ----------------------------------------------------------------------------
UPDATE painel_metricas_catalogo
SET sql_template = $sql$
SELECT c.rotulo || ' — ' || c.titulo AS unidade,
       SUM(si.qtd_aih)::bigint        AS valor
FROM sih_internacoes si
JOIN cid10_capitulos c
  ON UPPER(LEFT(si.diag_principal, 3)) BETWEEN c.faixa_inicio AND c.faixa_fim
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
  AND si.diag_principal IS NOT NULL
  AND si.diag_principal <> ''
GROUP BY c.numero, c.rotulo, c.titulo
ORDER BY valor DESC
LIMIT 10
$sql$
WHERE chave = 'sih.internacoes_por_cid';
