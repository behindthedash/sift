import React, { useState } from 'react';
import {
  ChevronRight,
  FolderTree,
  Layers,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type { DataGridController } from '../store/use-data-grid';
import {
  OPERATORS_BY_VARIANT,
  getOperatorMeta,
  type FilterOperator,
  type FilterRule,
} from '../types/grid.types';
import { isRuleActive } from '../store/filter-engine';
import { cn } from '../utils/cn';

interface BreadcrumbTrailProps<TData> {
  grid: DataGridController<TData>;
  onOpenQuickFilter: (columnId?: string) => void;
  onOpenRuleBuilder: () => void;
}

/**
 * Interactive Breadcrumb & Active Filter Pill Strip:
 * 1. Renders hierarchical grouping drill-down trails (All Records > Region > Plan)
 *    with click-to-pop breadcrumb navigation.
 * 2. Renders Linear/Notion compound filter pills where clicking the operator switches
 *    logic inline and clicking the value opens that column's faceted editor.
 */
export function BreadcrumbTrail<TData>({
  grid,
  onOpenQuickFilter,
  onOpenRuleBuilder,
}: BreadcrumbTrailProps<TData>) {
  const [editingOpRuleId, setEditingOpRuleId] = useState<string | null>(null);

  const activeRules = grid.filterGroup.rules.filter(isRuleActive);
  const hasSearch = grid.globalFilter.trim().length > 0;
  const hasGrouping = grid.grouping.length > 0;
  const hasAnything = activeRules.length > 0 || hasSearch || hasGrouping;

  if (!hasAnything) return null;

  const formatRuleValue = (rule: FilterRule): string => {
    const column = grid.table.getColumn(rule.columnId);
    const meta = column?.columnDef.meta;

    if (rule.operator === 'isEmpty' || rule.operator === 'isNotEmpty') {
      return '';
    }

    if (rule.operator === 'between' && Array.isArray(rule.value)) {
      const [a, b] = rule.value;
      if (a && b) return `${a} → ${b}`;
      if (a) return `≥ ${a}`;
      if (b) return `≤ ${b}`;
      return '';
    }

    if (Array.isArray(rule.value)) {
      const labels = rule.value.map((v) => {
        const match = meta?.filterOptions?.find((o) => o.value === String(v));
        if (match) return match.label;
        return meta?.formatValue ? meta.formatValue(v) : String(v);
      });
      if (labels.length <= 2) return labels.join(', ');
      return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
    }

    if (meta?.formatValue) return meta.formatValue(rule.value);
    return String(rule.value ?? '');
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-xs',
        'dark:border-slate-800 dark:bg-slate-900/40'
      )}
    >
      {/* 1. Hierarchical Grouping Breadcrumb Trail */}
      {hasGrouping && (
        <nav
          aria-label="Grouping hierarchy trail"
          className="flex items-center gap-1 rounded-lg border border-indigo-200/80 bg-indigo-50/70 px-2 py-1 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200"
        >
          <FolderTree className="mr-1 h-3.5 w-3.5 text-indigo-500" />
          <button
            type="button"
            onClick={() => grid.setGrouping([])}
            className="font-medium hover:underline"
          >
            All Records
          </button>

          {grid.grouping.map((colId, idx) => {
            const col = grid.table.getColumn(colId);
            const label = col?.columnDef.meta?.label ?? colId;
            return (
              <React.Fragment key={colId}>
                <ChevronRight className="h-3 w-3 text-indigo-400" />
                <button
                  type="button"
                  onClick={() => grid.setGrouping(grid.grouping.slice(0, idx + 1))}
                  className={cn(
                    'rounded px-1 py-0.5 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900',
                    idx === grid.grouping.length - 1 && 'font-semibold'
                  )}
                  title="Click to trim grouping hierarchy to this level"
                >
                  {label}
                </button>
              </React.Fragment>
            );
          })}

          <button
            type="button"
            onClick={() => grid.setGrouping([])}
            className="ml-1 rounded p-0.5 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900"
            aria-label="Clear grouping"
          >
            <X className="h-3 w-3" />
          </button>
        </nav>
      )}

      {/* 2. Global Search Pill */}
      {hasSearch && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-2xs dark:border-slate-700 dark:bg-slate-950">
          <Search className="h-3 w-3 text-slate-400" />
          <span className="text-slate-500">Search:</span>
          <span className="font-medium text-slate-800 dark:text-slate-100">
            &ldquo;{grid.globalFilter}&rdquo;
          </span>
          <button
            type="button"
            onClick={() => grid.setGlobalFilter('')}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      )}

      {/* 3. Active Compound Filter Pills */}
      {activeRules.map((rule, idx) => {
        const column = grid.table.getColumn(rule.columnId);
        const meta = column?.columnDef.meta;
        const variant = meta?.filterVariant ?? 'text';
        const Icon = meta?.icon ?? Layers;
        const opMeta = getOperatorMeta(variant, rule.operator);
        const displayValue = formatRuleValue(rule);
        const operators = OPERATORS_BY_VARIANT[variant] ?? OPERATORS_BY_VARIANT.text;

        return (
          <React.Fragment key={rule.id}>
            {idx > 0 && (
              <button
                type="button"
                onClick={() =>
                  grid.setCombinator(
                    grid.filterGroup.combinator === 'AND' ? 'OR' : 'AND'
                  )
                }
                title="Click to toggle AND / OR logic"
                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:bg-slate-200/70 hover:text-indigo-600 dark:hover:bg-slate-800"
              >
                {grid.filterGroup.combinator}
              </button>
            )}

            <div className="relative inline-flex items-center divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white shadow-2xs dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-950">
              {/* Field Segment */}
              <span className="inline-flex items-center gap-1.5 px-2 py-1 font-medium text-slate-700 dark:text-slate-200">
                <Icon className="h-3 w-3 text-slate-400" />
                {meta?.label ?? rule.columnId}
              </span>

              {/* Inline Operator Switcher Segment */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setEditingOpRuleId(editingOpRuleId === rule.id ? null : rule.id)
                  }
                  className="px-2 py-1 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-900"
                  title="Click to switch filter operator"
                >
                  {opMeta.shortLabel}
                </button>

                {editingOpRuleId === rule.id && (
                  <div className="absolute left-0 top-full z-40 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-950">
                    {operators.map((op) => (
                      <button
                        key={op.value}
                        type="button"
                        onClick={() => {
                          grid.updateFilterRule(rule.id, {
                            operator: op.value as FilterOperator,
                          });
                          setEditingOpRuleId(null);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs',
                          rule.operator === op.value
                            ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900'
                        )}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Value Segment (Click to edit in Quick Filter or Rule Builder) */}
              {displayValue && (
                <button
                  type="button"
                  onClick={() =>
                    variant === 'select' || variant === 'multi-select'
                      ? onOpenQuickFilter(rule.columnId)
                      : onOpenRuleBuilder()
                  }
                  className="max-w-[200px] truncate px-2 py-1 font-semibold text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-900"
                  title="Click to edit filter value"
                >
                  {displayValue}
                </button>
              )}

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => grid.removeFilterRule(rule.id)}
                className="px-1.5 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60"
                aria-label={`Remove ${meta?.label ?? rule.columnId} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </React.Fragment>
        );
      })}

      {/* Quick "+ Add" & Reset Controls */}
      <button
        type="button"
        onClick={() => onOpenQuickFilter()}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-1 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400"
      >
        <Plus className="h-3 w-3" />
        Filter
      </button>

      {(activeRules.length > 0 || hasSearch) && (
        <button
          type="button"
          onClick={grid.clearAllFilters}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <RotateCcw className="h-3 w-3" />
          Clear all
        </button>
      )}
    </div>
  );
}
