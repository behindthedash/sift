import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Columns3,
  Download,
  Filter,
  FolderTree,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import type { DataGridController } from '../store/use-data-grid';
import type { GridDensity } from '../types/grid.types';
import { exportRowsToCsv } from '../utils/export-csv';
import { FilterCommandMenu } from './filter-command-menu';
import { cn } from '../utils/cn';

interface GridToolbarProps<TData> {
  grid: DataGridController<TData>;
  title?: string;
  exportFilename?: string;
  quickFilterOpen: boolean;
  quickFilterColumnId: string | null;
  onQuickFilterOpenChange: (open: boolean, columnId?: string | null) => void;
  ruleBuilderOpen: boolean;
  onToggleRuleBuilder: () => void;
  onOpenColumnManager: () => void;
}

export function GridToolbar<TData>({
  grid,
  title,
  exportFilename = 'export.csv',
  quickFilterOpen,
  quickFilterColumnId,
  onQuickFilterOpenChange,
  ruleBuilderOpen,
  onToggleRuleBuilder,
  onOpenColumnManager,
}: GridToolbarProps<TData>) {
  const [viewsOpen, setViewsOpen] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl + K opens Quick Filter Command Menu; '/' focuses search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onQuickFilterOpenChange(!quickFilterOpen, null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [quickFilterOpen, onQuickFilterOpenChange]);

  const groupableColumns = grid.table
    .getAllLeafColumns()
    .filter((c) => c.columnDef.meta?.groupable);

  const visibleCount = grid.table
    .getVisibleLeafColumns()
    .filter((c) => c.id !== '__select__').length;
  const totalManageable = grid.table
    .getAllLeafColumns()
    .filter((c) => c.id !== '__select__' && c.columnDef.meta?.label).length;

  const handleExportCsv = () => {
    const visibleCols = grid.table
      .getVisibleLeafColumns()
      .filter((c) => c.id !== '__select__' && c.columnDef.meta?.label);

    const rows = grid.table.getFilteredRowModel().rows.map((r) => r.original);
    exportRowsToCsv(
      rows,
      visibleCols.map((col) => ({
        id: col.id,
        label: col.columnDef.meta?.label ?? col.id,
        getValue: (original) => (original as Record<string, unknown>)[col.id],
      })),
      exportFilename
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
      {/* Left: Title + Global Search + Dual Filter Triggers */}
      <div className="flex flex-wrap items-center gap-2">
        {title && (
          <h1 className="mr-2 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h1>
        )}

        {/* Instant Global Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={grid.globalFilter}
            onChange={(e) => grid.setGlobalFilter(e.target.value)}
            placeholder="Search rows..."
            className={cn(
              'w-52 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs text-slate-900',
              'transition-all focus:w-64 focus:border-indigo-500 focus:bg-white focus:outline-none',
              'dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
            )}
          />
          {grid.globalFilter && (
            <button
              type="button"
              onClick={() => grid.setGlobalFilter('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Mode 1: Quick Command-Palette Filter (⌘K) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => onQuickFilterOpenChange(!quickFilterOpen, null)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
              quickFilterOpen
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900'
            )}
          >
            <Filter className="h-3.5 w-3.5 text-indigo-500" />
            <span>Filter</span>
            <kbd className="hidden rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-400 sm:inline dark:bg-slate-800">
              ⌘K
            </kbd>
          </button>

          <FilterCommandMenu
            grid={grid}
            open={quickFilterOpen}
            initialColumnId={quickFilterColumnId}
            onOpenChange={(open) => onQuickFilterOpenChange(open, null)}
          />
        </div>

        {/* Mode 2: Advanced Notion-Style AND/OR Rule Builder */}
        <button
          type="button"
          onClick={onToggleRuleBuilder}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
            ruleBuilderOpen || grid.filterGroup.rules.length > 0
              ? 'border-indigo-200 bg-indigo-50/70 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900'
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Rules</span>
          {grid.filterGroup.rules.length > 0 && (
            <span className="rounded-full bg-indigo-600 px-1.5 py-0.2 text-[10px] font-semibold text-white">
              {grid.filterGroup.rules.length}
            </span>
          )}
        </button>

        {/* Grouping Hierarchy Selector (feeds Breadcrumbs) */}
        {groupableColumns.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setGroupMenuOpen((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                grid.grouping.length > 0
                  ? 'border-indigo-200 bg-indigo-50/70 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900'
              )}
            >
              <FolderTree className="h-3.5 w-3.5" />
              <span>Group</span>
              {grid.grouping.length > 0 && (
                <span className="rounded-full bg-indigo-600 px-1.5 text-[10px] text-white">
                  {grid.grouping.length}
                </span>
              )}
            </button>

            {groupMenuOpen && (
              <div className="absolute left-0 top-full z-40 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Group Breadcrumb Path
                </div>
                {groupableColumns.map((col) => {
                  const active = grid.grouping.includes(col.id);
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => {
                        grid.setGrouping((prev) =>
                          prev.includes(col.id)
                            ? prev.filter((id) => id !== col.id)
                            : [...prev, col.id]
                        );
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs',
                        active
                          ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900'
                      )}
                    >
                      <span>{col.columnDef.meta?.label ?? col.id}</span>
                      {active && (
                        <span className="font-mono text-[10px] text-indigo-500">
                          #{grid.grouping.indexOf(col.id) + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Saved Views, Density, Column Studio, CSV Export */}
      <div className="flex items-center gap-2">
        {/* Saved Views Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setViewsOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <Bookmark className="h-3.5 w-3.5 text-slate-400" />
            <span>Views</span>
            {grid.savedViews.length > 0 && (
              <span className="text-[11px] text-slate-400">
                ({grid.savedViews.length})
              </span>
            )}
          </button>

          {viewsOpen && (
            <div className="absolute right-0 top-full z-40 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Saved Views
              </div>
              {grid.savedViews.length === 0 ? (
                <p className="px-2 py-2 text-xs text-slate-400">
                  Save your current filters, sort, and columns as a reusable preset.
                </p>
              ) : (
                <div className="mb-2 max-h-40 space-y-1 overflow-y-auto">
                  {grid.savedViews.map((view) => (
                    <div
                      key={view.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg px-2 py-1.5 text-xs',
                        grid.activeViewId === view.id
                          ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-900'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          grid.applySavedView(view.id);
                          setViewsOpen(false);
                        }}
                        className="flex-1 truncate text-left"
                      >
                        {view.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => grid.deleteSavedView(view.id)}
                        className="ml-2 text-slate-400 hover:text-rose-600"
                        aria-label={`Delete ${view.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form
                className="flex gap-1.5 border-t border-slate-100 pt-2 dark:border-slate-800"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newViewName.trim()) return;
                  grid.saveCurrentView(newViewName);
                  setNewViewName('');
                }}
              >
                <input
                  type="text"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="Save current view..."
                  className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  Save
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Density Segmented Switch */}
        <div
          className="hidden items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 md:inline-flex dark:border-slate-800 dark:bg-slate-900"
          role="group"
          aria-label="Row density"
        >
          {(['compact', 'comfortable', 'spacious'] as GridDensity[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => grid.setDensity(d)}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors',
                grid.density === d
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              )}
            >
              {d.slice(0, 4)}
            </button>
          ))}
        </div>

        {/* Column Studio Button */}
        <button
          type="button"
          onClick={onOpenColumnManager}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <Columns3 className="h-3.5 w-3.5 text-slate-400" />
          <span>Columns</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {visibleCount}/{totalManageable}
          </span>
        </button>

        {/* CSV Export */}
        <button
          type="button"
          onClick={handleExportCsv}
          title="Export filtered rows to CSV"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <Download className="h-3.5 w-3.5 text-slate-400" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
    </div>
  );
}
