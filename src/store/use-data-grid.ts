import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnSizingState,
  type ExpandedState,
  type GroupingState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { dataGridFeatures, type DataGridFeatures } from '../features/grid-features';
import {
  evaluateFilterGroup,
  isRuleActive,
  parseGridQueryParams,
  serializeGridQueryParams,
} from './filter-engine';
import type {
  DataGridColumnMeta,
  DataGridUrlAdapter,
  FilterCombinator,
  FilterGroupState,
  FilterOperator,
  FilterRule,
  GridDensity,
  SavedGridView,
  ServerQueryPayload,
} from '../types/grid.types';
import { getDefaultOperator } from '../types/grid.types';

export interface UseDataGridOptions<TData> {
  data: TData[];
  columns: ColumnDef<DataGridFeatures, TData, unknown>[];
  getRowId?: (originalRow: TData, index: number) => string;
  /** Enable server-side filtering, sorting, and pagination */
  manualMode?: boolean;
  /** Total rows on server when manualMode is true */
  totalRowCount?: number;
  /** Fired whenever query parameters change (debounced search included) */
  onServerQueryChange?: (payload: ServerQueryPayload) => void;
  /** Optional URL synchronization adapter (works with browser URL, Next.js router, or nuqs) */
  urlAdapter?: DataGridUrlAdapter;
  /** LocalStorage key for persisting Saved Views */
  storageKey?: string;
  /** Initial saved views provided by the host application or backend */
  initialViews?: SavedGridView[];
  /** Initial page size (default: 25) */
  initialPageSize?: number;
  /** Default density */
  initialDensity?: GridDensity;
  /** Initial pinned columns using TanStack V9 logical 'start' / 'end' slots */
  initialColumnPinning?: ColumnPinningState;
}

function createBrowserUrlAdapter(): DataGridUrlAdapter {
  return {
    read: () => (typeof window !== 'undefined' ? window.location.search.slice(1) : ''),
    write: (qs) => {
      if (typeof window === 'undefined') return;
      const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, '', nextUrl);
    },
  };
}

export function useDataGrid<TData>(options: UseDataGridOptions<TData>) {
  const {
    data,
    columns,
    getRowId,
    manualMode = false,
    totalRowCount,
    onServerQueryChange,
    urlAdapter,
    storageKey = 'your-org-data-grid:views',
    initialViews = [],
    initialPageSize = 25,
    initialDensity = 'comfortable',
    initialColumnPinning = { start: [], end: [] },
  } = options;

  // Derive default column visibility & order from ColumnMeta
  const defaultColumnMeta = useMemo(() => {
    const visibility: VisibilityState = {};
    const order: ColumnOrderState = [];

    for (const col of columns) {
      const id =
        col.id ??
        ('accessorKey' in col && typeof col.accessorKey === 'string'
          ? col.accessorKey
          : undefined);
      if (!id) continue;
      order.push(id);
      const meta = col.meta as DataGridColumnMeta | undefined;
      if (meta?.defaultHidden) {
        visibility[id] = false;
      }
    }
    return { visibility, order };
  }, [columns]);

  // Hydrate initial state from URL if adapter is provided
  const hydrated = useMemo(() => {
    if (!urlAdapter) return {};
    return parseGridQueryParams(urlAdapter.read());
  }, [urlAdapter]);

  const [globalFilter, setGlobalFilter] = useState<string>(hydrated.search ?? '');
  const [filterGroup, setFilterGroup] = useState<FilterGroupState>({
    combinator: hydrated.combinator ?? 'AND',
    rules: hydrated.rules ?? [],
  });
  const [sorting, setSorting] = useState<SortingState>(hydrated.sort ?? []);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    defaultColumnMeta.visibility
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(defaultColumnMeta.order);
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(initialColumnPinning);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [grouping, setGrouping] = useState<GroupingState>(hydrated.grouping ?? []);
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: hydrated.pageIndex ?? 0,
    pageSize: hydrated.pageSize ?? initialPageSize,
  });
  const [density, setDensity] = useState<GridDensity>(initialDensity);

  // Saved Views state (localStorage-backed by default)
  const [savedViews, setSavedViews] = useState<SavedGridView[]>(() => {
    if (typeof window === 'undefined') return initialViews;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return initialViews;
      const parsed = JSON.parse(raw) as SavedGridView[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : initialViews;
    } catch {
      return initialViews;
    }
  });
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(savedViews));
    } catch {
      // Ignore storage quota errors
    }
  }, [savedViews, storageKey]);

  // Ensure every filterable column uses smartRuleFilterFn by default unless overridden
  const enhancedColumns = useMemo(() => {
    return columns.map((col) => ({
      ...col,
      filterFn: col.filterFn ?? ('smartRule' as const),
    }));
  }, [columns]);

  // When combinator is 'OR' in client mode, pre-filter rows across columns so OR logic works globally
  const processedData = useMemo(() => {
    if (manualMode || filterGroup.combinator !== 'OR') return data;
    const activeRules = filterGroup.rules.filter(isRuleActive);
    if (activeRules.length === 0) return data;

    const accessorMap = new Map<string, (row: TData) => unknown>();
    for (const col of columns) {
      const id =
        col.id ??
        ('accessorKey' in col && typeof col.accessorKey === 'string'
          ? col.accessorKey
          : undefined);
      if (!id) continue;
      if ('accessorFn' in col && typeof col.accessorFn === 'function') {
        accessorMap.set(id, (r) => col.accessorFn!(r, 0));
      } else if ('accessorKey' in col && typeof col.accessorKey === 'string') {
        const key = col.accessorKey;
        accessorMap.set(id, (r) => (r as Record<string, unknown>)[key]);
      }
    }

    return data.filter((row) =>
      evaluateFilterGroup(
        row,
        (r, colId) =>
          accessorMap.get(colId)?.(r) ?? (r as Record<string, unknown>)[colId],
        filterGroup
      )
    );
  }, [data, columns, filterGroup, manualMode]);

  // Map AND-mode filter rules directly into TanStack Table V9 columnFilters
  // so native client-side faceting (getFacetedUniqueValues / getFacetedMinMaxValues) dynamically narrows!
  const tanstackColumnFilters = useMemo<ColumnFiltersState>(() => {
    if (filterGroup.combinator === 'OR') return [];
    const grouped = new Map<string, FilterRule[]>();
    for (const rule of filterGroup.rules) {
      if (!isRuleActive(rule)) continue;
      const existing = grouped.get(rule.columnId) ?? [];
      existing.push(rule);
      grouped.set(rule.columnId, existing);
    }
    return Array.from(grouped.entries()).map(([id, value]) => ({ id, value }));
  }, [filterGroup]);

  const table = useTable({
    features: dataGridFeatures,
    data: processedData,
    columns: enhancedColumns,
    getRowId,
    manualFiltering: manualMode,
    manualSorting: manualMode,
    manualPagination: manualMode,
    rowCount: manualMode ? totalRowCount : undefined,
    enableColumnPinning: true,
    enableColumnResizing: true,
    enableMultiSort: true,
    enableRowSelection: true,
    columnResizeMode: 'onChange',
    state: {
      globalFilter,
      columnFilters: tanstackColumnFilters,
      sorting,
      columnVisibility,
      columnOrder,
      columnPinning,
      columnSizing,
      grouping,
      expanded,
      rowSelection,
      pagination,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    onColumnSizingChange: setColumnSizing,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
  });

  // Build unified ServerQueryPayload (great for Next.js API routes, Drizzle, Prisma, or Postgres)
  const serverQueryPayload = useMemo<ServerQueryPayload>(
    () => ({
      search: globalFilter,
      combinator: filterGroup.combinator,
      filters: filterGroup.rules.filter(isRuleActive).map((r) => ({
        field: r.columnId,
        op: r.operator,
        value: r.value,
      })),
      sort: sorting.map((s) => ({
        field: s.id,
        direction: s.desc ? 'desc' : 'asc',
      })),
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      groupBy: grouping,
    }),
    [globalFilter, filterGroup, sorting, pagination, grouping]
  );

  // Sync to URL & notify server callback
  useEffect(() => {
    if (urlAdapter) {
      urlAdapter.write(serializeGridQueryParams(serverQueryPayload));
    }
    onServerQueryChange?.(serverQueryPayload);
  }, [serverQueryPayload, urlAdapter, onServerQueryChange]);

  // --- Rule Manipulation Helpers ---
  const addFilterRule = useCallback(
    (columnId: string, operator?: FilterOperator, value?: unknown) => {
      const column = table.getColumn(columnId);
      const variant = column?.columnDef.meta?.filterVariant ?? 'text';
      const nextRule: FilterRule = {
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        columnId,
        operator: operator ?? getDefaultOperator(variant),
        value: value ?? (variant === 'select' || variant === 'multi-select' ? [] : ''),
      };
      setFilterGroup((prev) => ({ ...prev, rules: [...prev.rules, nextRule] }));
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      setActiveViewId(null);
      return nextRule.id;
    },
    [table]
  );

  const upsertColumnRule = useCallback(
    (columnId: string, operator: FilterOperator, value: unknown) => {
      setFilterGroup((prev) => {
        const idx = prev.rules.findIndex((r) => r.columnId === columnId);
        const isEmptyValue =
          operator !== 'isEmpty' &&
          operator !== 'isNotEmpty' &&
          (value === '' ||
            value === null ||
            value === undefined ||
            (Array.isArray(value) && value.length === 0));

        if (isEmptyValue) {
          return {
            ...prev,
            rules: prev.rules.filter((r) => r.columnId !== columnId),
          };
        }

        if (idx >= 0) {
          const next = [...prev.rules];
          next[idx] = { ...next[idx], operator, value };
          return { ...prev, rules: next };
        }

        return {
          ...prev,
          rules: [
            ...prev.rules,
            {
              id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              columnId,
              operator,
              value,
            },
          ],
        };
      });
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      setActiveViewId(null);
    },
    []
  );

  const updateFilterRule = useCallback(
    (ruleId: string, patch: Partial<Omit<FilterRule, 'id'>>) => {
      setFilterGroup((prev) => ({
        ...prev,
        rules: prev.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
      }));
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      setActiveViewId(null);
    },
    []
  );

  const removeFilterRule = useCallback((ruleId: string) => {
    setFilterGroup((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== ruleId),
    }));
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    setActiveViewId(null);
  }, []);

  const setCombinator = useCallback((combinator: FilterCombinator) => {
    setFilterGroup((prev) => ({ ...prev, combinator }));
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    setActiveViewId(null);
  }, []);

  const clearAllFilters = useCallback(() => {
    setGlobalFilter('');
    setFilterGroup({ combinator: 'AND', rules: [] });
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    setActiveViewId(null);
  }, []);

  // --- Layout & Column Manager Helpers ---
  const resetColumnLayout = useCallback(() => {
    setColumnVisibility(defaultColumnMeta.visibility);
    setColumnOrder(defaultColumnMeta.order);
    setColumnPinning(initialColumnPinning);
    setColumnSizing({});
    setGrouping([]);
    setActiveViewId(null);
  }, [defaultColumnMeta, initialColumnPinning]);

  // --- Saved Views Helpers ---
  const saveCurrentView = useCallback(
    (name: string, description?: string) => {
      const view: SavedGridView = {
        id: `view-${Date.now()}`,
        name: name.trim(),
        description,
        createdAt: new Date().toISOString(),
        state: {
          globalFilter,
          filterGroup,
          sorting,
          columnVisibility,
          columnOrder,
          columnPinning,
          grouping,
          density,
        },
      };
      setSavedViews((prev) => [...prev, view]);
      setActiveViewId(view.id);
      return view;
    },
    [
      globalFilter,
      filterGroup,
      sorting,
      columnVisibility,
      columnOrder,
      columnPinning,
      grouping,
      density,
    ]
  );

  const applySavedView = useCallback(
    (viewId: string) => {
      const view = savedViews.find((v) => v.id === viewId);
      if (!view) return;
      setGlobalFilter(view.state.globalFilter);
      setFilterGroup(view.state.filterGroup);
      setSorting(view.state.sorting);
      setColumnVisibility(view.state.columnVisibility);
      setColumnOrder(view.state.columnOrder);
      setColumnPinning(view.state.columnPinning);
      setGrouping(view.state.grouping);
      setDensity(view.state.density);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      setActiveViewId(view.id);
    },
    [savedViews]
  );

  const deleteSavedView = useCallback(
    (viewId: string) => {
      setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
      if (activeViewId === viewId) setActiveViewId(null);
    },
    [activeViewId]
  );

  const activeFilterCount = useMemo(
    () =>
      filterGroup.rules.filter(isRuleActive).length + (globalFilter.trim() ? 1 : 0),
    [filterGroup.rules, globalFilter]
  );

  return {
    table,
    // Reactive state
    globalFilter,
    setGlobalFilter,
    filterGroup,
    setFilterGroup,
    density,
    setDensity,
    grouping,
    setGrouping,
    columnOrder,
    setColumnOrder,
    columnPinning,
    setColumnPinning,
    columnVisibility,
    setColumnVisibility,
    rowSelection,
    setRowSelection,
    activeFilterCount,
    serverQueryPayload,
    // Filter actions
    addFilterRule,
    upsertColumnRule,
    updateFilterRule,
    removeFilterRule,
    setCombinator,
    clearAllFilters,
    // Layout actions
    resetColumnLayout,
    // Views
    savedViews,
    activeViewId,
    saveCurrentView,
    applySavedView,
    deleteSavedView,
  };
}

export { createBrowserUrlAdapter };
export type DataGridController<TData> = ReturnType<typeof useDataGrid<TData>>;
