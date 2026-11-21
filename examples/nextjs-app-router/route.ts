/** Drop into app/api/accounts/route.ts in a Next.js app (install pg and @types/pg). */
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { buildPostgresDataQuery, buildPostgresCountQuery, buildPostgresFacetQuery } from '../../src/store/server-adapter';
import { parseGridQueryParams } from '../../src/store/filter-engine';
import type { ServerQueryPayload } from '../../src/types/grid.types';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const config = {
  table: 'public.accounts',
  columns: { id: 'id', name: 'name', region: 'region', plan: 'plan', amount: 'amount', createdAt: 'created_at' },
  searchableColumns: ['name', 'region'],
};

export async function GET(request: NextRequest) {
  const parsed = parseGridQueryParams(request.nextUrl.searchParams.toString());
  const payload: ServerQueryPayload = {
    search: parsed.search ?? '', combinator: parsed.combinator ?? 'AND',
    filters: (parsed.rules ?? []).map(({ columnId, operator, value }) => ({ field: columnId, op: operator, value })),
    sort: (parsed.sort ?? []).map(({ id, desc }) => ({ field: id, direction: desc ? 'desc' : 'asc' })),
    page: parsed.pageIndex ?? 0, pageSize: parsed.pageSize ?? 25, groupBy: parsed.grouping ?? [],
  };
  const facet = request.nextUrl.searchParams.get('facet');
  const query = facet ? buildPostgresFacetQuery(payload, config, facet) : buildPostgresDataQuery(payload, config);
  const countQuery = buildPostgresCountQuery(payload, config);
  const client = await pool.connect();
  try {
    const [data, count] = await Promise.all([client.query(query.sql, query.params), client.query(countQuery.sql, countQuery.params)]);
    return NextResponse.json({ rows: data.rows, totalRowCount: count.rows[0]?.count ?? 0, facet: facet ?? undefined });
  } catch (error) {
    // Do not echo SQL, credentials, or parameter values in API error responses.
    return NextResponse.json({ error: 'Unable to load records' }, { status: 500 });
  } finally {
    client.release();
  }
}
