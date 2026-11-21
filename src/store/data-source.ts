import type { ServerQueryPayload } from '../types/grid.types';
import { serializeGridQueryParams } from './filter-engine';

/** Rows are JSON-compatible objects; persistence and backend technology are up to the host. */
export interface SiftDataPage<TData> {
  rows: TData[];
  totalRowCount: number;
  facetCounts?: Record<string, Record<string, number>>;
}

/** A generic, abortable data source. Works with REST, GraphQL, NoSQL and SQL alike. */
export type SiftDataSource<TData> = (
  query: ServerQueryPayload,
  context: { signal: AbortSignal },
) => Promise<SiftDataPage<TData>>;

/** Fetch a JSON page from a URL that accepts Sift's query-string format. */
export function createJsonDataSource<TData>(
  endpoint: string,
  options: { headers?: HeadersInit; fetcher?: typeof fetch } = {},
): SiftDataSource<TData> {
  return async (query, { signal }) => {
    const join = endpoint.includes('?') ? '&' : '?';
    const url = `${endpoint}${join}${serializeGridQueryParams(query)}`;
    const response = await (options.fetcher ?? fetch)(url, {
      signal,
      headers: (() => {
        const headers = new Headers(options.headers);
        if (!headers.has('Accept')) headers.set('Accept', 'application/json');
        return headers;
      })(),
    });
    if (!response.ok) throw new Error(`Sift data request failed (${response.status})`);
    const page: unknown = await response.json();
    if (!page || typeof page !== 'object') throw new Error('Invalid JSON data source response');
    const data = page as Partial<SiftDataPage<TData>>;
    if (!Array.isArray(data.rows) || !Number.isSafeInteger(data.totalRowCount) || data.totalRowCount! < 0) {
      throw new Error('JSON response must contain rows[] and a nonnegative totalRowCount');
    }
    return { rows: data.rows, totalRowCount: data.totalRowCount!, facetCounts: data.facetCounts };
  };
}
