import type {
  FilterCombinator,
  FilterGroupState,
  FilterOperator,
  FilterRule,
  ServerQueryPayload,
} from '../types/grid.types';

/**
 * Evaluates a single structured FilterRule against a raw cell value.
 * Used both by the TanStack Table V9 custom column filterFn and OR-mode row filtering.
 */
export function evaluateFilterRule(rawValue: unknown, rule: FilterRule): boolean {
  const { operator, value } = rule;

  if (operator === 'isEmpty') {
    if (rawValue === null || rawValue === undefined) return true;
    if (typeof rawValue === 'string') return rawValue.trim().length === 0;
    if (Array.isArray(rawValue)) return rawValue.length === 0;
    return false;
  }

  if (operator === 'isNotEmpty') {
    return !evaluateFilterRule(rawValue, { ...rule, operator: 'isEmpty' });
  }

  if (value === undefined || value === null || value === '') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }

  const normalizedCell =
    rawValue === null || rawValue === undefined ? '' : String(rawValue).toLowerCase();

  switch (operator) {
    case 'contains':
      return normalizedCell.includes(String(value).toLowerCase());

    case 'notContains':
      return !normalizedCell.includes(String(value).toLowerCase());

    case 'startsWith':
      return normalizedCell.startsWith(String(value).toLowerCase());

    case 'endsWith':
      return normalizedCell.endsWith(String(value).toLowerCase());

    case 'is': {
      if (typeof rawValue === 'boolean') {
        return rawValue === (value === true || value === 'true');
      }
      if (typeof rawValue === 'number') {
        const num = Number(value);
        return !Number.isNaN(num) && rawValue === num;
      }
      if (rawValue instanceof Date || isIsoDateString(rawValue)) {
        return toDateDay(rawValue) === toDateDay(value);
      }
      return normalizedCell === String(value).toLowerCase();
    }

    case 'isNot':
      return !evaluateFilterRule(rawValue, { ...rule, operator: 'is' });

    case 'isAnyOf': {
      const targets = (Array.isArray(value) ? value : [value]).map((v) =>
        String(v).toLowerCase()
      );
      if (Array.isArray(rawValue)) {
        return rawValue.some((item) => targets.includes(String(item).toLowerCase()));
      }
      return targets.includes(normalizedCell);
    }

    case 'isNoneOf':
      return !evaluateFilterRule(rawValue, { ...rule, operator: 'isAnyOf' });

    case 'gt': {
      const numCell = Number(rawValue);
      const numTarget = Number(value);
      return !Number.isNaN(numCell) && !Number.isNaN(numTarget) && numCell > numTarget;
    }

    case 'gte': {
      const numCell = Number(rawValue);
      const numTarget = Number(value);
      return !Number.isNaN(numCell) && !Number.isNaN(numTarget) && numCell >= numTarget;
    }

    case 'lt': {
      const numCell = Number(rawValue);
      const numTarget = Number(value);
      return !Number.isNaN(numCell) && !Number.isNaN(numTarget) && numCell < numTarget;
    }

    case 'lte': {
      const numCell = Number(rawValue);
      const numTarget = Number(value);
      return !Number.isNaN(numCell) && !Number.isNaN(numTarget) && numCell <= numTarget;
    }

    case 'before': {
      const dCell = toTimestamp(rawValue);
      const dTarget = toTimestamp(value);
      return dCell !== null && dTarget !== null && dCell < dTarget;
    }

    case 'after': {
      const dCell = toTimestamp(rawValue);
      const dTarget = toTimestamp(value);
      return dCell !== null && dTarget !== null && dCell > dTarget;
    }

    case 'between': {
      if (!Array.isArray(value) || value.length < 2) return true;
      const [minRaw, maxRaw] = value;

      if (isIsoDateString(minRaw) || isIsoDateString(maxRaw) || rawValue instanceof Date) {
        const dCell = toTimestamp(rawValue);
        const dMin = minRaw ? toTimestamp(minRaw) : null;
        const dMax = maxRaw ? toTimestamp(maxRaw) : null;
        if (dCell === null) return false;
        if (dMin !== null && dCell < dMin) return false;
        if (dMax !== null && dCell > dMax) return false;
        return true;
      }

      const numCell = Number(rawValue);
      if (Number.isNaN(numCell)) return false;
      const hasMin = minRaw !== '' && minRaw !== null && minRaw !== undefined;
      const hasMax = maxRaw !== '' && maxRaw !== null && maxRaw !== undefined;
      if (hasMin && numCell < Number(minRaw)) return false;
      if (hasMax && numCell > Number(maxRaw)) return false;
      return true;
    }

    default:
      return true;
  }
}

/**
 * Evaluates a full FilterGroupState (AND or OR combinator) against a row record.
 * When combinator is 'OR', this enables cross-column OR logic beyond standard per-column AND filtering.
 */
export function evaluateFilterGroup<TData>(
  row: TData,
  getFieldValue: (row: TData, columnId: string) => unknown,
  group: FilterGroupState
): boolean {
  const activeRules = group.rules.filter(isRuleActive);
  if (activeRules.length === 0) return true;

  if (group.combinator === 'OR') {
    return activeRules.some((rule) =>
      evaluateFilterRule(getFieldValue(row, rule.columnId), rule)
    );
  }

  return activeRules.every((rule) =>
    evaluateFilterRule(getFieldValue(row, rule.columnId), rule)
  );
}

export function isRuleActive(rule: FilterRule): boolean {
  if (rule.operator === 'isEmpty' || rule.operator === 'isNotEmpty') return true;
  if (rule.value === null || rule.value === undefined || rule.value === '') return false;
  if (Array.isArray(rule.value)) {
    return rule.value.some((v) => v !== null && v !== undefined && v !== '');
  }
  return true;
}

/**
 * Serializes the full grid state into clean, shareable URL search parameters.
 * Compatible with Next.js App Router, nuqs, or standard browser History API.
 */
export function serializeGridQueryParams(payload: ServerQueryPayload): string {
  const params = new URLSearchParams();
  if (payload.search.trim()) params.set('q', payload.search.trim());
  if (payload.combinator !== 'AND') params.set('logic', payload.combinator);
  if (payload.filters.length > 0) {
    params.set('filters', JSON.stringify(payload.filters));
  }
  if (payload.sort.length > 0) {
    params.set(
      'sort',
      payload.sort.map((s) => `${s.field}:${s.direction}`).join(',')
    );
  }
  if (payload.page > 0) params.set('page', String(payload.page + 1));
  if (payload.pageSize !== 25) params.set('pageSize', String(payload.pageSize));
  if (payload.groupBy.length > 0) params.set('group', payload.groupBy.join(','));
  return params.toString();
}

export function parseGridQueryParams(queryString: string): Partial<{
  search: string;
  combinator: FilterCombinator;
  rules: FilterRule[];
  sort: Array<{ id: string; desc: boolean }>;
  pageIndex: number;
  pageSize: number;
  grouping: string[];
}> {
  const params = new URLSearchParams(queryString);
  const result: ReturnType<typeof parseGridQueryParams> = {};

  const q = params.get('q');
  if (q !== null) result.search = q;

  const logic = params.get('logic');
  if (logic === 'OR' || logic === 'AND') result.combinator = logic;

  const filtersRaw = params.get('filters');
  if (filtersRaw) {
    try {
      const parsed = JSON.parse(filtersRaw);
      if (Array.isArray(parsed)) {
        result.rules = parsed.map((item, idx) => ({
          id: `url-rule-${idx}-${item.field}`,
          columnId: String(item.field),
          operator: item.op as FilterOperator,
          value: item.value,
        }));
      }
    } catch {
      // Ignore malformed URL filters gracefully
    }
  }

  const sortRaw = params.get('sort');
  if (sortRaw) {
    result.sort = sortRaw
      .split(',')
      .filter(Boolean)
      .map((token) => {
        const [id, dir] = token.split(':');
        return { id, desc: dir === 'desc' };
      });
  }

  const pageRaw = params.get('page');
  if (pageRaw && !Number.isNaN(Number(pageRaw))) {
    result.pageIndex = Math.max(0, Number(pageRaw) - 1);
  }

  const pageSizeRaw = params.get('pageSize');
  if (pageSizeRaw && !Number.isNaN(Number(pageSizeRaw))) {
    result.pageSize = Math.max(5, Math.min(200, Number(pageSizeRaw)));
  }

  const groupRaw = params.get('group');
  if (groupRaw) {
    result.grouping = groupRaw.split(',').filter(Boolean);
  }

  return result;
}

/**
 * Generates a safe, parameterized PostgreSQL WHERE clause from FilterGroupState.
 * Pass an explicit allowlist of columnId -> SQL column identifier to prevent SQL injection.
 */
export function buildPostgresWhereClause(
  filterGroup: FilterGroupState,
  columnAllowlist: Record<string, string>,
  startParamIndex = 1
): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = startParamIndex;

  for (const rule of filterGroup.rules) {
    if (!isRuleActive(rule)) continue;
    const sqlCol = columnAllowlist[rule.columnId];
    if (!sqlCol) continue;

    switch (rule.operator) {
      case 'is':
        clauses.push(`${sqlCol} = $${idx++}`);
        params.push(rule.value);
        break;
      case 'isNot':
        clauses.push(`${sqlCol} <> $${idx++}`);
        params.push(rule.value);
        break;
      case 'isAnyOf':
        clauses.push(`${sqlCol} = ANY($${idx++})`);
        params.push(Array.isArray(rule.value) ? rule.value : [rule.value]);
        break;
      case 'isNoneOf':
        clauses.push(`NOT (${sqlCol} = ANY($${idx++}))`);
        params.push(Array.isArray(rule.value) ? rule.value : [rule.value]);
        break;
      case 'contains':
        clauses.push(`${sqlCol}::text ILIKE $${idx++}`);
        params.push(`%${String(rule.value)}%`);
        break;
      case 'notContains':
        clauses.push(`${sqlCol}::text NOT ILIKE $${idx++}`);
        params.push(`%${String(rule.value)}%`);
        break;
      case 'startsWith':
        clauses.push(`${sqlCol}::text ILIKE $${idx++}`);
        params.push(`${String(rule.value)}%`);
        break;
      case 'endsWith':
        clauses.push(`${sqlCol}::text ILIKE $${idx++}`);
        params.push(`%${String(rule.value)}`);
        break;
      case 'gt':
      case 'after':
        clauses.push(`${sqlCol} > $${idx++}`);
        params.push(rule.value);
        break;
      case 'gte':
        clauses.push(`${sqlCol} >= $${idx++}`);
        params.push(rule.value);
        break;
      case 'lt':
      case 'before':
        clauses.push(`${sqlCol} < $${idx++}`);
        params.push(rule.value);
        break;
      case 'lte':
        clauses.push(`${sqlCol} <= $${idx++}`);
        params.push(rule.value);
        break;
      case 'between': {
        if (Array.isArray(rule.value) && rule.value.length === 2) {
          const [minVal, maxVal] = rule.value;
          const parts: string[] = [];
          if (minVal !== '' && minVal !== null && minVal !== undefined) {
            parts.push(`${sqlCol} >= $${idx++}`);
            params.push(minVal);
          }
          if (maxVal !== '' && maxVal !== null && maxVal !== undefined) {
            parts.push(`${sqlCol} <= $${idx++}`);
            params.push(maxVal);
          }
          if (parts.length > 0) clauses.push(`(${parts.join(' AND ')})`);
        }
        break;
      }
      case 'isEmpty':
        clauses.push(`(${sqlCol} IS NULL OR ${sqlCol}::text = '')`);
        break;
      case 'isNotEmpty':
        clauses.push(`(${sqlCol} IS NOT NULL AND ${sqlCol}::text <> '')`);
        break;
    }
  }

  if (clauses.length === 0) {
    return { sql: '', params: [] };
  }

  const joiner = filterGroup.combinator === 'OR' ? ' OR ' : ' AND ';
  return {
    sql: `WHERE (${clauses.join(joiner)})`,
    params,
  };
}

function isIsoDateString(val: unknown): boolean {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val);
}

function toDateDay(val: unknown): string | null {
  const ts = toTimestamp(val);
  if (ts === null) return null;
  return new Date(ts).toISOString().slice(0, 10);
}

function toTimestamp(val: unknown): number | null {
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string' || typeof val === 'number') {
    const parsed = Date.parse(String(val));
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}
