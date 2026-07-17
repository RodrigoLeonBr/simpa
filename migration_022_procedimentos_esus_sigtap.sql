-- ============================================================================
-- SIMPA — Migration 022: De-para procedimentos e-SUS APS → código SIGTAP
-- Depends on: schema_full.sql … migration_021_fix_painel_metricas_utf8.sql
-- Apply order: 01 schema → … → 21 fix_painel_metricas_utf8 → 22 procedimentos_esus_sigtap
-- Safe to re-run (IF NOT EXISTS + ON CONFLICT DO UPDATE).
--
-- Manual apply (non-Docker Postgres):
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_022_procedimentos_esus_sigtap.sql
-- Docker (existing container):
--   Get-Content migration_022_procedimentos_esus_sigtap.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
--
-- Objetivo: relatórios de produção por unidade agregam quantidades de
-- procedimentos por código SIGTAP. Os relatórios analíticos e-SUS
-- (procedimentos_individualizados, atendimento_odontologico,
-- atendimento_domiciliar) gravam em esus_indicadores_raw a *descrição amigável*
-- do procedimento (esus_indicadores_raw.descricao), sem o código SIGTAP.
-- Esta tabela faz o de-para descricao_esus → codigo_sigtap.
--
-- Blocos "Outros procedimentos (SIGTAP)" e "Práticas em saúde - Outros
-- procedimentos coletivos" NÃO precisam de de-para: a própria descrição já
-- traz o código (10 primeiros dígitos, separados do nome por '-' ou espaço).
-- Extração direta em query:  LEFT(regexp_replace(descricao,'\D','','g'),10)
-- ============================================================================

CREATE TABLE IF NOT EXISTS procedimentos_esus_sigtap (
    id               SERIAL PRIMARY KEY,
    tipo_relatorio   VARCHAR(40)  NOT NULL,  -- espelha esus_cargas.tipo_relatorio
    bloco            VARCHAR(120) NOT NULL,  -- seção do relatório (esus_indicadores_raw.secao)
    descricao_esus   VARCHAR(200) NOT NULL,  -- casa com esus_indicadores_raw.descricao
    codigo_sigtap    CHAR(10)     NOT NULL,
    descricao_sigtap VARCHAR(200),
    status           VARCHAR(20)  NOT NULL DEFAULT 'ativo',  -- soft-delete p/ CRUD genérico
    UNIQUE (tipo_relatorio, descricao_esus)
);

CREATE INDEX IF NOT EXISTS idx_proc_esus_sigtap_codigo
    ON procedimentos_esus_sigtap (codigo_sigtap);

COMMENT ON TABLE procedimentos_esus_sigtap IS
    'De-para descrição amigável e-SUS APS → código SIGTAP, para relatórios de produção por unidade. Join: esus_indicadores_raw.descricao = descricao_esus AND esus_cargas.tipo_relatorio = tipo_relatorio.';
COMMENT ON COLUMN procedimentos_esus_sigtap.codigo_sigtap IS
    'Código SIGTAP de 10 dígitos (10 primeiros números do campo Código SIGTAP do relatório).';

-- ----------------------------------------------------------------------------
-- Seed. codigo_sigtap = 10 primeiros dígitos. descricao_sigtap conforme
-- coluna "Código SIGTAP" do relatório (pode divergir do nome oficial SIGTAP;
-- mantido como veio do e-SUS — corrigir só se virar requisito).
-- ----------------------------------------------------------------------------
INSERT INTO procedimentos_esus_sigtap (tipo_relatorio, bloco, descricao_esus, codigo_sigtap, descricao_sigtap) VALUES
-- === procedimentos_individualizados: Procedimentos / Pequenas cirurgias ===
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Acupuntura com inserção de agulhas','0309050022','SESSÃO DE ACUPUNTURA COM INSERÇÃO DE AGULHAS'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Administração de vitamina A','0101040059','ADMINISTRAÇÃO DE VITAMINA A'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Cateterismo vesical de alívio','0301100047','CATETERISMO VESICAL DE ALIVIO'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Cauterização química de pequenas lesões','0303080019','CAUTERIZAÇÃO QUÍMICA DE PEQUENAS LESÕES'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Cirurgia de unha (cantoplastia)','0401020177','CIRURGIA DE UNHA (CANTOPLASTIA)'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Coleta de citopatológico de colo uterino','0201020033','COLETA DE MATERIAL DO COLO DE ÚTERO PARA EXAME CITOPATOLÓGICO'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Cuidado de estomas','0301100063','CUIDADOS COM ESTOMAS'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Curativo especial','0301100276','CURATIVO ESPECIAL'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Drenagem de abscesso','0401010031','DRENAGEM DE ABSCESSO'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Eletrocardiograma','0211020036','ELETROCARDIOGRAMA'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Exame de fundo de olho (Fundoscopia)','0211060100','FUNDOSCOPIA'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Exame do pé diabético','0301040095','EXAME DO PÉ DIABÉTICO'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Exérese / Biópsia / Punção de tumores superficiais de pele','0401010074','EXERESE DE TUMOR DE PELE E ANEXOS / CISTO SEBACEO / LIPOMA'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Infiltração em cavidade sinovial','0303090030','INFILTRACAO DE SUBSTANCIAS EM CAVIDADE SINOVIAL (ARTICULACAO, BAINHA TENDINOSA)'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Retirada de cerume','0404010270','REMOCAO DE CERUMEN DE CONDUTO AUDITIVO EXTERNO UNI / BILATERAL'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Retirada de pontos de cirurgias básicas (por paciente)','0301100152','RETIRADA DE PONTOS DE CIRURGIAS (POR PACIENTE)'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Sutura simples','0401010058','EXCISAO DE LESAO E/OU SUTURA DE FERIMENTO DA PELE ANEXOS E MUCOSA'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Tamponamento de epistaxe','0404010342','TAMPONAMENTO NASAL ANTERIOR E/OU POSTERIOR'),
('procedimentos_individualizados','Procedimentos / Pequenas cirurgias','Triagem oftalmológica','0211060275','TRIAGEM OFTALMOLÓGICA'),
-- === procedimentos_individualizados: Testes rápidos ===
('procedimentos_individualizados','Testes rápidos','De gravidez','0214010066','TESTE RÁPIDO DE GRAVIDEZ'),
('procedimentos_individualizados','Testes rápidos','Dosagem de proteinúria','0214010155','TESTE RÁPIDO DE PROTEINÚRIA'),
('procedimentos_individualizados','Testes rápidos','Para HIV','0214010058','TESTE RÁPIDO PARA DETECÇÃO DE INFECÇÃO PELO HIV'),
('procedimentos_individualizados','Testes rápidos','Para hepatite C','0214010090','TESTE RÁPIDO PARA DETECÇÃO DE HEPATITE C'),
('procedimentos_individualizados','Testes rápidos','Para sífilis','0214010074','TESTE RÁPIDO PARA SÍFILIS'),
-- === procedimentos_individualizados: Administração de medicamentos ===
('procedimentos_individualizados','Administração de medicamentos','Endovenosa','0301100195','ADMINISTRAÇÃO DE MEDICAMENTOS POR VIA ENDOVENOSA'),
('procedimentos_individualizados','Administração de medicamentos','Inalação / Nebulização','0301100101','INALAÇÃO / NEBULIZAÇÃO'),
('procedimentos_individualizados','Administração de medicamentos','Intramuscular','0301100209','ADMINISTRAÇÃO DE MEDICAMENTOS POR VIA INTRAMUSCULAR'),
('procedimentos_individualizados','Administração de medicamentos','Oral','0301100217','ADMINISTRAÇÃO DE MEDICAMENTOS POR VIA ORAL'),
('procedimentos_individualizados','Administração de medicamentos','Penicilina para tratamento de sífilis','0301100241','ADMINISTRAÇÃO DE PENICILINA PARA TRATAMENTO DE SÍFILIS'),
('procedimentos_individualizados','Administração de medicamentos','Subcutânea (SC)','0301100225','ADMINISTRAÇÃO DE MEDICAMENTOS POR VIA SUBCUTÂNEA (SC)'),
('procedimentos_individualizados','Administração de medicamentos','Tópica','0301100233','ADMINISTRAÇÃO TÓPICA DE MEDICAMENTO(S)'),
-- === atendimento_odontologico: Procedimentos ===
('atendimento_odontologico','Procedimentos','Acesso à polpa dentária e medicação (por dente)','0307020010','ACESSO A POLPA DENTARIA E MEDICACAO (POR DENTE)'),
('atendimento_odontologico','Procedimentos','Adaptação de prótese dentária','0307040143','ADAPTAÇÃO DE PRÓTESE DENTÁRIA'),
('atendimento_odontologico','Procedimentos','Aplicação de cariostático (por dente)','0101020058','APLICAÇÃO DE CARIOSTÁTICO (POR DENTE)'),
('atendimento_odontologico','Procedimentos','Aplicação de selante (por dente)','0101020066','APLICAÇÃO DE SELANTE (POR DENTE)'),
('atendimento_odontologico','Procedimentos','Aplicação tópica de flúor (individual por sessão)','0101020074','APLICAÇÃO TÓPICA DE FLÚOR (INDIVIDUAL POR SESSÃO)'),
('atendimento_odontologico','Procedimentos','Capeamento pulpar','0307010015','CAPEAMENTO PULPAR'),
('atendimento_odontologico','Procedimentos','Cimentação de prótese dentária','0307040135','CIMENTAÇÃO DE PRÓTESE DENTÁRIA'),
('atendimento_odontologico','Procedimentos','Curativo de demora com ou sem preparo biomecânico','0307020029','CURATIVO DE DEMORA C/ OU S/ PREPARO BIOMECANICO'),
('atendimento_odontologico','Procedimentos','Drenagem de abscesso','0401010031','DRENAGEM DE ABSCESSO'),
('atendimento_odontologico','Procedimentos','Evidenciação de placa bacteriana','0101020082','EVIDENCIAÇÃO DE PLACA BACTERIANA'),
('atendimento_odontologico','Procedimentos','Exodontia de dente decíduo','0414020120','EXODONTIA DE DENTE DECÍDUO'),
('atendimento_odontologico','Procedimentos','Exodontia de dente permanente','0414020138','EXODONTIA DE DENTE PERMANENTE'),
('atendimento_odontologico','Procedimentos','Instalação de prótese dentária','0307040160','INSTALAÇÃO DE PRÓTESE DENTÁRIA'),
('atendimento_odontologico','Procedimentos','Moldagem dentogengival para construção de prótese dentária','0307040070','MOLDAGEM DENTOGENGIVAL P/ CONSTRUCAO DE PROTESE DENTARIA'),
('atendimento_odontologico','Procedimentos','Orientação de higiene bucal','0101020104','ORIENTAÇÃO DE HIGIENE BUCAL'),
('atendimento_odontologico','Procedimentos','Profilaxia / Remoção da placa bacteriana','0307030040','PROFILAXIA / REMOÇÃO DA PLACA BACTERIANA'),
('atendimento_odontologico','Procedimentos','Pulpotomia dentária','0307020070','PULPOTOMIA DENTÁRIA'),
('atendimento_odontologico','Procedimentos','Radiografia interproximal (bite wing)','0204010217','RADIOGRAFIA INTERPROXIMAL (BITE WING)'),
('atendimento_odontologico','Procedimentos','Radiografia periapical','0204010225','RADIOGRAFIA PERIAPICAL'),
('atendimento_odontologico','Procedimentos','Raspagem alisamento e polimento supragengivais (por sextante)','0307030059','RASPAGEM ALISAMENTO E POLIMENTO SUPRAGENGIVAIS (POR SEXTANTE)'),
('atendimento_odontologico','Procedimentos','Raspagem alisamento subgengivais (por sextante)','0307030024','RASPAGEM ALISAMENTO SUBGENGIVAIS (POR SEXTANTE)'),
('atendimento_odontologico','Procedimentos','Restauração de dente permanente anterior com resina composta','0307010031','RESTAURAÇÃO DE DENTE PERMANENTE ANTERIOR COM RESINA COMPOSTA'),
('atendimento_odontologico','Procedimentos','Restauração de dente permanente posterior com resina composta','0307010082','RESTAURAÇÃO DE DENTE DECÍDUO POSTERIOR COM RESINA COMPOSTA'),
('atendimento_odontologico','Procedimentos','Retirada de pontos de cirurgias básicas (por paciente)','0301100152','RETIRADA DE PONTOS DE CIRURGIAS (POR PACIENTE)'),
('atendimento_odontologico','Procedimentos','Selamento provisório de cavidade dentária','0101020090','SELAMENTO PROVISÓRIO DE CAVIDADE DENTÁRIA'),
('atendimento_odontologico','Procedimentos','Tratamento de alveolite','0414020383','TRATAMENTO DE ALVEOLITE'),
('atendimento_odontologico','Procedimentos','Ulotomia / Ulectomia','0414020405','ULOTOMIA/ULECTOMIA'),
-- === atendimento_domiciliar: Procedimentos ===
('atendimento_domiciliar','Procedimentos','Acompanhamento de paciente em reabilitação em comunicação alternativa','0301070024','ACOMPANHAMENTO DE PACIENTE EM REABILITACAO EM COMUNICACAO ALTERNATIVA'),
('atendimento_domiciliar','Procedimentos','Antibioticoterapia parenteral','0301050082','ANTIBIOTICOTERAPIA PARENTERAL'),
('atendimento_domiciliar','Procedimentos','Atendimento / Acompanhamento de paciente em reabilitação do desenvolvimento neuropsicomotor','0301070075','ATENDIMENTO / ACOMPANHAMENTO DE PACIENTE EM REABILITACAO DO DESENVOLVIMENTO NEUROPSICOMOTOR'),
('atendimento_domiciliar','Procedimentos','Atendimento / Acompanhamento em reabilitação nas múltiplas deficiências','0301070067','ATENDIMENTO / ACOMPANHAMENTO EM REABILITAÇÃO NAS MULTIPLAS DEFICIÊNCIAS'),
('atendimento_domiciliar','Procedimentos','Atendimento fisioterapêutico em paciente com transtorno respiratório sem complicações sistêmicas','0302040013','ATENDIMENTO FISIOTERAPÊUTICO EM PACIENTE COM TRANSTORNO RESPIRATÓRIO COM COMPLICAÇÕES SISTÊMICAS'),
('atendimento_domiciliar','Procedimentos','Atendimento médico com finalidade de atestar óbito','0301050090','ATENDIMENTO MEDICO COM FINALIDADE DE ATESTAR ÓBITO'),
('atendimento_domiciliar','Procedimentos','Cateterismo vesical de alívio','0301100047','CATETERISMO VESICAL DE ALIVIO'),
('atendimento_domiciliar','Procedimentos','Cateterismo vesical de demora','0301100055','CATETERISMO VESICAL DE DEMORA'),
('atendimento_domiciliar','Procedimentos','Coleta de material para exame laboratorial','0201020041','COLETA DE MATERIAL PARA EXAME LABORATORIAL'),
('atendimento_domiciliar','Procedimentos','Cuidado de estomas','0301100063','CUIDADOS COM ESTOMAS'),
('atendimento_domiciliar','Procedimentos','Cuidados com traqueostomia','0301100071','CUIDADOS C/ TRAQUEOSTOMIA'),
('atendimento_domiciliar','Procedimentos','Enema','0301100098','ENEMA'),
('atendimento_domiciliar','Procedimentos','Oxigenoterapia','0301100144','OXIGENOTERAPIA POR DIA'),
('atendimento_domiciliar','Procedimentos','Retirada de pontos de cirurgias básicas (por paciente)','0301100152','RETIRADA DE PONTOS DE CIRURGIAS (POR PACIENTE)'),
('atendimento_domiciliar','Procedimentos','Sondagem gástrica','0301100179','SONDAGEM GÁSTRICA'),
('atendimento_domiciliar','Procedimentos','Terapia de reidratação oral','0301100187','TERAPIA DE REIDRATAÇÃO ORAL'),
('atendimento_domiciliar','Procedimentos','Terapia de reidratação parenteral','0301050120','TERAPIA DE REIDRATAÇÃO PARENTERAL'),
('atendimento_domiciliar','Procedimentos','Terapia fonoaudiológica individual','0301070113','TERAPIA FONOAUDIOLÓGICA INDIVIDUAL'),
('atendimento_domiciliar','Procedimentos','Tratamento de traumatismos de localização especificada / não especificada','0308010019','TRATAMENTO CLÍNICO/CONSERVADOR DE TRAUMATISMOS DE QUALQUER LOCALIZAÇÃO'),
('atendimento_domiciliar','Procedimentos','Tratamento em reabilitação','0303190019','TRATAMENTO EM REABILITACAO')
ON CONFLICT (tipo_relatorio, descricao_esus) DO UPDATE SET
    bloco            = EXCLUDED.bloco,
    codigo_sigtap    = EXCLUDED.codigo_sigtap,
    descricao_sigtap = EXCLUDED.descricao_sigtap;
