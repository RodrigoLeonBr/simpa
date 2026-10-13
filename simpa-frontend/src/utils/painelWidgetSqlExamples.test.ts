import { describe, expect, it } from 'vitest';
import { findSqlExample, PAINEL_SQL_EXAMPLE_GROUPS } from './painelWidgetSqlExamples';

describe('findSqlExample', () => {
  it('encontra um exemplo existente por id', () => {
    const ex = findSqlExample('placeholders');
    expect(ex?.id).toBe('placeholders');
    expect(ex?.target).toBe('both');
  });

  it('retorna undefined para id inexistente', () => {
    expect(findSqlExample('nao-existe')).toBeUndefined();
  });

  it('todos os grupos têm exemplos com ids únicos', () => {
    const ids = PAINEL_SQL_EXAMPLE_GROUPS.flatMap((g) => g.examples.map((e) => e.id));
    expect(ids.length).toBe(new Set(ids).size);
  });
});
