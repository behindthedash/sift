import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCreateAtom } from '@tanstack/react-store';
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
import { siftFeatures, type SiftFeatures } from '../features/grid-features';
import {
  evaluateFilterGroup,
  isRuleActive,
  parseGridQueryParams,
  serializeGridQueryParams,
} from './filter-engine';
import type {
  SiftColumnMeta,
  SiftUrlAdapter,
  FilterCombinator,
  FilterGroupState,
  FilterOperator,
  FilterRule,
  GridDensity,
  SavedGridView,
  ServerQueryPayload,
} from '../types/grid.types';
import { getDefaultOperator } from '../types/grid.types';

export interface UseSiftOptions<TData> {
  /** In-memory JSON/JavaScript objects. No backend or SQL required. */
  data?: TData[];
  /** Optional async adapter for JSON APIs, GraphQL, document stores or SQL-backed services. */
  dataSource?: import('./data-source').SiftDataSource<TData>;
  columns: ColumnDef<SiftFeatures, TData, unknown>[];
  getRowId?: (originalRow: TData, index: number) => string;
  /** Enable server-side filtering, sorting, and pagination */
  manualMode?: boolean;
  /** Total rows on server when manualMode is true */
  totalRowCount?: number;
  /** Fired whenever query parameters change (debounced search included) */
  onServerQueryChange?: (payload: ServerQueryPayload) => void;
  /** Debounce server search updates while other query changes remain immediate. */
  searchDebounceMs?: number;
  /** Server-returned facet counts for manual mode: { columnId: { value: count } }. */
  facetCounts?: Record<string, Record<string, number>>;
  /** Persist edited values; rejected promises roll back the optimistic update. */
  onCellEdit?: (event: { rowId: string; columnId: string; oldValue: unknown; newValue: unknown; row: TData }) => void | Promise<void>;
  /** Optional URL synchronization adapter (works with browser URL, Next.js router, or nuqs) */
  urlAdapter?: SiftUrlAdapter;
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

function createBrowserUrlAdapter(): SiftUrlAdapter {
  return {
    read: () => (typeof window !== 'undefined' ? window.location.search.slice(1) : ''),
    write: (qs) => {
      if (typeof window === 'undefined') return;
      const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, '', nextUrl);
    },
  };
}

export function useSift<TData>(options: UseSiftOptions<TData>) {
  const {
    data,
    dataSource,
    columns,
    getRowId,
    manualMode = false,
    totalRowCount,
    onServerQueryChange,
    searchDebounceMs = 300,
    facetCounts,
    onCellEdit,
    urlAdapter,
    storageKey = 'sift:views',
    initialViews = [],
    initialPageSize = 25,
    initialDensity = 'comfortable',
    initialColumnPinning = { start: [], end: [] },
  } = options;

  const serverManaged = manualMode || Boolean(dataSource);
  const [sourcePage, setSourcePage] = useState<import('./data-source').SiftDataPage<TData> | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const sourceRows = dataSource ? (sourcePage?.rows ?? []) : (data ?? []);

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
      const meta = col.meta as SiftColumnMeta | undefined;
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
  const [debouncedSearch, setDebouncedSearch] = useState(globalFilter);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(globalFilter), searchDebounceMs);
    return () => window.clearTimeout(timeout);
  }, [globalFilter, searchDebounceMs]);
  const [optimistic, setOptimistic] = useState<Record<string, Record<string, unknown>>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const cellSelectionAtom = useCreateAtom<import('@tanstack/react-table').CellSelectionState>([]);
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
  const columnSizingAtom = useCreateAtom<ColumnSizingState>({});
  const [grouping, setGrouping] = useState<GroupingState>(hydrated.grouping ?? []);
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const rowSelectionAtom = useCreateAtom<RowSelectionState>({});
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

  // Optimistic edits never mutate host data and can be independently rolled back.
  const editableData = useMemo(() => sourceRows.map((row, index) => {
    const id = getRowId?.(row, index) ?? String(index);
    const changes = optimistic[id];
    return changes ? { ...row, ...changes } : row;
  }), [sourceRows, getRowId, optimistic]);

  // Ensure every filterable column uses smartRuleFilterFn by default unless overridden
  const enhancedColumns = useMemo(() => {
    return columns.map((col) => ({
      ...col,
      filterFn: col.filterFn ?? ('smartRule' as const),
      // Calculated accessorFns also reflect optimistic inline edits.
      ...('accessorFn' in col && col.accessorFn && (col.id || 'accessorKey' in col)
        ? { accessorFn: (row: TData, index: number) => {
            const id = getRowId?.(row, index) ?? String(index);
            const value = optimistic[id]?.[col.id ?? ''];
            return value !== undefined ? value : col.accessorFn!(row, index);
          } } : {}),
    }));
  }, [columns, optimistic, getRowId]);

  // When combinator is 'OR' in client mode, pre-filter rows across columns so OR logic works globally
  const processedData = useMemo(() => {
    if (serverManaged || filterGroup.combinator !== 'OR') return editableData;
    const activeRules = filterGroup.rules.filter(isRuleActive);
    if (activeRules.length === 0) return editableData;

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

    return editableData.filter((row) =>
      evaluateFilterGroup(
        row,
        (r, colId) =>
          accessorMap.get(colId)?.(r) ?? (r as Record<string, unknown>)[colId],
        filterGroup
      )
    );
  }, [editableData, columns, filterGroup, serverManaged]);

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
    features: siftFeatures,
    data: processedData,
    columns: enhancedColumns,
    getRowId,
    manualFiltering: serverManaged,
    manualSorting: serverManaged,
    manualPagination: serverManaged,
    rowCount: serverManaged ? (dataSource ? sourcePage?.totalRowCount : totalRowCount) : undefined,
    atoms: { rowSelection: rowSelectionAtom, columnSizing: columnSizingAtom, cellSelection: cellSelectionAtom },
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
      grouping,
      expanded,
      pagination,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,
  }, () => null);

  // Build unified ServerQueryPayload (great for Next.js API routes, Drizzle, Prisma, or Postgres)
  const serverQueryPayload = useMemo<ServerQueryPayload>(
    () => ({
      search: debouncedSearch,
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
    [debouncedSearch, filterGroup, sorting, pagination, grouping]
  );

  // Async sources are opt-in and return plain JSON row objects. Abort superseded
  // queries so rapidly changing filters cannot overwrite a newer page.
  useEffect(() => {
    if (!dataSource) return;
    const controller = new AbortController();
    setSourceLoading(true);
    setSourceError(null);
    Promise.resolve().then(() => dataSource(serverQueryPayload, { signal: controller.signal }))
      .then((page) => {
        if (!controller.signal.aborted) {
          setSourcePage(page);
          setSourceLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSourceError(error instanceof Error ? error.message : 'Unable to load Sift data');
          setSourceLoading(false);
        }
      });
    return () => controller.abort();
  }, [dataSource, serverQueryPayload]);

  // Sync to URL & notify server callback
  useEffect(() => {
    if (urlAdapter) {
      urlAdapter.write(serializeGridQueryParams(serverQueryPayload));
    }
    onServerQueryChange?.(serverQueryPayload);
  }, [serverQueryPayload, urlAdapter, onServerQueryChange]);

  const commitCellEdit = useCallback(async (
    rowId: string, columnId: string, oldValue: unknown, newValue: unknown, row: TData
  ): Promise<boolean> => {
    if (!onCellEdit) return false;
    const column = table.getColumn(columnId);
    const validationError = column?.columnDef.meta?.validateEdit?.(newValue);
    if (validationError) { setEditError(validationError); return false; }
    setEditError(null);
    setOptimistic((prev) => ({ ...prev, [rowId]: { ...prev[rowId], [columnId]: newValue } }));
    try {
      await onCellEdit({ rowId, columnId, oldValue, newValue, row });
      return true;
    } catch (error) {
      // Restore the original overlay; re-fetching data from the caller is also supported.
      setOptimistic((prev) => {
        const next = { ...prev };
        const changed = { ...next[rowId] };
        delete changed[columnId];
        if (Object.keys(changed).length) next[rowId] = changed;
        else delete next[rowId];
        return next;
      });
      setEditError(error instanceof Error ? error.message : 'Could not save the change');
      return false;
    }
  }, [onCellEdit, table]);

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
    table.resetColumnSizing();
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
    manualMode: serverManaged, facetCounts: dataSource ? sourcePage?.facetCounts : facetCounts,
    isLoading: sourceLoading, sourceError, onCellEdit, editError, commitCellEdit,
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
    rowSelection: rowSelectionAtom.get(),
    setRowSelection: table.setRowSelection,
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
export type SiftController<TData> = ReturnType<typeof useSift<TData>>;
