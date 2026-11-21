import React, { useState } from 'react';
import { flexRender } from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  EyeOff,
  Filter,
  FolderTree,
  MoreVertical,
  PanelLeft,
  PanelRight,
  PinOff,
} from 'lucide-react';
import type { SiftController } from '../store/use-data-grid';
import { cn } from '../utils/cn';
import { SiftPopover } from './sift-popover';

interface GridHeaderProps<TData> {
  grid: SiftController<TData>;
  onFilterColumn: (columnId: string) => void;
  showHeaderFilters?: boolean;
}

/**
 * Sticky table header with:
 * - Multi-column sorting & priority badges (Shift+Click or menu)
 * - Context action popover (Sort, Filter, Group, Pin Start/End, Hide)
 * - Edge resize handle with double-click auto-reset
 * - TanStack Table V9 logical 'start' / 'end' sticky pinning with elevation shadows
 */
export function GridHeader<TData>({ grid, onFilterColumn }: GridHeaderProps<TData>) {
  const [openMenuColId, setOpenMenuColId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const sorting = grid.table.state.sorting;

  return (
    <thead className="sticky top-0 z-20 bg-[var(--sift-surface-subtle)]/95 backdrop-blur-xs dark:bg-[var(--sift-ink)]/95">
      {grid.table.getHeaderGroups().map((headerGroup) => (
        <tr
          key={headerGroup.id}
          className="border-b border-[var(--sift-border)] dark:border-[var(--sift-ink)]"
        >
          {headerGroup.headers.map((header) => {
            const col = header.column;
            const pinned = col.getIsPinned(); // V9: 'start' | 'end' | false
            const isLastStart = pinned === 'start' && col.getIsLastColumn('start');
            const isFirstEnd = pinned === 'end' && col.getIsFirstColumn('end');
            const sortDir = col.getIsSorted();
            const sortPriority =
              sorting.length > 1 ? col.getSortIndex() + 1 : null;
            const align = col.columnDef.meta?.align ?? 'start';
            const canSort = col.getCanSort();
            const isSelectCol = col.id === '__select__';

            const stickyStyle: React.CSSProperties = {
              width: header.getSize(),
              minWidth: header.getSize(),
              position: pinned ? 'sticky' : 'relative',
              insetInlineStart:
                pinned === 'start' ? `${col.getStart('start')}px` : undefined,
              insetInlineEnd:
                pinned === 'end' ? `${col.getAfter('end')}px` : undefined,
              zIndex: pinned ? 30 : 20,
            };

            return (
              <th
                key={header.id}
                aria-colindex={col.getIndex() + 1}
                aria-sort={sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : 'none'}
                colSpan={header.colSpan}
                style={stickyStyle}
                className={cn(
                  'group select-none px-3 py-2.5 text-xs font-semibold text-[var(--sift-muted)] dark:text-[var(--sift-border)]',
                  pinned && 'bg-[var(--sift-surface-subtle)] dark:bg-[var(--sift-ink)]',
                  isLastStart && 'shadow-[4px_0_8px_-4px_rgba(15,23,42,0.12)]',
                  isFirstEnd && 'shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.12)]'
                )}
              >
                <div
                  className={cn(
                    'flex items-center gap-1.5',
                    align === 'end' && 'justify-end',
                    align === 'center' && 'justify-center'
                  )}
                >
                  {/* Main Sortable Label */}
                  <button
                    type="button"
                    disabled={!canSort}
                    onClick={canSort ? col.getToggleSortingHandler() : undefined}
                    className={cn(
                      'flex min-w-0 items-center gap-1.5 truncate',
                      canSort &&
                        'cursor-pointer hover:text-[var(--sift-ink)] dark:hover:text-white'
                    )}
                  >
                    <span className="truncate">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            col.columnDef.header,
                            header.getContext()
                          )}
                    </span>

                    {canSort && !isSelectCol && (
                      <span className="inline-flex shrink-0 items-center">
                        {sortDir === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-[var(--sift-accent)] dark:text-[var(--sift-accent)]" />
                        ) : sortDir === 'desc' ? (
                          <ArrowDown className="h-3.5 w-3.5 text-[var(--sift-accent)] dark:text-[var(--sift-accent)]" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-[var(--sift-border)] opacity-0 transition-opacity group-hover:opacity-100 dark:text-[var(--sift-muted)]" />
                        )}
                        {sortPriority && sortPriority > 0 && (
                          <span className="ml-0.5 rounded bg-[var(--sift-accent-subtle)] px-1 font-mono text-[9px] text-[var(--sift-accent-strong)] dark:bg-[var(--sift-accent-deep)] dark:text-[var(--sift-accent-border)]">
                            {sortPriority}
                          </span>
                        )}
                      </span>
                    )}
                  </button>

                  {/* Column Header Menu Trigger */}
                  {!isSelectCol && col.columnDef.meta?.label && (
                    <div className="relative ml-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuAnchor(e.currentTarget);
                          setOpenMenuColId(openMenuColId === col.id ? null : col.id);
                        }}
                        className={cn(
                          'rounded p-0.5 text-[var(--sift-muted)] transition-opacity hover:bg-[var(--sift-border)]/70 hover:text-[var(--sift-ink)] dark:hover:bg-[var(--sift-ink)]',
                          openMenuColId === col.id
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        )}
                        aria-label={`Column menu for ${col.columnDef.meta.label}`}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>

                      {openMenuColId === col.id && (
                        <SiftPopover anchor={menuAnchor} placement="bottom-end" onDismiss={() => setOpenMenuColId(null)}><div
                          onMouseLeave={() => setOpenMenuColId(null)}
                          className="w-44 rounded-xl border border-[var(--sift-border)] bg-white p-1 text-left font-normal shadow-xl dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]"
                        >
                          {canSort && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  col.toggleSorting(false, false);
                                  setOpenMenuColId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]"
                              >
                                <ArrowUp className="h-3.5 w-3.5 text-[var(--sift-muted)]" />
                                Sort ascending
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  col.toggleSorting(true, false);
                                  setOpenMenuColId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]"
                              >
                                <ArrowDown className="h-3.5 w-3.5 text-[var(--sift-muted)]" />
                                Sort descending
                              </button>
                            </>
                          )}

                          {col.getCanFilter() && (
                            <button
                              type="button"
                              onClick={() => {
                                onFilterColumn(col.id);
                                setOpenMenuColId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]"
                            >
                              <Filter className="h-3.5 w-3.5 text-[var(--sift-accent)]" />
                              Filter by column
                            </button>
                          )}

                          {col.columnDef.meta?.groupable && (
                            <button
                              type="button"
                              onClick={() => {
                                grid.setGrouping((prev) =>
                                  prev.includes(col.id)
                                    ? prev.filter((id) => id !== col.id)
                                    : [...prev, col.id]
                                );
                                setOpenMenuColId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]"
                            >
                              <FolderTree className="h-3.5 w-3.5 text-[var(--sift-muted)]" />
                              {grid.grouping.includes(col.id)
                                ? 'Ungroup column'
                                : 'Group by column'}
                            </button>
                          )}

                          <div className="my-1 border-t border-[var(--sift-surface-subtle)] dark:border-[var(--sift-ink)]" />

                          <button
                            type="button"
                            onClick={() => {
                              col.pin(pinned === 'start' ? false : 'start');
                              setOpenMenuColId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]"
                          >
                            {pinned === 'start' ? (
                              <PinOff className="h-3.5 w-3.5 text-[var(--sift-muted)]" />
                            ) : (
                              <PanelLeft className="h-3.5 w-3.5 text-[var(--sift-muted)]" />
                            )}
                            {pinned === 'start' ? 'Unpin column' : 'Pin to start'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              col.pin(pinned === 'end' ? false : 'end');
                              setOpenMenuColId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]"
                          >
                            {pinned === 'end' ? (
                              <PinOff className="h-3.5 w-3.5 text-[var(--sift-muted)]" />
                            ) : (
                              <PanelRight className="h-3.5 w-3.5 text-[var(--sift-muted)]" />
                            )}
                            {pinned === 'end' ? 'Unpin column' : 'Pin to end'}
                          </button>

                          {!col.columnDef.meta?.lockedVisible && (
                            <button
                              type="button"
                              onClick={() => {
                                col.toggleVisibility(false);
                                setOpenMenuColId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60"
                            >
                              <EyeOff className="h-3.5 w-3.5" />
                              Hide column
                            </button>
                          )}
                        </div></SiftPopover>
                      )}
                    </div>
                  )}
                </div>

                {/* Edge Resize Handle */}
                {col.getCanResize() && !isSelectCol && (
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    onDoubleClick={() => col.resetSize()}
                    title="Drag to resize · Double-click to reset"
                    className={cn(
                      'absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none transition-colors',
                      col.getIsResizing()
                        ? 'bg-[var(--sift-accent)]'
                        : 'bg-transparent hover:bg-[var(--sift-accent)]/60'
                    )}
                  />
                )}
              </th>
            );
          })}
        </tr>
      ))}
      {showHeaderFilters && (
        <tr aria-label="Column filter inputs" className="border-b border-[var(--sift-border)] bg-white dark:bg-[var(--sift-ink)]">
          {grid.table.getVisibleLeafColumns().map((column) => {
            const variant = column.columnDef.meta?.filterVariant ?? 'text';
            const rule = grid.filterGroup.rules.find((r) => r.columnId === column.id);
            return <th key={column.id} className="px-2 py-1">
              {column.id === '__select__' ? null : variant === 'text' || variant === 'number' ? (
                <input aria-label={`Filter ${column.columnDef.meta?.label ?? column.id}`}
                  type={variant === 'number' ? 'number' : 'search'}
                  value={typeof rule?.value === 'string' || typeof rule?.value === 'number' ? String(rule.value) : ''}
                  onChange={(event) => grid.upsertColumnRule(column.id, variant === 'number' ? 'gte' : 'contains', event.target.value)}
                  className="w-full min-w-0 rounded border border-[var(--sift-border)] bg-white p-1 text-xs dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]" />
              ) : (
                <button type="button" onClick={() => onFilterColumn(column.id)} className="text-xs text-[var(--sift-muted)] hover:text-[var(--sift-accent)]">Filter…</button>
              )}
            </th>;
          })}
        </tr>
      )}
    </thead>
  );
}
