import React, { useMemo, useRef, useState } from 'react';
import { flexRender, type ColumnDef } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronDown,
  ChevronRight,
  FilterX,
  Inbox,
  Loader2,
} from 'lucide-react';
import type { DataGridFeatures } from '../features/grid-features';
import { useDataGrid, type UseDataGridOptions } from '../store/use-data-grid';
import type {
  BulkAction,
  DataGridEmptyStateConfig,
  GridDensity,
} from '../types/grid.types';
import { GridToolbar } from './grid-toolbar';
import { FilterRuleBuilder } from './filter-rule-builder';
import { BreadcrumbTrail } from './breadcrumb-trail';
import { GridHeader } from './grid-header';
import { ColumnManagerDrawer } from './column-manager-drawer';
import { BulkActionBar } from './bulk-action-bar';
import { GridPagination } from './grid-pagination';
import { cn } from '../utils/cn';

export interface DataGridProps<TData> extends UseDataGridOptions<TData> {
  title?: string;
  className?: string;
  /** Enable row selection checkboxes (supports Shift+Click range selection natively in TanStack V9) */
  enableSelection?: boolean;
  /** Floating dock bulk actions when rows are checked */
  bulkActions?: BulkAction<TData>[];
  /** Enable TanStack Virtual row virtualization (ideal for 1,000+ rows on a single page) */
  enableVirtualization?: boolean;
  /** Fixed viewport height for sticky scrolling & virtualization */
  maxHeight?: string;
  /** Loading indicator overlay */
  isLoading?: boolean;
  /** Export filename for CSV download */
  exportFilename?: string;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Custom empty / filtered-empty copy */
  emptyState?: DataGridEmptyStateConfig;
}

const DENSITY_ROW_HEIGHT: Record<GridDensity, number> = {
  compact: 36,
  comfortable: 46,
  spacious: 58,
};

const DENSITY_CELL_PADDING: Record<GridDensity, string> = {
  compact: 'py-1.5',
  comfortable: 'py-2.5',
  spacious: 'py-4',
};

export function DataGrid<TData>(props: DataGridProps<TData>) {
  const {
    title,
    className,
    columns: userColumns,
    enableSelection = true,
    bulkActions = [],
    enableVirtualization = false,
    maxHeight = '640px',
    isLoading = false,
    exportFilename,
    onRowClick,
    emptyState,
    ...hookOptions
  } = props;

  // Inject selection checkbox column with TanStack Table V9 indeterminate logic:
  // In V9, getIsSomePageRowsSelected() remains true when all rows are selected,
  // so we explicitly gate indeterminate by !getIsAllPageRowsSelected().
  const columns = useMemo<ColumnDef<DataGridFeatures, TData, unknown>[]>(() => {
    if (!enableSelection) return userColumns;
    const selectColumn: ColumnDef<DataGridFeatures, TData, unknown> = {
      id: '__select__',
      size: 44,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      enableColumnFilter: false,
      header: ({ table }) => {
        const allSelected = table.getIsAllPageRowsSelected();
        const someSelected = table.getIsSomePageRowsSelected() && !allSelected;
        return (
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label="Select all rows on page"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
        );
      },
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onClick={(e) => e.stopPropagation()}
          onChange={row.getToggleSelectedHandler()}
          aria-label="Select row"
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
      ),
    };
    return [selectColumn, ...userColumns];
  }, [enableSelection, userColumns]);

  const grid = useDataGrid({ ...hookOptions, columns });

  const [quickFilterOpen, setQuickFilterOpen] = useState(false);
  const [quickFilterColId, setQuickFilterColId] = useState<string | null>(null);
  const [ruleBuilderOpen, setRuleBuilderOpen] = useState(false);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rows = grid.table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => DENSITY_ROW_HEIGHT[grid.density],
    overscan: 8,
    enabled: enableVirtualization,
  });

  const virtualRows = enableVirtualization ? rowVirtualizer.getVirtualItems() : [];
  const paddingTop =
    enableVirtualization && virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    enableVirtualization && virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  const rowsToRender = enableVirtualization
    ? virtualRows.map((vRow) => rows[vRow.index])
    : rows;

  const isFilteredEmpty = rows.length === 0 && grid.activeFilterCount > 0;

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs',
        'dark:border-slate-800 dark:bg-slate-950',
        className
      )}
    >
      {/* 1. Primary Toolbar */}
      <GridToolbar
        grid={grid}
        title={title}
        exportFilename={exportFilename}
        quickFilterOpen={quickFilterOpen}
        quickFilterColumnId={quickFilterColId}
        onQuickFilterOpenChange={(open, colId = null) => {
          setQuickFilterOpen(open);
          setQuickFilterColId(colId);
        }}
        ruleBuilderOpen={ruleBuilderOpen}
        onToggleRuleBuilder={() => setRuleBuilderOpen((v) => !v)}
        onOpenColumnManager={() => setColumnManagerOpen(true)}
      />

      {/* 2. Collapsible Notion-Style AND/OR Rule Builder */}
      <FilterRuleBuilder
        grid={grid}
        open={ruleBuilderOpen}
        onClose={() => setRuleBuilderOpen(false)}
      />

      {/* 3. Interactive Filter Pills & Hierarchical Breadcrumb Trail */}
      <BreadcrumbTrail
        grid={grid}
        onOpenQuickFilter={(colId) => {
          setQuickFilterColId(colId ?? null);
          setQuickFilterOpen(true);
        }}
        onOpenRuleBuilder={() => setRuleBuilderOpen(true)}
      />

      {/* 4. Scrollable Data Canvas */}
      <div
        ref={scrollContainerRef}
        style={{ maxHeight }}
        className="relative overflow-auto"
      >
        {isLoading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-[1px] dark:bg-slate-950/70">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              Loading records...
            </div>
          </div>
        )}

        <table
          className="w-full border-collapse text-left text-sm"
          style={{ width: grid.table.getTotalSize() }}
        >
          <GridHeader
            grid={grid}
            onFilterColumn={(colId) => {
              setQuickFilterColId(colId);
              setQuickFilterOpen(true);
            }}
          />

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: `${paddingTop}px` }} />
              </tr>
            )}

            {rowsToRender.length === 0 ? (
              <tr>
                <td
                  colSpan={grid.table.getVisibleLeafColumns().length}
                  className="px-6 py-16 text-center"
                >
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-900">
                      {isFilteredEmpty ? (
                        <FilterX className="h-5 w-5" />
                      ) : (
                        <Inbox className="h-5 w-5" />
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {isFilteredEmpty
                        ? emptyState?.filteredTitle ?? 'No rows match your filters'
                        : emptyState?.title ?? 'No records yet'}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {isFilteredEmpty
                        ? emptyState?.filteredDescription ??
                          'Try broadening your search, switching AND to OR logic, or clearing active filters.'
                        : emptyState?.description ??
                          'Records will appear here as soon as data is loaded.'}
                    </p>
                    {isFilteredEmpty ? (
                      <button
                        type="button"
                        onClick={grid.clearAllFilters}
                        className="mt-4 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                      >
                        Reset all filters
                      </button>
                    ) : (
                      emptyState?.action && (
                        <div className="mt-4">{emptyState.action}</div>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rowsToRender.map((row) => {
                const isSelected = row.getIsSelected();
                const isGrouped = row.getIsGrouped();

                return (
                  <tr
                    key={row.id}
                    onClick={() => {
                      if (!isGrouped) onRowClick?.(row.original);
                    }}
                    className={cn(
                      'group transition-colors',
                      isGrouped
                        ? 'bg-slate-50/90 font-medium dark:bg-slate-900/70'
                        : isSelected
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                          : 'bg-white hover:bg-slate-50/80 dark:bg-slate-950 dark:hover:bg-slate-900/50',
                      onRowClick && !isGrouped && 'cursor-pointer'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const col = cell.column;
                      const pinned = col.getIsPinned(); // V9: 'start' | 'end' | false
                      const isLastStart =
                        pinned === 'start' && col.getIsLastColumn('start');
                      const isFirstEnd =
                        pinned === 'end' && col.getIsFirstColumn('end');
                      const align = col.columnDef.meta?.align ?? 'start';

                      const stickyStyle: React.CSSProperties = {
                        width: col.getSize(),
                        minWidth: col.getSize(),
                        position: pinned ? 'sticky' : undefined,
                        insetInlineStart:
                          pinned === 'start'
                            ? `${col.getStart('start')}px`
                            : undefined,
                        insetInlineEnd:
                          pinned === 'end' ? `${col.getAfter('end')}px` : undefined,
                        zIndex: pinned ? 10 : undefined,
                      };

                      return (
                        <td
                          key={cell.id}
                          style={stickyStyle}
                          className={cn(
                            'px-3 text-xs text-slate-700 dark:text-slate-200',
                            DENSITY_CELL_PADDING[grid.density],
                            align === 'end' && 'text-right',
                            align === 'center' && 'text-center',
                            pinned &&
                              (isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950'
                                : 'bg-white group-hover:bg-slate-50 dark:bg-slate-950 dark:group-hover:bg-slate-900'),
                            isLastStart &&
                              'shadow-[4px_0_8px_-4px_rgba(15,23,42,0.12)]',
                            isFirstEnd &&
                              'shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.12)]'
                          )}
                        >
                          {cell.getIsGrouped() ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                row.getToggleExpandedHandler()();
                              }}
                              className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100"
                            >
                              {row.getIsExpanded() ? (
                                <ChevronDown className="h-3.5 w-3.5 text-indigo-500" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                              )}
                              <span>
                                {flexRender(
                                  col.columnDef.cell,
                                  cell.getContext()
                                )}
                              </span>
                              <span className="rounded-full bg-slate-200/80 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {row.subRows.length}
                              </span>
                            </button>
                          ) : cell.getIsAggregated() ? (
                            flexRender(
                              col.columnDef.aggregatedCell ?? col.columnDef.cell,
                              cell.getContext()
                            )
                          ) : cell.getIsPlaceholder() ? null : (
                            flexRender(col.columnDef.cell, cell.getContext())
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}

            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: `${paddingBottom}px` }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Pagination Footer */}
      {!enableVirtualization && <GridPagination grid={grid} />}

      {/* 6. Slide-Over Column Studio Drawer */}
      <ColumnManagerDrawer
        grid={grid}
        open={columnManagerOpen}
        onClose={() => setColumnManagerOpen(false)}
      />

      {/* 7. Floating Bulk Action Dock */}
      {enableSelection && <BulkActionBar grid={grid} actions={bulkActions} />}
    </div>
  );
}
