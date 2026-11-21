import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  Filter,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { SiftController } from '../store/use-data-grid';
import type { FilterOption, FilterVariant } from '../types/grid.types';
import { cn } from '../utils/cn';
import { SiftPopover } from './sift-popover';

interface FilterCommandMenuProps<TData> {
  grid: SiftController<TData>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional column to jump directly into when triggered from a column header */
  initialColumnId?: string | null;
  anchor?: HTMLElement | null;
}

export function FilterCommandMenu<TData>({
  grid,
  open,
  onOpenChange,
  initialColumnId = null,
  anchor = null,
}: FilterCommandMenuProps<TData>) {
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(initialColumnId);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [minVal, setMinVal] = useState('');
  const [maxVal, setMaxVal] = useState('');
  const [textDraft, setTextDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedColumnId(initialColumnId);
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open, initialColumnId]);

  // Close on Escape or outside click
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedColumnId && !initialColumnId) {
          setSelectedColumnId(null);
          setQuery('');
        } else {
          onOpenChange(false);
        }
      }
    };
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [open, selectedColumnId, initialColumnId, onOpenChange]);

  const filterableColumns = useMemo(() => {
    return grid.table
      .getAllLeafColumns()
      .filter((col) => col.getCanFilter() && col.columnDef.meta?.label);
  }, [grid.table]);

  const filteredColumns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filterableColumns;
    return filterableColumns.filter((col) =>
      (col.columnDef.meta?.label ?? col.id).toLowerCase().includes(q)
    );
  }, [filterableColumns, query]);

  useEffect(() => { setActiveIndex(0); }, [query, selectedColumnId]);

  const activeColumn = selectedColumnId
    ? grid.table.getColumn(selectedColumnId)
    : undefined;

  const variant: FilterVariant = activeColumn?.columnDef.meta?.filterVariant ?? 'text';

  // Live faceted counts from TanStack Table V9 (auto-narrowed by other active filters!)
  const facetedEntries = useMemo(() => {
    if (!activeColumn) return [];
    const facetMap = grid.manualMode ? new Map(Object.entries(grid.facetCounts?.[activeColumn.id] ?? {})) : activeColumn.getFacetedUniqueValues();
    const staticOptions = activeColumn.columnDef.meta?.filterOptions;

    if (staticOptions && staticOptions.length > 0) {
      return staticOptions.map((opt) => ({
        ...opt,
        count: facetMap?.get(opt.value) ?? 0,
      }));
    }

    const derived: Array<FilterOption & { count: number }> = [];
    facetMap?.forEach((count, rawKey) => {
      if (rawKey === null || rawKey === undefined || rawKey === '') return;
      const val = String(rawKey);
      derived.push({
        value: val,
        label: activeColumn.columnDef.meta?.formatValue
          ? activeColumn.columnDef.meta.formatValue(rawKey)
          : val,
        count,
      });
    });

    return derived.sort((a, b) => b.count - a.count);
  }, [activeColumn, grid.manualMode, grid.facetCounts]);

  const existingRule = useMemo(
    () =>
      selectedColumnId
        ? grid.filterGroup.rules.find((r) => r.columnId === selectedColumnId)
        : undefined,
    [grid.filterGroup.rules, selectedColumnId]
  );

  // Sync draft state when entering a column editor
  useEffect(() => {
    if (!selectedColumnId) return;
    if (variant === 'text') {
      setTextDraft(typeof existingRule?.value === 'string' ? existingRule.value : '');
    } else if (variant === 'number' || variant === 'date') {
      if (Array.isArray(existingRule?.value)) {
        setMinVal(String(existingRule.value[0] ?? ''));
        setMaxVal(String(existingRule.value[1] ?? ''));
      } else {
        setMinVal('');
        setMaxVal('');
      }
    }
  }, [selectedColumnId, variant, existingRule]);

  if (!open) return null;

  const selectedValues = Array.isArray(existingRule?.value)
    ? (existingRule?.value as string[])
    : existingRule?.value
      ? [String(existingRule.value)]
      : [];

  const toggleFacetOption = (value: string) => {
    if (!selectedColumnId) return;
    const exists = selectedValues.includes(value);
    const next = exists
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    grid.upsertColumnRule(selectedColumnId, 'isAnyOf', next);
  };

  const facetedMinMax =
    variant === 'number' ? activeColumn?.getFacetedMinMaxValues() : undefined;

  return (
    <SiftPopover anchor={anchor} onDismiss={() => onOpenChange(false)}>
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Quick filter command menu"
      className={cn(
        'w-80 overflow-hidden rounded-xl',
        'border border-[var(--sift-border)] bg-white shadow-xl ring-1 ring-black/5',
        'dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]'
      )}
    >
      {/* Header / Search Bar */}
      <div className="flex items-center gap-2 border-b border-[var(--sift-surface-subtle)] px-3 py-2.5 dark:border-[var(--sift-ink)]">
        {activeColumn ? (
          <button
            type="button"
            onClick={() => {
              setSelectedColumnId(null);
              setQuery('');
              setTimeout(() => inputRef.current?.focus(), 10);
            }}
            className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--sift-muted)] hover:bg-[var(--sift-surface-subtle)] hover:text-[var(--sift-ink)] dark:hover:bg-[var(--sift-ink)] dark:hover:text-[var(--sift-surface-subtle)]"
          >
            ← Back
          </button>
        ) : (
          <Search className="h-4 w-4 shrink-0 text-[var(--sift-muted)]" />
        )}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          role="combobox"
          aria-expanded="true"
          aria-controls="sift-command-options"
          aria-activedescendant={!activeColumn ? `sift-command-item-${activeIndex}` : undefined}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const available = activeColumn ? 0 : filteredColumns.length;
              if (available) setActiveIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + available) % available);
            } else if (event.key === 'Enter' && !activeColumn && filteredColumns[activeIndex]) {
              event.preventDefault();
              setSelectedColumnId(filteredColumns[activeIndex].id);
              setQuery('');
            }
          }}
          placeholder={
            activeColumn
              ? `Filter ${activeColumn.columnDef.meta?.label}...`
              : 'Filter by column...'
          }
          className="w-full bg-transparent text-sm text-[var(--sift-ink)] placeholder:text-[var(--sift-muted)] focus:outline-none dark:text-[var(--sift-surface-subtle)]"
        />

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded p-0.5 text-[var(--sift-muted)] hover:bg-[var(--sift-surface-subtle)] hover:text-[var(--sift-muted)] dark:hover:bg-[var(--sift-ink)]"
          aria-label="Close filter menu"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Step 1: Pick a Column */}
      {!activeColumn && (
        <div id="sift-command-options" role="listbox" className="max-h-72 overflow-y-auto p-1.5">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--sift-muted)]">
            Filterable Fields
          </div>
          {filteredColumns.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-[var(--sift-muted)]">
              No matching columns found.
            </div>
          ) : (
            filteredColumns.map((col, index) => {
              const Icon = col.columnDef.meta?.icon ?? Filter;
              const isActive = grid.filterGroup.rules.some(
                (r) => r.columnId === col.id
              );
              return (
                <button
                  key={col.id}
                  id={`sift-command-item-${index}`}
                  role="option"
                  aria-selected={activeIndex === index}
                  type="button"
                  onClick={() => {
                    setSelectedColumnId(col.id);
                    setQuery('');
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    'hover:bg-[var(--sift-surface-subtle)] dark:hover:bg-[var(--sift-ink)]',
                    index === activeIndex && 'bg-[var(--sift-accent-subtle)] dark:bg-[var(--sift-accent-deep)]'
                  )}
                >
                  <span className="flex items-center gap-2.5 text-[var(--sift-ink)] dark:text-[var(--sift-border)]">
                    <Icon className="h-4 w-4 text-[var(--sift-muted)]" />
                    <span className="font-medium">
                      {col.columnDef.meta?.label ?? col.id}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {isActive && (
                      <span className="h-2 w-2 rounded-full bg-[var(--sift-accent)]" />
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--sift-muted)]" />
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Step 2: Column-Specific Value Picker */}
      {activeColumn && (
        <div className="p-2">
          {(variant === 'select' || variant === 'multi-select') && (
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {facetedEntries
                .filter((opt) =>
                  opt.label.toLowerCase().includes(query.trim().toLowerCase())
                )
                .map((opt) => {
                  const checked = selectedValues.includes(opt.value);
                  const OptIcon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleFacetOption(opt.value)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                        checked
                          ? 'bg-[var(--sift-accent-subtle)] text-[var(--sift-accent-deep)] dark:bg-[var(--sift-accent-deep)]/60 dark:text-[var(--sift-accent-subtle)]'
                          : 'text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]'
                      )}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                            checked
                              ? 'border-[var(--sift-accent)] bg-[var(--sift-accent)] text-white'
                              : 'border-[var(--sift-border)] dark:border-[var(--sift-ink)]'
                          )}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        {OptIcon && <OptIcon className="h-3.5 w-3.5 text-[var(--sift-muted)]" />}
                        <span className="truncate">{opt.label}</span>
                      </span>
                      <span className="ml-2 rounded-full bg-[var(--sift-surface-subtle)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--sift-muted)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-muted)]">
                        {opt.count}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}

          {variant === 'boolean' && (
            <div className="space-y-1 p-1">
              {[
                { label: 'True / Yes', value: true },
                { label: 'False / No', value: false },
              ].map((opt) => {
                const active = existingRule?.value === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => {
                      grid.upsertColumnRule(activeColumn.id, 'is', opt.value);
                      onOpenChange(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm',
                      active
                        ? 'bg-[var(--sift-accent-subtle)] font-medium text-[var(--sift-accent-strong)] dark:bg-[var(--sift-accent-deep)] dark:text-[var(--sift-accent-border)]'
                        : 'text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]'
                    )}
                  >
                    <span>{opt.label}</span>
                    {active && <Check className="h-4 w-4 text-[var(--sift-accent)]" />}
                  </button>
                );
              })}
            </div>
          )}

          {variant === 'text' && (
            <form
              className="space-y-2.5 p-1"
              onSubmit={(e) => {
                e.preventDefault();
                grid.upsertColumnRule(activeColumn.id, 'contains', textDraft);
                onOpenChange(false);
              }}
            >
              <label className="block text-xs font-medium text-[var(--sift-muted)]">
                Contains text
              </label>
              <input
                type="text"
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder={
                  activeColumn.columnDef.meta?.placeholder ?? 'Type value...'
                }
                className="w-full rounded-lg border border-[var(--sift-border)] px-2.5 py-1.5 text-sm focus:border-[var(--sift-accent)] focus:outline-none dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    grid.upsertColumnRule(activeColumn.id, 'contains', '');
                    onOpenChange(false);
                  }}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-[var(--sift-muted)] hover:bg-[var(--sift-surface-subtle)] dark:hover:bg-[var(--sift-ink)]"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[var(--sift-accent)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--sift-accent)]"
                >
                  Apply Filter
                </button>
              </div>
            </form>
          )}

          {(variant === 'number' || variant === 'date') && (
            <form
              className="space-y-2.5 p-1"
              onSubmit={(e) => {
                e.preventDefault();
                grid.upsertColumnRule(activeColumn.id, 'between', [minVal, maxVal]);
                onOpenChange(false);
              }}
            >
              <div className="flex items-center justify-between text-xs text-[var(--sift-muted)]">
                <span className="font-medium">Range ({variant})</span>
                {facetedMinMax && (
                  <span className="font-mono text-[11px] text-[var(--sift-muted)]">
                    {facetedMinMax[0]} – {facetedMinMax[1]}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type={variant === 'date' ? 'date' : 'number'}
                  value={minVal}
                  onChange={(e) => setMinVal(e.target.value)}
                  placeholder={
                    facetedMinMax ? `Min (${facetedMinMax[0]})` : 'Min'
                  }
                  className="w-full rounded-lg border border-[var(--sift-border)] px-2 py-1.5 text-xs focus:border-[var(--sift-accent)] focus:outline-none dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]"
                />
                <input
                  type={variant === 'date' ? 'date' : 'number'}
                  value={maxVal}
                  onChange={(e) => setMaxVal(e.target.value)}
                  placeholder={
                    facetedMinMax ? `Max (${facetedMinMax[1]})` : 'Max'
                  }
                  className="w-full rounded-lg border border-[var(--sift-border)] px-2 py-1.5 text-xs focus:border-[var(--sift-accent)] focus:outline-none dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    grid.upsertColumnRule(activeColumn.id, 'between', []);
                    onOpenChange(false);
                  }}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-[var(--sift-muted)] hover:bg-[var(--sift-surface-subtle)] dark:hover:bg-[var(--sift-ink)]"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[var(--sift-accent)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--sift-accent)]"
                >
                  Apply Range
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Footer Hint */}
      <div className="flex items-center justify-between border-t border-[var(--sift-surface-subtle)] bg-[var(--sift-surface-subtle)]/80 px-3 py-1.5 text-[11px] text-[var(--sift-muted)] dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]/50">
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-[var(--sift-accent)]" />
          Live faceted counts
        </span>
        <span>ESC to close</span>
      </div>
    </div>
    </SiftPopover>
  );
}
