import type { RowData } from '@tanstack/react-table';
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
import type { SiftController } from '../store/use-data-grid';
import {
  OPERATORS_BY_VARIANT,
  getOperatorMeta,
  type FilterOperator,
  type FilterRule,
} from '../types/grid.types';
import { isRuleActive } from '../store/filter-engine';
import { cn } from '../utils/cn';
import { SiftPopover } from './sift-popover';

interface BreadcrumbTrailProps<TData extends RowData> {
  grid: SiftController<TData>;
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
export function BreadcrumbTrail<TData extends RowData>({
  grid,
  onOpenQuickFilter,
  onOpenRuleBuilder,
}: BreadcrumbTrailProps<TData>) {
  const [editingOpRuleId, setEditingOpRuleId] = useState<string | null>(null);
  const [operatorAnchor, setOperatorAnchor] = useState<HTMLElement | null>(null);

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
        'flex flex-wrap items-center gap-2 border-b border-[var(--sift-border)] bg-[var(--sift-surface-subtle)]/70 px-4 py-2 text-xs',
        'dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]/40'
      )}
    >
      {/* 1. Hierarchical Grouping Breadcrumb Trail */}
      {hasGrouping && (
        <nav
          aria-label="Grouping hierarchy trail"
          className="flex items-center gap-1 rounded-lg border border-[var(--sift-accent-border)]/80 bg-[var(--sift-accent-subtle)]/70 px-2 py-1 text-[var(--sift-accent-strong)] dark:border-[var(--sift-accent-strong)] dark:bg-[var(--sift-accent-deep)]/60 dark:text-[var(--sift-accent-border)]"
        >
          <FolderTree className="mr-1 h-3.5 w-3.5 text-[var(--sift-accent)]" />
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
                <ChevronRight className="h-3 w-3 text-[var(--sift-accent)]" />
                <button
                  type="button"
                  onClick={() => grid.setGrouping(grid.grouping.slice(0, idx + 1))}
                  className={cn(
                    'rounded px-1 py-0.5 transition-colors hover:bg-[var(--sift-accent-subtle)] dark:hover:bg-[var(--sift-accent-strong)]',
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
            className="ml-1 rounded p-0.5 text-[var(--sift-accent)] hover:bg-[var(--sift-accent-subtle)] hover:text-[var(--sift-accent-strong)] dark:hover:bg-[var(--sift-accent-strong)]"
            aria-label="Clear grouping"
          >
            <X className="h-3 w-3" />
          </button>
        </nav>
      )}

      {/* 2. Global Search Pill */}
      {hasSearch && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sift-border)] bg-white px-2 py-1 shadow-2xs dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]">
          <Search className="h-3 w-3 text-[var(--sift-muted)]" />
          <span className="text-[var(--sift-muted)]">Search:</span>
          <span className="font-medium text-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]">
            &ldquo;{grid.globalFilter}&rdquo;
          </span>
          <button
            type="button"
            onClick={() => grid.setGlobalFilter('')}
            className="rounded p-0.5 text-[var(--sift-muted)] hover:bg-[var(--sift-surface-subtle)] hover:text-[var(--sift-ink)] dark:hover:bg-[var(--sift-ink)]"
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
                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--sift-muted)] hover:bg-[var(--sift-border)]/70 hover:text-[var(--sift-accent)] dark:hover:bg-[var(--sift-ink)]"
              >
                {grid.filterGroup.combinator}
              </button>
            )}

            <div className="relative inline-flex items-center divide-x divide-slate-200 rounded-lg border border-[var(--sift-border)] bg-white shadow-2xs dark:divide-slate-800 dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]">
              {/* Field Segment */}
              <span className="inline-flex items-center gap-1.5 px-2 py-1 font-medium text-[var(--sift-ink)] dark:text-[var(--sift-border)]">
                <Icon className="h-3 w-3 text-[var(--sift-muted)]" />
                {meta?.label ?? rule.columnId}
              </span>

              {/* Inline Operator Switcher Segment */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(event) => { setOperatorAnchor(event.currentTarget); setEditingOpRuleId(editingOpRuleId === rule.id ? null : rule.id); }}
                  className="px-2 py-1 text-[var(--sift-muted)] hover:bg-[var(--sift-surface-subtle)] hover:text-[var(--sift-accent)] dark:text-[var(--sift-muted)] dark:hover:bg-[var(--sift-ink)]"
                  title="Click to switch filter operator"
                >
                  {opMeta.shortLabel}
                </button>

                {editingOpRuleId === rule.id && (
                  <SiftPopover anchor={operatorAnchor} onDismiss={() => setEditingOpRuleId(null)}><div className="w-40 rounded-lg border border-[var(--sift-border)] bg-white p-1 shadow-lg dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]">
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
                            ? 'bg-[var(--sift-accent-subtle)] font-semibold text-[var(--sift-accent-strong)] dark:bg-[var(--sift-accent-deep)] dark:text-[var(--sift-accent-border)]'
                            : 'text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]'
                        )}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div></SiftPopover>
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
                  className="max-w-[200px] truncate px-2 py-1 font-semibold text-[var(--sift-ink)] hover:bg-[var(--sift-surface-subtle)] dark:text-[var(--sift-surface-subtle)] dark:hover:bg-[var(--sift-ink)]"
                  title="Click to edit filter value"
                >
                  {displayValue}
                </button>
              )}

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => grid.removeFilterRule(rule.id)}
                className="px-1.5 py-1 text-[var(--sift-muted)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60"
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
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[var(--sift-border)] px-2 py-1 text-[var(--sift-muted)] hover:border-[var(--sift-accent)] hover:text-[var(--sift-accent)] dark:border-[var(--sift-ink)] dark:text-[var(--sift-muted)]"
      >
        <Plus className="h-3 w-3" />
        Filter
      </button>

      {(activeRules.length > 0 || hasSearch) && (
        <button
          type="button"
          onClick={grid.clearAllFilters}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-[var(--sift-muted)] hover:bg-[var(--sift-border)]/70 hover:text-[var(--sift-ink)] dark:text-[var(--sift-muted)] dark:hover:bg-[var(--sift-ink)] dark:hover:text-[var(--sift-surface-subtle)]"
        >
          <RotateCcw className="h-3 w-3" />
          Clear all
        </button>
      )}
    </div>
  );
}
