import React from 'react';
import { X } from 'lucide-react';
import type { DataGridController } from '../store/use-data-grid';
import type { BulkAction } from '../types/grid.types';
import { cn } from '../utils/cn';

interface BulkActionBarProps<TData> {
  grid: DataGridController<TData>;
  actions?: BulkAction<TData>[];
}

/**
 * Floating Linear/TableCN-inspired selection dock anchored to the bottom of the viewport
 * whenever one or more rows are selected.
 */
export function BulkActionBar<TData>({
  grid,
  actions = [],
}: BulkActionBarProps<TData>) {
  const selectedRows = grid.table.getSelectedRowModel().rows;
  const count = selectedRows.length;

  if (count === 0) return null;

  const clearSelection = () => grid.table.resetRowSelection();
  const originals = selectedRows.map((r) => r.original);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div
        role="region"
        aria-label="Bulk row actions"
        className={cn(
          'pointer-events-auto flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-white shadow-2xl',
          'dark:border-slate-700 dark:bg-slate-950'
        )}
      >
        <div className="flex items-center gap-2 border-r border-slate-700 pr-3">
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1.5 font-mono text-[11px] font-bold text-white">
            {count}
          </span>
          <span className="font-medium text-slate-200">
            {count === 1 ? 'row selected' : 'rows selected'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => action.onAction(originals, clearSelection)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors',
                  action.variant === 'destructive'
                    ? 'bg-rose-600/20 text-rose-300 hover:bg-rose-600 hover:text-white'
                    : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {action.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={clearSelection}
          className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Clear selection"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
