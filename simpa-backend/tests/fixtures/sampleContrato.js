const samplePayload = {
  plataforma: 'SIMPA - Sistema Integrado de Monitoramento e Planejamento de Americana',
  versao_schema: '3.1.0',
  competencia: '2026-05',
  municipio: 'AMERICANA',
  filtros_ativos: {
    unidade: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
    equipe: 'EQUIPE 9 EAP',
  },
  kpis_gerais: {
    total_atendimentos_aps: 540,
    total_procedimentos_ambulatoriais: null,
    total_participantes_coletivos: 810,
    atendimentos_odonto: 209,
  },
  modulos: {
    atencao_primaria_esus: { distribuicao_turnos: [], temas_coletivos: [] },
    ambulatorial_sia: { status_conexao: 'PENDING', procedimentos_especializados: [] },
    hospitalar_sihd: { status_importacao: 'PENDING_AIH_FILE', internacoes_por_capitulo_cid: [] },
    financiamento_metas: { componente_qualidade_aps: [], igm_sus_paulista: [] },
  },
  emendas_parlamentares: [],
  indicadores_qualidade: [
    {
      cod: 'C1',
      nomeCurto: 'Acesso e Vínculo',
      nome: 'Acesso e Vínculo',
      categoria: 'Componente Qualidade APS',
      meta: null,
      exec: null,
      num: '—',
      den: '—',
      fonte: 'Relatório de Atendimento Individual',
      periodicidade: 'Quadrimestral',
    },
  ],
};

module.exports = { samplePayload };
