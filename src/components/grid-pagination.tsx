import type { RowData } from '@tanstack/react-table';
import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import type { SiftController } from '../store/use-data-grid';

interface GridPaginationProps<TData extends RowData> {
  grid: SiftController<TData>;
  pageSizeOptions?: number[];
}

export function GridPagination<TData extends RowData>({
  grid,
  pageSizeOptions = [10, 25, 50, 100],
}: GridPaginationProps<TData>) {
  const { pageIndex, pageSize } = grid.pagination;
  const totalFiltered = grid.table.getRowCount();
  const pageCount = Math.max(1, grid.table.getPageCount());
  const startRow = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1;
  const endRow = Math.min(totalFiltered, (pageIndex + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--sift-border)] bg-white px-4 py-2.5 text-xs text-[var(--sift-muted)] dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-muted)]">
      <div>
        Showing{' '}
        <span className="font-semibold text-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]">
          {startRow.toLocaleString()}–{endRow.toLocaleString()}
        </span>{' '}
        of{' '}
        <span className="font-semibold text-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]">
          {totalFiltered.toLocaleString()}
        </span>{' '}
        records
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => grid.table.setPageSize(Number(e.target.value))}
            className="rounded-md border border-[var(--sift-border)] bg-white px-2 py-1 text-xs font-medium text-[var(--sift-ink)] focus:border-[var(--sift-accent)] focus:outline-none dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <span className="mr-2 font-medium text-[var(--sift-ink)] dark:text-[var(--sift-border)]">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => grid.table.firstPage()}
            disabled={!grid.table.getCanPreviousPage()}
            className="rounded-md border border-[var(--sift-border)] p-1 hover:bg-[var(--sift-surface-subtle)] disabled:opacity-40 dark:border-[var(--sift-ink)] dark:hover:bg-[var(--sift-ink)]"
            aria-label="First page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => grid.table.previousPage()}
            disabled={!grid.table.getCanPreviousPage()}
            className="rounded-md border border-[var(--sift-border)] p-1 hover:bg-[var(--sift-surface-subtle)] disabled:opacity-40 dark:border-[var(--sift-ink)] dark:hover:bg-[var(--sift-ink)]"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => grid.table.nextPage()}
            disabled={!grid.table.getCanNextPage()}
            className="rounded-md border border-[var(--sift-border)] p-1 hover:bg-[var(--sift-surface-subtle)] disabled:opacity-40 dark:border-[var(--sift-ink)] dark:hover:bg-[var(--sift-ink)]"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => grid.table.lastPage()}
            disabled={!grid.table.getCanNextPage()}
            className="rounded-md border border-[var(--sift-border)] p-1 hover:bg-[var(--sift-surface-subtle)] disabled:opacity-40 dark:border-[var(--sift-ink)] dark:hover:bg-[var(--sift-ink)]"
            aria-label="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
