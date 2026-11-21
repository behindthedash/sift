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
import type { DataGridController } from '../store/use-data-grid';
import { cn } from '../utils/cn';

interface GridHeaderProps<TData> {
  grid: DataGridController<TData>;
  onFilterColumn: (columnId: string) => void;
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
  const sorting = grid.table.state.sorting;

  return (
    <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs dark:bg-slate-900/95">
      {grid.table.getHeaderGroups().map((headerGroup) => (
        <tr
          key={headerGroup.id}
          className="border-b border-slate-200 dark:border-slate-800"
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
                colSpan={header.colSpan}
                style={stickyStyle}
                className={cn(
                  'group select-none px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300',
                  pinned && 'bg-slate-50 dark:bg-slate-900',
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
                        'cursor-pointer hover:text-slate-950 dark:hover:text-white'
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
                          <ArrowUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        ) : sortDir === 'desc' ? (
                          <ArrowDown className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600" />
                        )}
                        {sortPriority && sortPriority > 0 && (
                          <span className="ml-0.5 rounded bg-indigo-100 px-1 font-mono text-[9px] text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
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
                          setOpenMenuColId(openMenuColId === col.id ? null : col.id);
                        }}
                        className={cn(
                          'rounded p-0.5 text-slate-400 transition-opacity hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-800',
                          openMenuColId === col.id
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        )}
                        aria-label={`Column menu for ${col.columnDef.meta.label}`}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>

                      {openMenuColId === col.id && (
                        <div
                          onMouseLeave={() => setOpenMenuColId(null)}
                          className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 text-left font-normal shadow-xl dark:border-slate-800 dark:bg-slate-950"
                        >
                          {canSort && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  col.toggleSorting(false, false);
                                  setOpenMenuColId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                              >
                                <ArrowUp className="h-3.5 w-3.5 text-slate-400" />
                                Sort ascending
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  col.toggleSorting(true, false);
                                  setOpenMenuColId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                              >
                                <ArrowDown className="h-3.5 w-3.5 text-slate-400" />
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
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                            >
                              <Filter className="h-3.5 w-3.5 text-indigo-500" />
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
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                            >
                              <FolderTree className="h-3.5 w-3.5 text-slate-400" />
                              {grid.grouping.includes(col.id)
                                ? 'Ungroup column'
                                : 'Group by column'}
                            </button>
                          )}

                          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                          <button
                            type="button"
                            onClick={() => {
                              col.pin(pinned === 'start' ? false : 'start');
                              setOpenMenuColId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                          >
                            {pinned === 'start' ? (
                              <PinOff className="h-3.5 w-3.5 text-slate-400" />
                            ) : (
                              <PanelLeft className="h-3.5 w-3.5 text-slate-400" />
                            )}
                            {pinned === 'start' ? 'Unpin column' : 'Pin to start'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              col.pin(pinned === 'end' ? false : 'end');
                              setOpenMenuColId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                          >
                            {pinned === 'end' ? (
                              <PinOff className="h-3.5 w-3.5 text-slate-400" />
                            ) : (
                              <PanelRight className="h-3.5 w-3.5 text-slate-400" />
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
                        </div>
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
                        ? 'bg-indigo-500'
                        : 'bg-transparent hover:bg-indigo-400/60'
                    )}
                  />
                )}
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );
}
