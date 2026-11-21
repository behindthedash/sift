import { describe, expect, it } from 'vitest';
import {
  evaluateFilterRule,
  evaluateFilterGroup,
  buildPostgresWhereClause,
  quoteSqlIdentifier,
  parseGridQueryParams,
  serializeGridQueryParams,
} from '../../src/store/filter-engine';
import { buildPostgresDataQuery, buildPostgresFacetQuery } from '../../src/store/server-adapter';
import { encodeTsv, parseTsv } from '../../src/utils/tsv';
import type { FilterOperator, FilterRule, ServerQueryPayload } from '../../src/types/grid.types';

const rule = (operator: FilterOperator, value: unknown = null): FilterRule => ({ id: 'one', columnId: 'value', operator, value });
const checks: Array<[FilterOperator, unknown, unknown, boolean]> = [
  ['is', 'Hello', 'hello', true], ['isNot', 'Hello', 'world', true],
  ['isAnyOf', 'b', ['a', 'b'], true], ['isNoneOf', 'c', ['a', 'b'], true],
  ['contains', 'Hello world', 'world', true], ['notContains', 'Hello', 'xyz', true],
  ['startsWith', 'Hello', 'he', true], ['endsWith', 'Hello', 'LO', true],
  ['gt', 5, 4, true], ['gte', 0, 0, true], ['lt', -2, -1, true], ['lte', 1, 1, true],
  ['between', 0, [-1, 1], true], ['before', '2026-01-01', '2026-02-01', true],
  ['after', '2026-12-01', '2026-11-01', true], ['isEmpty', null, null, true],
  ['isNotEmpty', false, null, true],
];

describe('17 operators', () => {
  it.each(checks)('%s compares %j against %j', (operator, cell, target, expected) => {
    expect(evaluateFilterRule(cell, rule(operator, target))).toBe(expected);
  });
  it('keeps zero, false and null distinct', () => {
    expect(evaluateFilterRule(0, rule('is', 0))).toBe(true);
    expect(evaluateFilterRule(false, rule('is', false))).toBe(true);
    expect(evaluateFilterRule(null, rule('gt', 0))).toBe(false);
    expect(evaluateFilterRule(null, rule('lte', 0))).toBe(false);
    expect(evaluateFilterRule('', rule('isEmpty'))).toBe(true);
    expect(evaluateFilterRule(false, rule('isEmpty'))).toBe(false);
    expect(evaluateFilterRule([], rule('isEmpty'))).toBe(true);
    expect(evaluateFilterRule(new Date('2026-04-21'), rule('is', '2026-04-21'))).toBe(true);
  });
  it('combines different fields with OR', () => {
    const rows = { a: 'good', b: 'bad' };
    expect(evaluateFilterGroup(rows, (row, column) => row[column as 'a' | 'b'], { combinator: 'OR', rules: [
      { ...rule('is', 'good'), columnId: 'a' }, { ...rule('is', 'good'), columnId: 'b' },
    ] })).toBe(true);
  });
});

describe('Postgres allowlisting and bound queries', () => {
  const config = { table: 'public.accounts', columns: { value: 'public.accounts.value', status: 'status' }, searchableColumns: ['status'] };
  const payload: ServerQueryPayload = { search: 'world', combinator: 'AND', filters: [{ field: 'value', op: 'gte', value: 0 }], sort: [{ field: 'value', direction: 'desc' }], page: 2, pageSize: 20, groupBy: [] };
  it('quotes trusted identifiers and rejects unsafe identifiers', () => {
    expect(quoteSqlIdentifier('public.accounts')).toBe('"public"."accounts"');
    expect(() => quoteSqlIdentifier('x; DROP TABLE users')).toThrow(/Unsafe/);
    expect(() => quoteSqlIdentifier('public.accounts --')).toThrow(/Unsafe/);
    expect(() => buildPostgresWhereClause({ combinator: 'AND', rules: [rule('is', 'x')] }, { value: 'col) OR true --' })).toThrow(/Unsafe/);
  });
  it('parameterizes sorting, pagination, filters and search', () => {
    const result = buildPostgresDataQuery(payload, config);
    expect(result.sql).toContain('ORDER BY "public"."accounts"."value" DESC LIMIT $3 OFFSET $4');
    expect(result.params).toEqual([0, '%world%', 20, 40]);
    expect(result.sql).not.toContain('world');
  });
  it('produces cross-narrowed facet counts', () => {
    const facet = buildPostgresFacetQuery(payload, config, 'value');
    expect(facet.sql).toContain('GROUP BY "public"."accounts"."value"');
    expect(facet.params).toEqual(['%world%', 100]);
    expect(() => buildPostgresFacetQuery(payload, config, 'injected')).toThrow(/Unknown facet/);
  });
  it('roundtrips filter URLs', () => {
    const encoded = serializeGridQueryParams(payload);
    const decoded = parseGridQueryParams(encoded);
    expect(decoded.rules?.[0].value).toBe(0);
    expect(decoded.pageIndex).toBe(2);
  });
});

describe('clipboard', () => {
  it('escapes embedded tabs and neutralizes spreadsheet formulas', () => {
    const text = encodeTsv([['a\tb', '=SUM(1,1)', 'plain']]);
    expect(parseTsv(text)).toEqual([['a\tb', "'=SUM(1,1)", 'plain']]);
  });
});
