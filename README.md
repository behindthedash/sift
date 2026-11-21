# `@your-org/data-grid`

A 100% MIT-licensed, UX-first React + TypeScript data grid powered by **TanStack Table V9** (`@tanstack/react-table` v9.3+), **Tailwind CSS**, **`@dnd-kit`**, and **`@tanstack/react-virtual`**.

Designed to deliver — and surpass — the interaction polish of commercial enterprise grids without any license keys or proprietary lock-in.

## Key Capabilities

* **TanStack Table V9 Native Architecture:** Uses static `tableFeatures()` registration, `useTable()`, reactive `table.state` subscriptions, type-safe `filterFns`/`sortFns` registries, V9 logical `start`/`end` column pinning (`insetInlineStart`/`insetInlineEnd`), and V9 indeterminate row-selection semantics.
* **Dual-Mode Filtering (Linear + Notion):**
  * **Quick Command-Palette Faceted Filter (`⌘K` or `+ Filter`):** Search columns, drill into live cross-narrowed counts via `column.getFacetedUniqueValues()` and numeric bounds via `column.getFacetedMinMaxValues()`.
  * **Advanced Rule Builder (`Rules`):** Stack multi-field `AND` / `OR` conditions across 17 operators (`is`, `isNot`, `isAnyOf`, `isNoneOf`, `contains`, `between`, `before`, `after`, `isEmpty`, etc.).
* **Interactive Breadcrumb & Filter Pill Trail:**
  * Clickable hierarchical grouping breadcrumbs (`All Records > Region > Plan Tier`).
  * Compound filter pills where clicking the **operator** switches logic inline and clicking the **value** opens the column's editor.
* **Column Studio Drawer:** Instant column search, **Shown in Table** vs **Available to Add** buckets, drag-and-drop column reordering (`@dnd-kit/sortable`), and logical start/end sticky pinning.
* **Saved Views, URL State Sync & Postgres Builder:** Save/restore presets to `localStorage`, sync state to query parameters via `urlAdapter` (compatible with Next.js App Router or `nuqs`), and generate parameterized SQL `WHERE` clauses with `buildPostgresWhereClause()`.

## Quick Start

```bash
npm install @tanstack/react-table @tanstack/react-virtual @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities lucide-react clsx tailwind-merge
```

Copy `src/` into your monorepo package (`packages/data-grid`) or directly into your Next.js app (`components/data-grid`), and see `examples/demo-page.tsx` for a full 1,200-row interactive example with grouping, pinning, bulk actions, and live PostgreSQL query serialization.

## Repository Layout

```text
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts
│   ├── types/grid.types.ts
│   ├── features/grid-features.ts
│   ├── store/
│   │   ├── filter-engine.ts
│   │   └── use-data-grid.ts
│   ├── utils/
│   │   ├── cn.ts
│   │   └── export-csv.ts
│   └── components/
│       ├── data-grid.tsx
│       ├── grid-toolbar.tsx
│       ├── grid-header.tsx
│       ├── filter-command-menu.tsx
│       ├── filter-rule-builder.tsx
│       ├── breadcrumb-trail.tsx
│       ├── column-manager-drawer.tsx
│       ├── bulk-action-bar.tsx
│       └── grid-pagination.tsx
└── examples/
    └── demo-page.tsx
```
