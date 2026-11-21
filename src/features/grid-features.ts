import {
  tableFeatures,
  metaHelper,
  cellSelectionFeature,
  cellSpanningFeature,
  rowAggregationFeature,
  aggregationFn_sum,
  aggregationFn_mean,
  aggregationFn_min,
  aggregationFn_max,
  aggregationFn_count,
  columnFilteringFeature,
  globalFilteringFeature,
  columnFacetingFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  createFilteredRowModel,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFacetedMinMaxValues,
  createGroupedRowModel,
  createSortedRowModel,
  createExpandedRowModel,
  createPaginatedRowModel,
  filterFn_includesString,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_basic,
  type FilterFn,
} from '@tanstack/react-table';
import { evaluateFilterRule } from '../store/filter-engine';
import type { SiftColumnMeta, FilterRule } from '../types/grid.types';

/**
 * Custom TanStack Table V9 filterFn that understands structured FilterRule objects
 * as well as arrays of FilterRules targeting the same column.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const smartRuleFilterFn: FilterFn<any, any> = (row, columnId, filterValue) => {
  const cellValue = row.getValue(columnId);

  if (Array.isArray(filterValue)) {
    const rules = filterValue as FilterRule[];
    return rules.every((rule) => evaluateFilterRule(cellValue, rule));
  }

  if (filterValue && typeof filterValue === 'object' && 'operator' in filterValue) {
    return evaluateFilterRule(cellValue, filterValue as FilterRule);
  }

  return String(cellValue ?? '')
    .toLowerCase()
    .includes(String(filterValue ?? '').toLowerCase());
};

/**
 * Static TanStack Table V9 feature registry defined outside React components
 * for maximum tree-shaking, stable references, and end-to-end TypeScript inference.
 *
 * Note: In TanStack Table V9, each row model slot must appear after its prerequisite feature.
 */
export const siftFeatures = tableFeatures({
  columnMeta: metaHelper<SiftColumnMeta>(),
  // Filtering & Faceting
  columnFilteringFeature,
  globalFilteringFeature,
  columnFacetingFeature,
  filteredRowModel: createFilteredRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  facetedMinMaxValues: createFacetedMinMaxValues(),

  // Grid-like range selection, merged cells, and aggregation
  cellSelectionFeature,
  cellSpanningFeature,
  rowAggregationFeature,
  aggregationFns: { sum: aggregationFn_sum, mean: aggregationFn_mean, min: aggregationFn_min, max: aggregationFn_max, count: aggregationFn_count },

  // Grouping & Hierarchy (powers interactive breadcrumb drill-downs)
  columnGroupingFeature,
  rowExpandingFeature,
  groupedRowModel: createGroupedRowModel(),
  expandedRowModel: createExpandedRowModel(),

  // Sorting & Pagination
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),

  // Layout, Selection & Column Studio
  rowSelectionFeature,
  columnVisibilityFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnResizingFeature,

  // Typed Function Registries
  filterFns: {
    smartRule: smartRuleFilterFn,
    includesString: filterFn_includesString,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    basic: sortFn_basic,
  },
});

export type SiftFeatures = typeof siftFeatures;

