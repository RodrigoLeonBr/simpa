// Periodo do Painel: mes (YYYY-MM), trimestre (YYYY-Tn), quadrimestre (YYYY-Qn), ano (YYYY).
// Resolve qualquer grao num intervalo de meses [inicio..fim] + lista de meses.
// `competencia` = mes representativo (fim do periodo) para templates que usam :competencia.

const MES_RE = /^(\d{4})-(\d{2})$/;
const TRI_RE = /^(\d{4})-T([1-4])$/;
const QUAD_RE = /^(\d{4})-Q([1-3])$/;
const ANO_RE = /^(\d{4})$/;

const GRAOS = {
  trimestre: { span: 3, max: 4 },
  quadrimestre: { span: 4, max: 3 },
};

function mesStr(ano, mes) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

function buildMeses(ano, primeiroMes, span) {
  const meses = [];
  for (let i = 0; i < span; i += 1) {
    meses.push(mesStr(ano, primeiroMes + i));
  }
  return meses;
}

function build(tipo, ano, indice, primeiroMes, span) {
  const meses = buildMeses(ano, primeiroMes, span);
  return {
    tipo,
    ano,
    indice,
    inicio: meses[0],
    fim: meses[meses.length - 1],
    meses,
    competencia: meses[meses.length - 1],
  };
}

function resolvePeriodo(valor) {
  const str = String(valor ?? '').trim();

  let m = MES_RE.exec(str);
  if (m) {
    const mes = Number.parseInt(m[2], 10);
    if (mes < 1 || mes > 12) {
      throw new Error(`periodo invalido — mes fora de 01-12: ${str}`);
    }
    return build('mes', Number.parseInt(m[1], 10), mes, mes, 1);
  }

  m = TRI_RE.exec(str);
  if (m) {
    const ano = Number.parseInt(m[1], 10);
    const indice = Number.parseInt(m[2], 10);
    return build('trimestre', ano, indice, (indice - 1) * GRAOS.trimestre.span + 1, GRAOS.trimestre.span);
  }

  m = QUAD_RE.exec(str);
  if (m) {
    const ano = Number.parseInt(m[1], 10);
    const indice = Number.parseInt(m[2], 10);
    return build('quadrimestre', ano, indice, (indice - 1) * GRAOS.quadrimestre.span + 1, GRAOS.quadrimestre.span);
  }

  m = ANO_RE.exec(str);
  if (m) {
    return build('ano', Number.parseInt(m[1], 10), 1, 1, 12);
  }

  throw new Error(`periodo invalido: ${str} (use YYYY-MM, YYYY-Tn, YYYY-Qn ou YYYY)`);
}

function getPreviousPeriodo(valor) {
  const p = resolvePeriodo(valor);

  if (p.tipo === 'mes') {
    const prevMes = p.indice === 1 ? 12 : p.indice - 1;
    const prevAno = p.indice === 1 ? p.ano - 1 : p.ano;
    return mesStr(prevAno, prevMes);
  }

  if (p.tipo === 'ano') {
    return String(p.ano - 1);
  }

  const grao = GRAOS[p.tipo];
  const prevIndice = p.indice === 1 ? grao.max : p.indice - 1;
  const prevAno = p.indice === 1 ? p.ano - 1 : p.ano;
  const sufixo = p.tipo === 'trimestre' ? 'T' : 'Q';
  return `${prevAno}-${sufixo}${prevIndice}`;
}

module.exports = { resolvePeriodo, getPreviousPeriodo };
