import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import type { DataGridController } from '../store/use-data-grid';

interface GridPaginationProps<TData> {
  grid: DataGridController<TData>;
  pageSizeOptions?: number[];
}

export function GridPagination<TData>({
  grid,
  pageSizeOptions = [10, 25, 50, 100],
}: GridPaginationProps<TData>) {
  const { pageIndex, pageSize } = grid.table.state.pagination;
  const totalFiltered = grid.table.getRowCount();
  const pageCount = Math.max(1, grid.table.getPageCount());
  const startRow = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1;
  const endRow = Math.min(totalFiltered, (pageIndex + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
      <div>
        Showing{' '}
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {startRow.toLocaleString()}–{endRow.toLocaleString()}
        </span>{' '}
        of{' '}
        <span className="font-semibold text-slate-900 dark:text-slate-100">
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
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <span className="mr-2 font-medium text-slate-700 dark:text-slate-300">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => grid.table.firstPage()}
            disabled={!grid.table.getCanPreviousPage()}
            className="rounded-md border border-slate-200 p-1 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:hover:bg-slate-900"
            aria-label="First page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => grid.table.previousPage()}
            disabled={!grid.table.getCanPreviousPage()}
            className="rounded-md border border-slate-200 p-1 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:hover:bg-slate-900"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => grid.table.nextPage()}
            disabled={!grid.table.getCanNextPage()}
            className="rounded-md border border-slate-200 p-1 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:hover:bg-slate-900"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => grid.table.lastPage()}
            disabled={!grid.table.getCanNextPage()}
            className="rounded-md border border-slate-200 p-1 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:hover:bg-slate-900"
            aria-label="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
