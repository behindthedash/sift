import type { RowData } from '@tanstack/react-table';
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
import type { SiftController } from '../store/use-data-grid';
import type { GridDensity } from '../types/grid.types';
import { exportRowsToCsv } from '../utils/export-csv';
import { FilterCommandMenu } from './filter-command-menu';
import { cn } from '../utils/cn';
import { SiftPopover } from './sift-popover';

interface GridToolbarProps<TData extends RowData> {
  grid: SiftController<TData>;
  title?: string;
  exportFilename?: string;
  quickFilterOpen: boolean;
  quickFilterColumnId: string | null;
  onQuickFilterOpenChange: (open: boolean, columnId?: string | null) => void;
  ruleBuilderOpen: boolean;
  onToggleRuleBuilder: () => void;
  onOpenColumnManager: () => void;
  showHeaderFilters: boolean;
  onToggleHeaderFilters: () => void;
}

export function GridToolbar<TData extends RowData>({
  grid,
  title,
  exportFilename = 'export.csv',
  quickFilterOpen,
  quickFilterColumnId,
  onQuickFilterOpenChange,
  ruleBuilderOpen,
  onToggleRuleBuilder,
  onOpenColumnManager,
  showHeaderFilters, onToggleHeaderFilters,
}: GridToolbarProps<TData>) {
  const [viewsOpen, setViewsOpen] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [exportSelectedOnly, setExportSelectedOnly] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [groupAnchor, setGroupAnchor] = useState<HTMLElement | null>(null);
  const [viewsAnchor, setViewsAnchor] = useState<HTMLElement | null>(null);

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

    const rows = exportSelectedOnly
      ? grid.table.getSelectedRowModel().rows
      : grid.table.getFilteredRowModel().rows;
    if (exportSelectedOnly && rows.length === 0) return;
    exportRowsToCsv(
      rows,
      visibleCols.map((col) => ({
        id: col.id,
        label: col.columnDef.meta?.label ?? col.id,
        getValue: (row) => {
          const value = row.getValue(col.id);
          return col.columnDef.meta?.formatValue?.(value) ?? value;
        },
      })),
      exportFilename
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sift-border)] bg-white px-4 py-3 dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]">
      {/* Left: Title + Global Search + Dual Filter Triggers */}
      <div className="flex flex-wrap items-center gap-2">
        {title && (
          <h1 className="mr-2 text-sm font-semibold tracking-tight text-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]">
            {title}
          </h1>
        )}

        {/* Instant Global Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[var(--sift-muted)]" />
          <input
            ref={searchInputRef}
            type="text"
            value={grid.globalFilter}
            onChange={(e) => grid.setGlobalFilter(e.target.value)}
            placeholder="Search rows..."
            className={cn(
              'w-52 rounded-lg border border-[var(--sift-border)] bg-[var(--sift-surface-subtle)] py-1.5 pl-8 pr-7 text-xs text-[var(--sift-ink)]',
              'transition-all focus:w-64 focus:border-[var(--sift-accent)] focus:bg-white focus:outline-none',
              'dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]'
            )}
          />
          {grid.globalFilter && (
            <button
              type="button"
              onClick={() => grid.setGlobalFilter('')}
              className="absolute right-2 top-2 text-[var(--sift-muted)] hover:text-[var(--sift-muted)]"
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
            ref={filterButtonRef}
            onClick={() => onQuickFilterOpenChange(!quickFilterOpen, null)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
              quickFilterOpen
                ? 'border-[var(--sift-accent)] bg-[var(--sift-accent-subtle)] text-[var(--sift-accent-strong)] dark:bg-[var(--sift-accent-deep)] dark:text-[var(--sift-accent-border)]'
                : 'border-[var(--sift-border)] bg-white text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]'
            )}
          >
            <Filter className="h-3.5 w-3.5 text-[var(--sift-accent)]" />
            <span>Filter</span>
            <kbd className="hidden rounded bg-[var(--sift-surface-subtle)] px-1 py-0.5 font-mono text-[10px] text-[var(--sift-muted)] sm:inline dark:bg-[var(--sift-ink)]">
              ⌘K
            </kbd>
          </button>

          <FilterCommandMenu
            grid={grid}
            anchor={filterButtonRef.current}
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
              ? 'border-[var(--sift-accent-border)] bg-[var(--sift-accent-subtle)]/70 text-[var(--sift-accent-strong)] dark:border-[var(--sift-accent-strong)] dark:bg-[var(--sift-accent-deep)]/60 dark:text-[var(--sift-accent-border)]'
              : 'border-[var(--sift-border)] bg-white text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]'
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Rules</span>
          {grid.filterGroup.rules.length > 0 && (
            <span className="rounded-full bg-[var(--sift-accent)] px-1.5 py-0.2 text-[10px] font-semibold text-white">
              {grid.filterGroup.rules.length}
            </span>
          )}
        </button>

        {/* Grouping Hierarchy Selector (feeds Breadcrumbs) */}
        {groupableColumns.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={(event) => { setGroupAnchor(event.currentTarget); setGroupMenuOpen((v) => !v); }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                grid.grouping.length > 0
                  ? 'border-[var(--sift-accent-border)] bg-[var(--sift-accent-subtle)]/70 text-[var(--sift-accent-strong)] dark:border-[var(--sift-accent-strong)] dark:bg-[var(--sift-accent-deep)]/60 dark:text-[var(--sift-accent-border)]'
                  : 'border-[var(--sift-border)] bg-white text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]'
              )}
            >
              <FolderTree className="h-3.5 w-3.5" />
              <span>Group</span>
              {grid.grouping.length > 0 && (
                <span className="rounded-full bg-[var(--sift-accent)] px-1.5 text-[10px] text-white">
                  {grid.grouping.length}
                </span>
              )}
            </button>

            {groupMenuOpen && (
              <SiftPopover anchor={groupAnchor} onDismiss={() => setGroupMenuOpen(false)}><div className="w-52 rounded-xl border border-[var(--sift-border)] bg-white p-1.5 shadow-xl dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--sift-muted)]">
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
                          ? 'bg-[var(--sift-accent-subtle)] font-semibold text-[var(--sift-accent-strong)] dark:bg-[var(--sift-accent-deep)] dark:text-[var(--sift-accent-border)]'
                          : 'text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]'
                      )}
                    >
                      <span>{col.columnDef.meta?.label ?? col.id}</span>
                      {active && (
                        <span className="font-mono text-[10px] text-[var(--sift-accent)]">
                          #{grid.grouping.indexOf(col.id) + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              </SiftPopover>
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
            onClick={(event) => { setViewsAnchor(event.currentTarget); setViewsOpen((v) => !v); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sift-border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]"
          >
            <Bookmark className="h-3.5 w-3.5 text-[var(--sift-muted)]" />
            <span>Views</span>
            {grid.savedViews.length > 0 && (
              <span className="text-[11px] text-[var(--sift-muted)]">
                ({grid.savedViews.length})
              </span>
            )}
          </button>

          {viewsOpen && (
            <SiftPopover anchor={viewsAnchor} placement="bottom-end" onDismiss={() => setViewsOpen(false)}><div className="w-64 rounded-xl border border-[var(--sift-border)] bg-white p-2 shadow-xl dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]">
              <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--sift-muted)]">
                Saved Views
              </div>
              {grid.savedViews.length === 0 ? (
                <p className="px-2 py-2 text-xs text-[var(--sift-muted)]">
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
                          ? 'bg-[var(--sift-accent-subtle)] font-semibold text-[var(--sift-accent-strong)] dark:bg-[var(--sift-accent-deep)] dark:text-[var(--sift-accent-border)]'
                          : 'hover:bg-[var(--sift-surface-subtle)] dark:hover:bg-[var(--sift-ink)]'
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
                        className="ml-2 text-[var(--sift-muted)] hover:text-rose-600"
                        aria-label={`Delete ${view.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form
                className="flex gap-1.5 border-t border-[var(--sift-surface-subtle)] pt-2 dark:border-[var(--sift-ink)]"
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
                  className="flex-1 rounded-md border border-[var(--sift-border)] px-2 py-1 text-xs focus:border-[var(--sift-accent)] focus:outline-none dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]"
                />
                <button
                  type="submit"
                  className="rounded-md bg-[var(--sift-accent)] px-2.5 py-1 text-xs font-medium text-white hover:bg-[var(--sift-accent)]"
                >
                  Save
                </button>
              </form>
            </div>
            </SiftPopover>
          )}
        </div>

        {/* Density Segmented Switch */}
        <div
          className="hidden items-center rounded-lg border border-[var(--sift-border)] bg-[var(--sift-surface-subtle)] p-0.5 md:inline-flex dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]"
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
                  ? 'bg-white text-[var(--sift-ink)] shadow-2xs dark:bg-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]'
                  : 'text-[var(--sift-muted)] hover:text-[var(--sift-ink)] dark:text-[var(--sift-muted)]'
              )}
            >
              {d.slice(0, 4)}
            </button>
          ))}
        </div>

        <button type="button" aria-pressed={showHeaderFilters} onClick={onToggleHeaderFilters}
          className="rounded-lg border border-[var(--sift-border)] px-2.5 py-1.5 text-xs text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:border-[var(--sift-ink)] dark:text-[var(--sift-border)]">
          Header filters
        </button>
        {/* Column Studio Button */}
        <button
          type="button"
          onClick={onOpenColumnManager}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sift-border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]"
        >
          <Columns3 className="h-3.5 w-3.5 text-[var(--sift-muted)]" />
          <span>Columns</span>
          <span className="rounded bg-[var(--sift-surface-subtle)] px-1.5 py-0.2 font-mono text-[10px] text-[var(--sift-muted)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-muted)]">
            {visibleCount}/{totalManageable}
          </span>
        </button>

        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--sift-muted)] dark:text-[var(--sift-border)]">
          <input type="checkbox" checked={exportSelectedOnly} onChange={(event) => setExportSelectedOnly(event.target.checked)} aria-label="Export selected rows only" />
          Selected only
        </label>
        {/* CSV Export */}
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exportSelectedOnly && grid.table.getSelectedRowModel().rows.length === 0}
          title={exportSelectedOnly ? "Export selected rows to CSV" : "Export filtered rows to CSV"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sift-border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]"
        >
          <Download className="h-3.5 w-3.5 text-[var(--sift-muted)]" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
    </div>
  );
}
