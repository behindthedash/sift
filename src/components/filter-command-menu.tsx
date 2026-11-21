import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  Filter,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { DataGridController } from '../store/use-data-grid';
import type { FilterOption, FilterVariant } from '../types/grid.types';
import { cn } from '../utils/cn';

interface FilterCommandMenuProps<TData> {
  grid: DataGridController<TData>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional column to jump directly into when triggered from a column header */
  initialColumnId?: string | null;
}

export function FilterCommandMenu<TData>({
  grid,
  open,
  onOpenChange,
  initialColumnId = null,
}: FilterCommandMenuProps<TData>) {
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(initialColumnId);
  const [query, setQuery] = useState('');
  const [minVal, setMinVal] = useState('');
  const [maxVal, setMaxVal] = useState('');
  const [textDraft, setTextDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedColumnId(initialColumnId);
      setQuery('');
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

  const activeColumn = selectedColumnId
    ? grid.table.getColumn(selectedColumnId)
    : undefined;

  const variant: FilterVariant = activeColumn?.columnDef.meta?.filterVariant ?? 'text';

  // Live faceted counts from TanStack Table V9 (auto-narrowed by other active filters!)
  const facetedEntries = useMemo(() => {
    if (!activeColumn) return [];
    const facetMap = activeColumn.getFacetedUniqueValues();
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
  }, [activeColumn]);

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
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Quick filter command menu"
      className={cn(
        'absolute left-0 top-full z-50 mt-1.5 w-80 overflow-hidden rounded-xl',
        'border border-slate-200 bg-white shadow-xl ring-1 ring-black/5',
        'dark:border-slate-800 dark:bg-slate-950'
      )}
    >
      {/* Header / Search Bar */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
        {activeColumn ? (
          <button
            type="button"
            onClick={() => {
              setSelectedColumnId(null);
              setQuery('');
              setTimeout(() => inputRef.current?.focus(), 10);
            }}
            className="rounded px-1.5 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            ← Back
          </button>
        ) : (
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
        )}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            activeColumn
              ? `Filter ${activeColumn.columnDef.meta?.label}...`
              : 'Filter by column...'
          }
          className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
        />

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          aria-label="Close filter menu"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Step 1: Pick a Column */}
      {!activeColumn && (
        <div className="max-h-72 overflow-y-auto p-1.5">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Filterable Fields
          </div>
          {filteredColumns.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-500">
              No matching columns found.
            </div>
          ) : (
            filteredColumns.map((col) => {
              const Icon = col.columnDef.meta?.icon ?? Filter;
              const isActive = grid.filterGroup.rules.some(
                (r) => r.columnId === col.id
              );
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => {
                    setSelectedColumnId(col.id);
                    setQuery('');
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    'hover:bg-slate-100 dark:hover:bg-slate-900'
                  )}
                >
                  <span className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200">
                    <Icon className="h-4 w-4 text-slate-400" />
                    <span className="font-medium">
                      {col.columnDef.meta?.label ?? col.id}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {isActive && (
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
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
                          ? 'bg-indigo-50 text-indigo-950 dark:bg-indigo-950/60 dark:text-indigo-100'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900'
                      )}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                            checked
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 dark:border-slate-700'
                          )}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        {OptIcon && <OptIcon className="h-3.5 w-3.5 text-slate-400" />}
                        <span className="truncate">{opt.label}</span>
                      </span>
                      <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
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
                        ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900'
                    )}
                  >
                    <span>{opt.label}</span>
                    {active && <Check className="h-4 w-4 text-indigo-600" />}
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
              <label className="block text-xs font-medium text-slate-500">
                Contains text
              </label>
              <input
                type="text"
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder={
                  activeColumn.columnDef.meta?.placeholder ?? 'Type value...'
                }
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    grid.upsertColumnRule(activeColumn.id, 'contains', '');
                    onOpenChange(false);
                  }}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
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
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium">Range ({variant})</span>
                {facetedMinMax && (
                  <span className="font-mono text-[11px] text-slate-400">
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
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                />
                <input
                  type={variant === 'date' ? 'date' : 'number'}
                  value={maxVal}
                  onChange={(e) => setMaxVal(e.target.value)}
                  placeholder={
                    facetedMinMax ? `Max (${facetedMinMax[1]})` : 'Max'
                  }
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    grid.upsertColumnRule(activeColumn.id, 'between', []);
                    onOpenChange(false);
                  }}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  Apply Range
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Footer Hint */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-3 py-1.5 text-[11px] text-slate-400 dark:border-slate-800 dark:bg-slate-900/50">
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-indigo-500" />
          Live faceted counts
        </span>
        <span>ESC to close</span>
      </div>
    </div>
  );
}
