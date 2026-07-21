const LEITOS_RESUMO_KEYS = [
  'clinico',
  'cirurgico',
  'obstetrico',
  'pediatrico',
  'uti_adulto',
  'uti_neonatal',
];

const LEITOS_DETALHE_CATALOG = [
  { codigo: '75', descricao: 'UTI-A Tipo II', grupo: 'uti_adulto' },
  { codigo: '81', descricao: 'UTI Neonatal Tipo II', grupo: 'uti_neonatal' },
  { codigo: '03', descricao: 'Cirurgia Geral', grupo: 'cirurgico' },
  { codigo: '13', descricao: 'Ortopedia/Traumatologia', grupo: 'cirurgico' },
  { codigo: '33', descricao: 'Clínica Geral', grupo: 'clinico' },
  { codigo: '10', descricao: 'Obstetrícia Cirúrgica', grupo: 'obstetrico' },
  { codigo: '43', descricao: 'Obstetrícia Clínica', grupo: 'obstetrico' },
  { codigo: '47', descricao: 'Psiquiatria', grupo: 'clinico' },
  { codigo: '68', descricao: 'Pediatria Cirúrgica', grupo: 'pediatrico' },
  { codigo: '45', descricao: 'Pediatria Clínica', grupo: 'pediatrico' },
];

const DETALHE_CODIGO_TO_GRUPO = LEITOS_DETALHE_CATALOG.reduce((map, item) => {
  map[item.codigo] = item.grupo;
  return map;
}, {});

module.exports = {
  LEITOS_RESUMO_KEYS,
  LEITOS_DETALHE_CATALOG,
  DETALHE_CODIGO_TO_GRUPO,
};
