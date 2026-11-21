import type { FilterGroupState, ServerQueryPayload } from '../types/grid.types';
import { buildPostgresWhereClause, quoteSqlIdentifier } from './filter-engine';

/** All identifiers are selected from trusted configuration, never from URL payloads. */
export interface PostgresSiftConfig {
  table: string;
  columns: Record<string, string>;
  searchableColumns?: string[];
  maxPageSize?: number;
}
export interface SqlQuery { sql: string; params: unknown[] }

function conditions(payload: ServerQueryPayload, config: PostgresSiftConfig, excludeField?: string) {
  const filters: FilterGroupState = {
    combinator: payload.combinator,
    rules: payload.filters.filter((filter) => filter.field !== excludeField).map((filter, index) => ({
      id: String(index), columnId: filter.field, operator: filter.op, value: filter.value,
    })),
  };
  const where = buildPostgresWhereClause(filters, config.columns);
  const params = [...where.params];
  const terms: string[] = [];
  if (where.sql) terms.push(where.sql.slice('WHERE '.length));
  const q = payload.search.trim();
  if (q) {
    const cols = (config.searchableColumns ?? []).filter((key) => Object.hasOwn(config.columns, key));
    if (cols.length) {
      const placeholder = `$${params.length + 1}`;
      const predicates = cols.map((key) => `${quoteSqlIdentifier(config.columns[key])}::text ILIKE ${placeholder}`);
      params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
      terms.push(`(${predicates.join(' OR ')})`);
    }
  }
  return { sql: terms.length ? `WHERE ${terms.join(' AND ')}` : '', params };
}

export function buildPostgresDataQuery(
  payload: ServerQueryPayload,
  config: PostgresSiftConfig
): SqlQuery {
  const source = quoteSqlIdentifier(config.table);
  const where = conditions(payload, config);
  const limit = Math.min(Math.max(Math.trunc(payload.pageSize) || 25, 1), config.maxPageSize ?? 200);
  const page = Math.max(0, Math.trunc(payload.page) || 0);
  const order = payload.sort
    .filter((item) => Object.hasOwn(config.columns, item.field))
    .map((item) => `${quoteSqlIdentifier(config.columns[item.field])} ${item.direction === 'desc' ? 'DESC' : 'ASC'}`);
  const sort = order.length ? ` ORDER BY ${order.join(', ')}` : '';
  const offset = Math.min(Number.MAX_SAFE_INTEGER, page * limit);
  const first = where.params.length + 1;
  return {
    sql: `SELECT * FROM ${source} ${where.sql}${sort} LIMIT $${first} OFFSET $${first + 1}`.trim(),
    params: [...where.params, limit, offset],
  };
}

export function buildPostgresCountQuery(
  payload: ServerQueryPayload,
  config: PostgresSiftConfig
): SqlQuery {
  const where = conditions(payload, config);
  return { sql: `SELECT count(*)::int AS count FROM ${quoteSqlIdentifier(config.table)} ${where.sql}`.trim(), params: where.params };
}

/** Excludes the current facet's own filters so it can show cross-narrowed counts. */
export function buildPostgresFacetQuery(
  payload: ServerQueryPayload,
  config: PostgresSiftConfig,
  columnId: string,
  limit = 100
): SqlQuery {
  if (!Object.hasOwn(config.columns, columnId)) throw new Error(`Unknown facet column: ${columnId}`);
  const where = conditions(payload, config, columnId);
  const col = quoteSqlIdentifier(config.columns[columnId]);
  const bound = where.params.length + 1;
  return {
    sql: `SELECT ${col} AS value, count(*)::int AS count FROM ${quoteSqlIdentifier(config.table)} ${where.sql} GROUP BY ${col} ORDER BY count DESC LIMIT $${bound}`.trim(),
    params: [...where.params, Math.min(500, Math.max(1, Math.trunc(limit) || 100))],
  };
}
