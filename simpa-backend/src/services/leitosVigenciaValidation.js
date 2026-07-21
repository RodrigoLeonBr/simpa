const {
  LEITOS_RESUMO_KEYS,
  DETALHE_CODIGO_TO_GRUPO,
} = require('./leitosCatalog');

function normalizeLeitosResumo(leitos) {
  const source = leitos && typeof leitos === 'object' ? leitos : {};
  const result = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === 'uti') continue;
    result[key] = value;
  }
  const hasUti = Object.prototype.hasOwnProperty.call(source, 'uti');
  const hasUtiAdulto = Object.prototype.hasOwnProperty.call(source, 'uti_adulto');
  if (hasUti && !hasUtiAdulto) {
    result.uti_adulto = source.uti;
  }
  return result;
}

function rangesOverlap(aInicio, aFim, bInicio, bFim) {
  return aInicio <= bFim && bInicio <= aFim;
}

function assertDetalheConsistente(leitos, leitosDetalhe) {
  const detalhe =
    leitosDetalhe && typeof leitosDetalhe === 'object' ? leitosDetalhe : {};
  const hasPositive = Object.values(detalhe).some((value) => Number(value) > 0);
  if (!hasPositive) {
    return null;
  }

  const touchedGroups = new Set();
  for (const codigo of Object.keys(detalhe)) {
    const grupo = DETALHE_CODIGO_TO_GRUPO[codigo];
    if (grupo) {
      touchedGroups.add(grupo);
    }
  }

  for (const grupo of LEITOS_RESUMO_KEYS) {
    if (!touchedGroups.has(grupo)) continue;

    let soma = 0;
    for (const [codigo, valor] of Object.entries(detalhe)) {
      if (DETALHE_CODIGO_TO_GRUPO[codigo] === grupo) {
        soma += Number(valor) || 0;
      }
    }

    const resumoValor =
      leitos && typeof leitos[grupo] === 'number' ? leitos[grupo] : 0;

    if (soma !== resumoValor) {
      return `${grupo}: soma do detalhe (${soma}) difere do resumo (${resumoValor})`;
    }
  }

  return null;
}

function isValidYYYYMM(value, { allowOpen = false } = {}) {
  if (typeof value !== 'string' || !/^[0-9]{6}$/.test(value)) {
    return false;
  }
  if (allowOpen && value === '999999') {
    return true;
  }
  const month = Number(value.slice(4, 6));
  return month >= 1 && month <= 12;
}

function isNonNegativeInteger(value) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function validateVigenciaPayload(body) {
  const payload = body && typeof body === 'object' ? body : {};
  const { vigencia_inicio, vigencia_fim } = payload;

  if (!isValidYYYYMM(vigencia_inicio)) {
    return { ok: false, error: 'vigencia_inicio inválido (esperado YYYYMM)' };
  }
  if (!isValidYYYYMM(vigencia_fim, { allowOpen: true })) {
    return {
      ok: false,
      error: 'vigencia_fim inválido (esperado YYYYMM ou 999999)',
    };
  }
  if (vigencia_inicio > vigencia_fim) {
    return {
      ok: false,
      error: 'vigencia_inicio deve ser menor ou igual a vigencia_fim',
    };
  }

  const leitosRaw = payload.leitos;
  if (
    typeof leitosRaw !== 'object' ||
    leitosRaw === null ||
    Array.isArray(leitosRaw)
  ) {
    return { ok: false, error: 'leitos deve ser um objeto' };
  }

  const leitos = normalizeLeitosResumo(leitosRaw);
  for (const [key, value] of Object.entries(leitos)) {
    if (!LEITOS_RESUMO_KEYS.includes(key)) {
      return { ok: false, error: `leitos possui chave desconhecida: ${key}` };
    }
    if (!isNonNegativeInteger(value)) {
      return { ok: false, error: `leitos.${key} deve ser um inteiro >= 0` };
    }
  }

  const leitosDetalheRaw =
    payload.leitos_detalhe !== undefined ? payload.leitos_detalhe : {};
  if (
    typeof leitosDetalheRaw !== 'object' ||
    leitosDetalheRaw === null ||
    Array.isArray(leitosDetalheRaw)
  ) {
    return { ok: false, error: 'leitos_detalhe deve ser um objeto' };
  }
  for (const [codigo, value] of Object.entries(leitosDetalheRaw)) {
    if (!DETALHE_CODIGO_TO_GRUPO[codigo]) {
      return {
        ok: false,
        error: `leitos_detalhe possui código desconhecido: ${codigo}`,
      };
    }
    if (!isNonNegativeInteger(value)) {
      return {
        ok: false,
        error: `leitos_detalhe.${codigo} deve ser um inteiro >= 0`,
      };
    }
  }

  const consistencyError = assertDetalheConsistente(leitos, leitosDetalheRaw);
  if (consistencyError) {
    return { ok: false, error: consistencyError };
  }

  return { ok: true };
}

module.exports = {
  normalizeLeitosResumo,
  rangesOverlap,
  assertDetalheConsistente,
  validateVigenciaPayload,
};
