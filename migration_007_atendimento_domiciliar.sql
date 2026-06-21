-- migration_007_atendimento_domiciliar.sql
-- Expand esus_cargas.tipo_relatorio CHECK to accept atendimento domiciliar exports.
--
-- Manual apply (non-Docker Postgres):
--   psql -U postgres -d simpa -f migration_007_atendimento_domiciliar.sql

ALTER TABLE esus_cargas DROP CONSTRAINT IF EXISTS esus_cargas_tipo_relatorio_check;

ALTER TABLE esus_cargas ADD CONSTRAINT esus_cargas_tipo_relatorio_check
  CHECK (tipo_relatorio IN (
    'atendimento_individual',
    'atendimento_domiciliar',
    'atendimento_odontologico',
    'atividade_coletiva',
    'marcadores_consumo_alimentar',
    'procedimentos_individualizados'
  ));
