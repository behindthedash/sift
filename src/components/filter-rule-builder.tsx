import React from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { DataGridController } from '../store/use-data-grid';
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
  grid: DataGridController<TData>;
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
        'border-b border-slate-200 bg-slate-50/90 px-4 py-3.5',
        'dark:border-slate-800 dark:bg-slate-900/60'
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            Advanced Filter Rules
          </span>
          <span className="text-slate-400">·</span>
          <span>Match</span>
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-950">
            {(['AND', 'OR'] as FilterCombinator[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => grid.setCombinator(mode)}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-semibold transition-colors',
                  grid.filterGroup.combinator === mode
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
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
          className="rounded-md p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-800"
          aria-label="Close rule builder"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Rules List */}
      <div className="space-y-2">
        {grid.filterGroup.rules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/40">
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <Plus className="h-3.5 w-3.5 text-indigo-500" />
          Add condition
        </button>

        {grid.filterGroup.rules.length > 0 && (
          <button
            type="button"
            onClick={grid.clearAllFilters}
            className="text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400"
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
  grid: DataGridController<TData>;
  filterableColumns: ReturnType<DataGridController<TData>['table']['getAllLeafColumns']>;
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
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-2xs dark:border-slate-800 dark:bg-slate-950">
      {/* Prefix label */}
      <span className="w-12 shrink-0 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">
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
        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type={variant === 'date' ? 'date' : 'number'}
                value={Array.isArray(rule.value) ? String(rule.value[1] ?? '') : ''}
                onChange={(e) => {
                  const arr = Array.isArray(rule.value) ? [...rule.value] : ['', ''];
                  arr[1] = e.target.value;
                  grid.updateFilterRule(rule.id, { value: arr });
                }}
                placeholder="Max"
                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          ) : variant === 'boolean' ? (
            <select
              value={String(rule.value ?? 'true')}
              onChange={(e) =>
                grid.updateFilterRule(rule.id, { value: e.target.value === 'true' })
              }
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
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
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
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
                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
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
              className="w-full rounded-md border border-slate-200 px-2.5 py-1 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
            />
          )}
        </div>
      )}

      {/* Remove Rule */}
      <button
        type="button"
        onClick={() => grid.removeFilterRule(rule.id)}
        className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
        aria-label="Remove rule"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
