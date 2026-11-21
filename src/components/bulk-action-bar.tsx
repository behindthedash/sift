import type { RowData } from '@tanstack/react-table';
import React from 'react';
import { X } from 'lucide-react';
import type { SiftController } from '../store/use-data-grid';
import type { BulkAction } from '../types/grid.types';
import { cn } from '../utils/cn';

interface BulkActionBarProps<TData extends RowData> {
  grid: SiftController<TData>;
  actions?: BulkAction<TData>[];
}

/**
 * Floating Linear/TableCN-inspired selection dock anchored to the bottom of the viewport
 * whenever one or more rows are selected.
 */
export function BulkActionBar<TData extends RowData>({
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
          'pointer-events-auto flex items-center gap-3 rounded-2xl border border-[var(--sift-ink)] bg-[var(--sift-ink)] px-4 py-2.5 text-xs text-white shadow-2xl',
          'dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]'
        )}
      >
        <div className="flex items-center gap-2 border-r border-[var(--sift-ink)] pr-3">
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--sift-accent)] px-1.5 font-mono text-[11px] font-bold text-white">
            {count}
          </span>
          <span className="font-medium text-[var(--sift-border)]">
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
                    : 'bg-[var(--sift-ink)] text-[var(--sift-surface-subtle)] hover:bg-[var(--sift-ink)]'
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
          className="ml-1 rounded-lg p-1 text-[var(--sift-muted)] hover:bg-[var(--sift-ink)] hover:text-white"
          aria-label="Clear selection"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
