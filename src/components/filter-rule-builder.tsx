import React from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { SiftController } from '../store/use-data-grid';
import {
  OPERATORS_BY_VARIANT,
  getDefaultOperator,
  getOperatorMeta,
  type FilterCombinator,
  type FilterOperator,
  type FilterRule,
} from '../types/grid.types';
import { cn } from '../utils/cn';

interface FilterRuleBuilderProps<TData> {
  grid: SiftController<TData>;
  open: boolean;
  onClose: () => void;
}

/**
 * Notion-style multi-condition Advanced Filter Builder supporting AND/OR combinators,
 * full operator switching, and typed value inputs synced directly into the breadcrumb trail.
 */
export function FilterRuleBuilder<TData>({
  grid,
  open,
  onClose,
}: FilterRuleBuilderProps<TData>) {
  if (!open) return null;

  const filterableColumns = grid.table
    .getAllLeafColumns()
    .filter((col) => col.getCanFilter() && col.columnDef.meta?.label);

  const firstColId = filterableColumns[0]?.id;

  const handleAddRule = () => {
    if (!firstColId) return;
    grid.addFilterRule(firstColId);
  };

  return (
    <div
      className={cn(
        'border-b border-[var(--sift-border)] bg-[var(--sift-surface-subtle)]/90 px-4 py-3.5',
        'dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]/60'
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-[var(--sift-muted)] dark:text-[var(--sift-border)]">
          <span className="font-semibold text-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]">
            Advanced Filter Rules
          </span>
          <span className="text-[var(--sift-muted)]">·</span>
          <span>Match</span>
          <div className="inline-flex rounded-md border border-[var(--sift-border)] bg-white p-0.5 dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]">
            {(['AND', 'OR'] as FilterCombinator[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => grid.setCombinator(mode)}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-semibold transition-colors',
                  grid.filterGroup.combinator === mode
                    ? 'bg-[var(--sift-accent)] text-white shadow-sm'
                    : 'text-[var(--sift-muted)] hover:text-[var(--sift-ink)] dark:text-[var(--sift-muted)]'
                )}
              >
                {mode === 'AND' ? 'ALL (AND)' : 'ANY (OR)'}
              </button>
            ))}
          </div>
          <span>of the following rules:</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-[var(--sift-muted)] hover:bg-[var(--sift-border)]/60 hover:text-[var(--sift-ink)] dark:hover:bg-[var(--sift-ink)]"
          aria-label="Close rule builder"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Rules List */}
      <div className="space-y-2">
        {grid.filterGroup.rules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--sift-border)] bg-white/60 px-4 py-3 text-xs text-[var(--sift-muted)] dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]/40">
            No rules configured yet. Add a condition below to build multi-field AND/OR queries.
          </div>
        ) : (
          grid.filterGroup.rules.map((rule, index) => (
            <FilterRuleRow
              key={rule.id}
              rule={rule}
              index={index}
              combinator={grid.filterGroup.combinator}
              grid={grid}
              filterableColumns={filterableColumns}
            />
          ))
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handleAddRule}
          disabled={!firstColId}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sift-border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--sift-ink)] shadow-xs hover:bg-[var(--sift-surface-subtle)] disabled:opacity-50 dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-border)] dark:hover:bg-[var(--sift-ink)]"
        >
          <Plus className="h-3.5 w-3.5 text-[var(--sift-accent)]" />
          Add condition
        </button>

        {grid.filterGroup.rules.length > 0 && (
          <button
            type="button"
            onClick={grid.clearAllFilters}
            className="text-xs font-medium text-[var(--sift-muted)] hover:text-rose-600 dark:text-[var(--sift-muted)]"
          >
            Reset all rules
          </button>
        )}
      </div>
    </div>
  );
}

interface FilterRuleRowProps<TData> {
  rule: FilterRule;
  index: number;
  combinator: FilterCombinator;
  grid: SiftController<TData>;
  filterableColumns: ReturnType<SiftController<TData>['table']['getAllLeafColumns']>;
}

function FilterRuleRow<TData>({
  rule,
  index,
  combinator,
  grid,
  filterableColumns,
}: FilterRuleRowProps<TData>) {
  const column = grid.table.getColumn(rule.columnId);
  const variant = column?.columnDef.meta?.filterVariant ?? 'text';
  const operators = OPERATORS_BY_VARIANT[variant] ?? OPERATORS_BY_VARIANT.text;
  const opMeta = getOperatorMeta(variant, rule.operator);

  // Derive options for select / multi-select columns
  const selectOptions = React.useMemo(() => {
    if (!column) return [];
    const staticOpts = column.columnDef.meta?.filterOptions;
    if (staticOpts && staticOpts.length > 0) return staticOpts;
    const facetMap = column.getFacetedUniqueValues();
    const out: Array<{ label: string; value: string }> = [];
    facetMap?.forEach((_, key) => {
      if (key === null || key === undefined || key === '') return;
      out.push({ value: String(key), label: String(key) });
    });
    return out;
  }, [column]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--sift-border)] bg-white p-2 shadow-2xs dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]">
      {/* Prefix label */}
      <span className="w-12 shrink-0 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--sift-muted)]">
        {index === 0 ? 'Where' : combinator}
      </span>

      {/* Column Selector */}
      <select
        value={rule.columnId}
        onChange={(e) => {
          const nextColId = e.target.value;
          const nextCol = grid.table.getColumn(nextColId);
          const nextVariant = nextCol?.columnDef.meta?.filterVariant ?? 'text';
          grid.updateFilterRule(rule.id, {
            columnId: nextColId,
            operator: getDefaultOperator(nextVariant),
            value:
              nextVariant === 'select' || nextVariant === 'multi-select'
                ? []
                : '',
          });
        }}
        className="rounded-md border border-[var(--sift-border)] bg-[var(--sift-surface-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--sift-ink)] focus:border-[var(--sift-accent)] focus:outline-none dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]"
      >
        {filterableColumns.map((col) => (
          <option key={col.id} value={col.id}>
            {col.columnDef.meta?.label ?? col.id}
          </option>
        ))}
      </select>

      {/* Operator Selector */}
      <select
        value={rule.operator}
        onChange={(e) => {
          const nextOp = e.target.value as FilterOperator;
          grid.updateFilterRule(rule.id, {
            operator: nextOp,
            value:
              nextOp === 'between'
                ? ['', '']
                : nextOp === 'isAnyOf' || nextOp === 'isNoneOf'
                  ? Array.isArray(rule.value)
                    ? rule.value
                    : rule.value
                      ? [String(rule.value)]
                      : []
                  : Array.isArray(rule.value)
                    ? rule.value[0] ?? ''
                    : rule.value,
          });
        }}
        className="rounded-md border border-[var(--sift-border)] bg-white px-2 py-1.5 text-xs text-[var(--sift-ink)] focus:border-[var(--sift-accent)] focus:outline-none dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-border)]"
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Dynamic Value Input */}
      {opMeta.requiresValue && (
        <div className="min-w-[180px] flex-1">
          {rule.operator === 'between' ? (
            <div className="flex items-center gap-1.5">
              <input
                type={variant === 'date' ? 'date' : 'number'}
                value={Array.isArray(rule.value) ? String(rule.value[0] ?? '') : ''}
                onChange={(e) => {
                  const arr = Array.isArray(rule.value) ? [...rule.value] : ['', ''];
                  arr[0] = e.target.value;
                  grid.updateFilterRule(rule.id, { value: arr });
                }}
                placeholder="Min"
                className="w-full rounded-md border border-[var(--sift-border)] px-2 py-1 text-xs focus:border-[var(--sift-accent)] focus:outline-none dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]"
              />
              <span className="text-xs text-[var(--sift-muted)]">to</span>
              <input
                type={variant === 'date' ? 'date' : 'number'}
                value={Array.isArray(rule.value) ? String(rule.value[1] ?? '') : ''}
                onChange={(e) => {
                  const arr = Array.isArray(rule.value) ? [...rule.value] : ['', ''];
                  arr[1] = e.target.value;
                  grid.updateFilterRule(rule.id, { value: arr });
                }}
                placeholder="Max"
                className="w-full rounded-md border border-[var(--sift-border)] px-2 py-1 text-xs focus:border-[var(--sift-accent)] focus:outline-none dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]"
              />
            </div>
          ) : variant === 'boolean' ? (
            <select
              value={String(rule.value ?? 'true')}
              onChange={(e) =>
                grid.updateFilterRule(rule.id, { value: e.target.value === 'true' })
              }
              className="w-full rounded-md border border-[var(--sift-border)] px-2 py-1 text-xs focus:border-[var(--sift-accent)] focus:outline-none dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]"
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : (variant === 'select' || variant === 'multi-select') &&
            selectOptions.length > 0 ? (
            rule.operator === 'isAnyOf' || rule.operator === 'isNoneOf' ? (
              <div className="flex flex-wrap gap-1">
                {selectOptions.slice(0, 8).map((opt) => {
                  const current = Array.isArray(rule.value)
                    ? (rule.value as string[])
                    : [];
                  const active = current.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? current.filter((v) => v !== opt.value)
                          : [...current, opt.value];
                        grid.updateFilterRule(rule.id, { value: next });
                      }}
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
                        active
                          ? 'border-[var(--sift-accent)] bg-[var(--sift-accent-subtle)] text-[var(--sift-accent-strong)] dark:bg-[var(--sift-accent-deep)] dark:text-[var(--sift-accent-border)]'
                          : 'border-[var(--sift-border)] bg-white text-[var(--sift-muted)] hover:bg-[var(--sift-surface-subtle)] dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-border)]'
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <select
                value={String(rule.value ?? '')}
                onChange={(e) =>
                  grid.updateFilterRule(rule.id, { value: e.target.value })
                }
                className="w-full rounded-md border border-[var(--sift-border)] px-2 py-1 text-xs focus:border-[var(--sift-accent)] focus:outline-none dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]"
              >
                <option value="">Select value...</option>
                {selectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )
          ) : (
            <input
              type={
                variant === 'number'
                  ? 'number'
                  : variant === 'date'
                    ? 'date'
                    : 'text'
              }
              value={String(rule.value ?? '')}
              onChange={(e) =>
                grid.updateFilterRule(rule.id, { value: e.target.value })
              }
              placeholder={column?.columnDef.meta?.placeholder ?? 'Enter value...'}
              className="w-full rounded-md border border-[var(--sift-border)] px-2.5 py-1 text-xs focus:border-[var(--sift-accent)] focus:outline-none dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]"
            />
          )}
        </div>
      )}

      {/* Remove Rule */}
      <button
        type="button"
        onClick={() => grid.removeFilterRule(rule.id)}
        className="ml-auto rounded-md p-1.5 text-[var(--sift-muted)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
        aria-label="Remove rule"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
