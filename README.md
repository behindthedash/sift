# Sift

**Sift** is an MIT-licensed data grid for React and TanStack Table 9 with a clean `<Sift />` API, fast faceted filters, composable views, spreadsheet selection, and safe server query adapters.

## Install

```bash
npm install @sift-grid/react
```

```tsx
import { Sift } from '@sift-grid/react';
import '@sift-grid/react/styles.css';

<Sift data={rows} columns={columns} getRowId={(row) => row.id} />
```

Sift uses Tailwind utilities. **Your host app must scan Sift's installed package** in Tailwind's content settings (v3) or add `@source "../node_modules/@sift-grid/react/dist";` to the host stylesheet (v4). Override CSS variables on `.sift` (and `.sift-popover` for portaled menus) to change the accent, surface, border, ink and muted colors. The dependency includes neither a theme reset nor a proprietary stylesheet.

## Data sources: JSON first, SQL optional

**No SQL or database is needed.** Pass any array of objects:

```tsx
const people = [{ id: '1', name: 'Avery', status: 'Active' }];
<Sift data={people} columns={columns} />
```

For remote data, supply a stable `dataSource` function. Sift sends a typed query
containing filters, sorting, pagination, and search, and expects JSON rows in return.
The component aborts superseded requests and exposes loading state. Any API,
GraphQL resolver, MongoDB collection, or database can satisfy this contract.

```tsx
import { Sift, createJsonDataSource } from '@sift-grid/react';
const source = createJsonDataSource<Person>('/api/people'); // create outside render
<Sift dataSource={source} columns={columns} />
```

The endpoint returns `{ "rows": [...], "totalRowCount": 123, "facetCounts": {} }`.
A sample **optional** PostgreSQL adapter is provided under `src/store/server-adapter.ts`.

## Features

- Quick command filtering (`Cmd/Ctrl+K`) with keyboard list navigation, cross-narrowed facets, and advanced AND/OR rules.
- Column Studio drag/drop, saved views, pinning, grouping breadcrumbs, column resizing, and per-column summary footer.
- Cell ranges: drag, Shift extend, Ctrl/Cmd multi-range, Arrow/Tab navigation, clipboard TSV copy and paste, and optimistic double-click/Enter editing with rollback. Enable editing by setting column `meta.editable = true` and providing `onCellEdit`. Supply `meta.parseEdit` and `meta.validateEdit` as needed.
- Portaled menus via Floating UI, accessible grid semantics, optional header filters, and CSV export honoring accessorFns and column formatting (with selected-only option).
- Server mode: `manualMode`, `onServerQueryChange`, `facetCounts`, debounced search. Use the parameterized Postgres query builders from the package and see `examples/nextjs-app-router/route.ts` for an App Router endpoint. Map identifiers only from a trusted allowlist; never concatenate user field names into SQL.

## Development

`npm install`, then `npm run typecheck`, `npm test`, `npm run build`. Run `npm run demo` to launch the Vite demo, and `npm run test:e2e` for Playwright after installing browsers.

## Release

ESM-only distributable with type declarations and an explicit `'use client'` entrypoint. The npm package is `@sift-grid/react` (rather than the occupied unscoped `sift`), while the component and hook remain `<Sift />` and `useSift`. Publishing requires control of the `@sift-grid` npm scope; package ownership and name availability must be confirmed before a release.

MIT licensing applies to original Sift source; dependencies retain their own licenses. See `LICENSE`.
