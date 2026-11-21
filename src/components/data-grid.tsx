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
import type { SiftFeatures } from '../features/grid-features';
import { useSift, type UseSiftOptions } from '../store/use-data-grid';
import type {
  BulkAction,
  SiftEmptyStateConfig,
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
import { encodeTsv, parseTsv } from '../utils/tsv';
import { summarizeColumn } from '../utils/summary';

export interface SiftProps<TData> extends UseSiftOptions<TData> {
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
  emptyState?: SiftEmptyStateConfig;
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

export function Sift<TData>(props: SiftProps<TData>) {
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
  const columns = useMemo<ColumnDef<SiftFeatures, TData, unknown>[]>(() => {
    if (!enableSelection) return userColumns;
    const selectColumn: ColumnDef<SiftFeatures, TData, unknown> = {
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
            className="h-4 w-4 rounded border-[var(--sift-border)] text-[var(--sift-accent)] focus:ring-[var(--sift-accent)]"
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
          className="h-4 w-4 rounded border-[var(--sift-border)] text-[var(--sift-accent)] focus:ring-[var(--sift-accent)]"
        />
      ),
    };
    return [selectColumn, ...userColumns];
  }, [enableSelection, userColumns]);

  const grid = useSift({ ...hookOptions, columns });
  const loading = isLoading || grid.isLoading;

  const [quickFilterOpen, setQuickFilterOpen] = useState(false);
  const [quickFilterColId, setQuickFilterColId] = useState<string | null>(null);
  const [ruleBuilderOpen, setRuleBuilderOpen] = useState(false);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [showHeaderFilters, setShowHeaderFilters] = useState(false);
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string; value: string } | null>(null);

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

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLTableCellElement>) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    const arrows: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      Tab: event.shiftKey ? 'left' : 'right',
    };
    const direction = arrows[event.key];
    if (direction) {
      event.preventDefault();
      if (event.shiftKey && event.key !== 'Tab') grid.table.extendCellSelection(direction);
      else grid.table.moveCellSelection(direction);
      const focused = grid.table.atoms.cellSelection.get().at(-1);
      if (focused) document.querySelector<HTMLElement>(`[data-sift-cell="${CSS.escape(focused.focusRowId)}:${CSS.escape(focused.focusColumnId)}"]`)?.focus();
    } else if (event.key === 'Escape') {
      grid.table.resetCellSelection(true);
    } else if (event.key === 'Enter') {
      const focused = grid.table.atoms.cellSelection.get().at(-1);
      if (focused) {
        const row = grid.table.getRowModel().rows.find((candidate) => candidate.id === focused.focusRowId);
        const col = grid.table.getColumn(focused.focusColumnId);
        if (row && col?.columnDef.meta?.editable && grid.onCellEdit) {
          event.preventDefault();
          setEditingCell({ rowId: row.id, columnId: col.id, value: String(row.getValue(col.id) ?? '') });
        }
      }
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
      const ranges = grid.table.getSelectedCellRangesData();
      if (ranges.length) {
        event.preventDefault();
        void navigator.clipboard.writeText(ranges.map(encodeTsv).join('\r\n'));
      }
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v' && grid.onCellEdit) {
      event.preventDefault();
      void navigator.clipboard.readText().then(async (tsv) => {
        const focus = grid.table.atoms.cellSelection.get().at(-1);
        if (!focus) return;
        const visibleRows = grid.table.getRowModel().rows.filter((r) => !r.getIsGrouped());
        const visibleColumns = grid.table.getVisibleLeafColumns().filter((c) => c.id !== '__select__');
        const rowIndex = visibleRows.findIndex((r) => r.id === focus.focusRowId);
        const columnIndex = visibleColumns.findIndex((c) => c.id === focus.focusColumnId);
        if (rowIndex < 0 || columnIndex < 0) return;
        for (const [rOffset, values] of parseTsv(tsv).entries()) {
          const row = visibleRows[rowIndex + rOffset]; if (!row) break;
          for (const [cOffset, text] of values.entries()) {
            const col = visibleColumns[columnIndex + cOffset]; if (!col?.columnDef.meta?.editable) continue;
            const nextValue = col.columnDef.meta.parseEdit?.(text) ?? text;
            await grid.commitCellEdit(row.id, col.id, row.getValue(col.id), nextValue, row.original);
          }
        }
      });
    }
  };

  const saveEditingCell = async () => {
    if (!editingCell) return;
    const row = grid.table.getRowModel().rows.find((item) => item.id === editingCell.rowId);
    const col = grid.table.getColumn(editingCell.columnId);
    if (!row || !col) { setEditingCell(null); return; }
    const newValue = col.columnDef.meta?.parseEdit?.(editingCell.value) ?? editingCell.value;
    const success = await grid.commitCellEdit(row.id, col.id, row.getValue(col.id), newValue, row.original);
    if (success) setEditingCell(null);
  };

  return (
    <div
      className={cn(
        'sift relative flex flex-col overflow-hidden rounded-2xl border border-[var(--sift-border)] bg-white shadow-xs',
        'dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]',
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
        showHeaderFilters={showHeaderFilters}
        onToggleHeaderFilters={() => setShowHeaderFilters((previous) => !previous)}
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
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-[1px] dark:bg-[var(--sift-ink)]/70">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--sift-border)] bg-white px-4 py-2 text-xs font-medium text-[var(--sift-ink)] shadow-md dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-border)]">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--sift-accent)]" />
              Loading records...
            </div>
          </div>
        )}

        <table
          role="grid"
          aria-label={title ?? "Sift data grid"}
          aria-rowcount={grid.table.getRowModel().rows.length}
          className="w-full border-collapse text-left text-sm"
          style={{ width: grid.table.getTotalSize() }}
        >
          <grid.table.Subscribe selector={(state) => ({ sizing: state.columnSizing, sorting: state.sorting })}>
          {() => <GridHeader
            grid={grid}
            showHeaderFilters={showHeaderFilters}
            onFilterColumn={(colId) => {
              setQuickFilterColId(colId);
              setQuickFilterOpen(true);
            }}
          />}
          </grid.table.Subscribe>

          <grid.table.Subscribe selector={(state) => ({ cellSelection: state.cellSelection, rowSelection: state.rowSelection })}>
          {() => <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
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
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--sift-surface-subtle)] text-[var(--sift-muted)] dark:bg-[var(--sift-ink)]">
                      {isFilteredEmpty ? (
                        <FilterX className="h-5 w-5" />
                      ) : (
                        <Inbox className="h-5 w-5" />
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]">
                      {isFilteredEmpty
                        ? emptyState?.filteredTitle ?? 'No rows match your filters'
                        : emptyState?.title ?? 'No records yet'}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--sift-muted)]">
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
                        className="mt-4 rounded-lg bg-[var(--sift-accent)] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[var(--sift-accent)]"
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
                    aria-rowindex={row.index + 1}
                    onClick={() => {
                      if (!isGrouped) onRowClick?.(row.original);
                    }}
                    className={cn(
                      'group transition-colors',
                      isGrouped
                        ? 'bg-[var(--sift-surface-subtle)]/90 font-medium dark:bg-[var(--sift-ink)]/70'
                        : isSelected
                          ? 'bg-[var(--sift-accent-subtle)]/60 dark:bg-[var(--sift-accent-deep)]/30'
                          : 'bg-white hover:bg-[var(--sift-surface-subtle)]/80 dark:bg-[var(--sift-ink)] dark:hover:bg-[var(--sift-ink)]/50',
                      onRowClick && !isGrouped && 'cursor-pointer'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const col = cell.column;
                      if (cell.getIsCovered()) return null;
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
                          role="gridcell"
                          aria-selected={cell.getIsSelected()}
                          aria-colindex={col.getIndex() + 1}
                          rowSpan={cell.getRowSpan()}
                          colSpan={cell.getColSpan()}
                          data-sift-cell={`${row.id}:${col.id}`}
                          tabIndex={cell.getTabIndex()}
                          onMouseDown={col.id !== '__select__' ? cell.getSelectionStartHandler() : undefined}
                          onMouseEnter={col.id !== '__select__' ? cell.getSelectionExtendHandler() : undefined}
                          onKeyDown={handleGridKeyDown}
                          onDoubleClick={() => {
                            if (col.columnDef.meta?.editable && grid.onCellEdit && !row.getIsGrouped()) {
                              setEditingCell({ rowId: row.id, columnId: col.id, value: String(cell.getValue() ?? '') });
                            }
                          }}
                          style={stickyStyle}
                          className={cn(
                            'px-3 text-xs text-[var(--sift-ink)] dark:text-[var(--sift-border)]',
                            cell.getIsSelected() && 'bg-[var(--sift-accent-subtle)]/80 ring-1 ring-inset ring-[var(--sift-accent)] dark:bg-[var(--sift-accent-strong)]/40',
                            cell.getIsFocused() && 'outline outline-2 outline-offset-[-2px] outline-[var(--sift-accent)]',
                            DENSITY_CELL_PADDING[grid.density],
                            align === 'end' && 'text-right',
                            align === 'center' && 'text-center',
                            pinned &&
                              (isSelected
                                ? 'bg-[var(--sift-accent-subtle)] dark:bg-[var(--sift-accent-deep)]'
                                : 'bg-white group-hover:bg-[var(--sift-surface-subtle)] dark:bg-[var(--sift-ink)] dark:group-hover:bg-[var(--sift-ink)]'),
                            isLastStart &&
                              'shadow-[4px_0_8px_-4px_rgba(15,23,42,0.12)]',
                            isFirstEnd &&
                              'shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.12)]'
                          )}
                        >
                          {editingCell?.rowId === row.id && editingCell.columnId === col.id ? (
                            <input
                              autoFocus
                              aria-label={`Edit ${col.columnDef.meta?.label ?? col.id}`}
                              value={editingCell.value}
                              onChange={(event) => setEditingCell((current) => current ? { ...current, value: event.target.value } : null)}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                                if (event.key === 'Escape') setEditingCell(null);
                                if (event.key === 'Enter') void saveEditingCell();
                              }}
                              className="w-full rounded border border-[var(--sift-accent)] bg-white px-1 py-0.5 text-[var(--sift-ink)] focus:outline-none"
                            />
                          ) : cell.getIsGrouped() ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                row.getToggleExpandedHandler()();
                              }}
                              className="inline-flex items-center gap-1.5 font-semibold text-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]"
                            >
                              {row.getIsExpanded() ? (
                                <ChevronDown className="h-3.5 w-3.5 text-[var(--sift-accent)]" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-[var(--sift-muted)]" />
                              )}
                              <span>
                                {flexRender(
                                  col.columnDef.cell,
                                  cell.getContext()
                                )}
                              </span>
                              <span className="rounded-full bg-[var(--sift-border)]/80 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-[var(--sift-muted)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-border)]">
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
          </tbody>}
          </grid.table.Subscribe>
          {grid.table.getVisibleLeafColumns().some((col) => col.columnDef.meta?.summary) && (
            <tfoot className="sticky bottom-0 bg-[var(--sift-surface-subtle)]/95 font-semibold text-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]">
              <tr aria-label="Summary footer row">
                {grid.table.getVisibleLeafColumns().map((col) => (
                  <td key={col.id} className="border-t border-[var(--sift-border)] px-3 py-2 text-xs dark:border-[var(--sift-ink)]">
                    {col.columnDef.meta?.summary
                      ? summarizeColumn(grid.table.getFilteredRowModel().rows, col.id, col.columnDef.meta.summary)
                      : null}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {grid.editError && <p role="alert" className="px-4 py-2 text-xs text-rose-600">{grid.editError}</p>}
      {/* 5. Pagination Footer */}
      {!enableVirtualization && <GridPagination grid={grid} />}

      {/* 6. Slide-Over Column Studio Drawer */}
      <ColumnManagerDrawer
        grid={grid}
        open={columnManagerOpen}
        onClose={() => setColumnManagerOpen(false)}
      />

      {/* 7. Floating Bulk Action Dock */}
      {enableSelection && <grid.table.Subscribe selector={(state) => state.rowSelection}>
        {() => <BulkActionBar grid={grid} actions={bulkActions} />}
      </grid.table.Subscribe>}
    </div>
  );
}
