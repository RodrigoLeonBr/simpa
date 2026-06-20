import { describe, expect, it } from 'vitest';
import { CADASTRO_ENTITIES, getCadastroEntity } from '../config/cadastroEntities';
import {
  formatCadastroCell,
  formatCadastroStatus,
  validateCadastroForm,
} from './cadastroView';

describe('validateCadastroForm', () => {
  it('requires id_emenda for emendas', () => {
    const fields = CADASTRO_ENTITIES.find((entity) => entity.key === 'emendas')!.fields;
    const errors = validateCadastroForm({ esfera: 'Federal' }, fields);

    expect(errors.id_emenda).toMatch(/obrigatório/i);
  });

  it('requires esfera for emendas', () => {
    const fields = CADASTRO_ENTITIES.find((entity) => entity.key === 'emendas')!.fields;
    const errors = validateCadastroForm({ id_emenda: 'EM001' }, fields);

    expect(errors.esfera).toMatch(/obrigatório/i);
  });

  it('passes when required emenda fields are present', () => {
    const emendaFields = CADASTRO_ENTITIES.find((entity) => entity.key === 'emendas')!.fields;
    const equipeFields = CADASTRO_ENTITIES.find((entity) => entity.key === 'equipes')!.fields;

    expect(
      validateCadastroForm(
        { id_emenda: 'EM001', esfera: 'Federal' },
        emendaFields,
      ),
    ).toEqual({});

    expect(
      validateCadastroForm(
        { codigo: 'EQ001', nome: 'ESF Centro', estabelecimento_id: '1' },
        equipeFields,
      ),
    ).toEqual({});
  });
});

describe('cadastro formatters', () => {
  it('formats empty values and status labels', () => {
    expect(formatCadastroCell(null)).toBe('—');
    expect(formatCadastroCell('ABC')).toBe('ABC');
    expect(formatCadastroStatus('ativo')).toBe('Ativo');
    expect(formatCadastroStatus(undefined)).toBe('—');
  });
});

describe('getCadastroEntity', () => {
  it('returns config by route slug', () => {
    expect(getCadastroEntity('equipes')?.key).toBe('equipes');
    expect(getCadastroEntity('missing')).toBeUndefined();
  });
});
