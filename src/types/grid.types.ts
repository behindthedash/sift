import type { ComponentType, ReactNode } from 'react';
import type {
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  GroupingState,
  PaginationState,
  SortingState,
  ColumnVisibilityState,
} from '@tanstack/react-table';

export type FilterVariant =
  | 'text'
  | 'select'
  | 'multi-select'
  | 'number'
  | 'date'
  | 'boolean';

export type FilterOperator =
  | 'is'
  | 'isNot'
  | 'isAnyOf'
  | 'isNoneOf'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'before'
  | 'after'
  | 'isEmpty'
  | 'isNotEmpty';

export type FilterCombinator = 'AND' | 'OR';

export type GridDensity = 'compact' | 'comfortable' | 'spacious';

export interface FilterOption {
  label: string;
  value: string;
  icon?: ComponentType<{ className?: string }>;
  badgeColor?: string;
}

export interface FilterRule {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: unknown;
}

export interface FilterGroupState {
  combinator: FilterCombinator;
  rules: FilterRule[];
}

export interface DrilldownSegment {
  columnId: string;
  columnLabel: string;
  value: string;
}

export interface SiftColumnMeta {
  /** Allow inline editing when the Sift onCellEdit callback is configured. */
  editable?: boolean;
  /** Parse the text editor value into the desired column value. */
  parseEdit?: (input: string) => unknown;
  /** Validation error message, or null/undefined when valid. */
  validateEdit?: (value: unknown) => string | null | undefined;
  /** Optional pinned summary footer, computed over filtered rows. */
  summary?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  /** Human-readable name displayed in Filter Bar, Breadcrumbs, and Column Manager */
  label: string;
  /** Optional Lucide or custom icon shown alongside the column name */
  icon?: ComponentType<{ className?: string }>;
  /** Drives both Quick Command Filter and Advanced Rule Builder UI */
  filterVariant?: FilterVariant;
  /** Static select options. Omit to auto-derive live counts via TanStack V9 faceting */
  filterOptions?: FilterOption[];
  /** Hide by default so it starts in the "Available to Add" bucket in Column Manager */
  defaultHidden?: boolean;
  /** Prevent users from hiding this column (e.g. primary identifier) */
  lockedVisible?: boolean;
  /** Horizontal alignment of header and cells */
  align?: 'start' | 'center' | 'end';
  /** Format raw value for display in filter pills and breadcrumbs */
  formatValue?: (value: unknown) => string;
  /** Groupable in hierarchical breadcrumb mode */
  groupable?: boolean;
  /** Placeholder text for filter inputs */
  placeholder?: string;
}

export interface SavedGridView {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  createdAt: string;
  state: {
    globalFilter: string;
    filterGroup: FilterGroupState;
    sorting: SortingState;
    columnVisibility: ColumnVisibilityState;
    columnOrder: ColumnOrderState;
    columnPinning: ColumnPinningState;
    grouping: GroupingState;
    density: GridDensity;
  };
}

export interface BulkAction<TData> {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive';
  onAction: (selectedRows: TData[], clearSelection: () => void) => void | Promise<void>;
}

export interface ServerQueryPayload {
  search: string;
  combinator: FilterCombinator;
  filters: Array<{
    field: string;
    op: FilterOperator;
    value: unknown;
  }>;
  sort: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  page: number;
  pageSize: number;
  groupBy: string[];
}

export interface SiftUrlAdapter {
  read: () => string;
  write: (queryString: string) => void;
}

export interface SiftStateSnapshot {
  globalFilter: string;
  filterGroup: FilterGroupState;
  sorting: SortingState;
  columnVisibility: ColumnVisibilityState;
  columnOrder: ColumnOrderState;
  columnPinning: ColumnPinningState;
  columnSizing: ColumnSizingState;
  grouping: GroupingState;
  pagination: PaginationState;
  density: GridDensity;
}

export interface SiftEmptyStateConfig {
  title?: string;
  description?: string;
  filteredTitle?: string;
  filteredDescription?: string;
  action?: ReactNode;
}

export const OPERATORS_BY_VARIANT: Record<
  FilterVariant,
  Array<{ value: FilterOperator; label: string; shortLabel: string; requiresValue: boolean }>
> = {
  text: [
    { value: 'contains', label: 'contains', shortLabel: 'contains', requiresValue: true },
    { value: 'notContains', label: 'does not contain', shortLabel: '!contains', requiresValue: true },
    { value: 'is', label: 'is exactly', shortLabel: 'is', requiresValue: true },
    { value: 'isNot', label: 'is not', shortLabel: 'is not', requiresValue: true },
    { value: 'startsWith', label: 'starts with', shortLabel: 'starts with', requiresValue: true },
    { value: 'endsWith', label: 'ends with', shortLabel: 'ends with', requiresValue: true },
    { value: 'isEmpty', label: 'is empty', shortLabel: 'is empty', requiresValue: false },
    { value: 'isNotEmpty', label: 'is not empty', shortLabel: 'is set', requiresValue: false },
  ],
  select: [
    { value: 'is', label: 'is', shortLabel: 'is', requiresValue: true },
    { value: 'isNot', label: 'is not', shortLabel: 'is not', requiresValue: true },
    { value: 'isAnyOf', label: 'is any of', shortLabel: 'is any of', requiresValue: true },
    { value: 'isNoneOf', label: 'is none of', shortLabel: 'is none of', requiresValue: true },
    { value: 'isEmpty', label: 'is empty', shortLabel: 'is empty', requiresValue: false },
    { value: 'isNotEmpty', label: 'is not empty', shortLabel: 'is set', requiresValue: false },
  ],
  'multi-select': [
    { value: 'isAnyOf', label: 'is any of', shortLabel: 'is any of', requiresValue: true },
    { value: 'isNoneOf', label: 'is none of', shortLabel: 'is none of', requiresValue: true },
    { value: 'isEmpty', label: 'is empty', shortLabel: 'is empty', requiresValue: false },
    { value: 'isNotEmpty', label: 'is not empty', shortLabel: 'is set', requiresValue: false },
  ],
  number: [
    { value: 'is', label: 'equals', shortLabel: '=', requiresValue: true },
    { value: 'isNot', label: 'does not equal', shortLabel: '≠', requiresValue: true },
    { value: 'gt', label: 'greater than', shortLabel: '>', requiresValue: true },
    { value: 'gte', label: 'greater or equal', shortLabel: '≥', requiresValue: true },
    { value: 'lt', label: 'less than', shortLabel: '<', requiresValue: true },
    { value: 'lte', label: 'less or equal', shortLabel: '≤', requiresValue: true },
    { value: 'between', label: 'is between', shortLabel: 'between', requiresValue: true },
    { value: 'isEmpty', label: 'is empty', shortLabel: 'is empty', requiresValue: false },
    { value: 'isNotEmpty', label: 'is not empty', shortLabel: 'is set', requiresValue: false },
  ],
  date: [
    { value: 'is', label: 'is on', shortLabel: 'on', requiresValue: true },
    { value: 'before', label: 'is before', shortLabel: 'before', requiresValue: true },
    { value: 'after', label: 'is after', shortLabel: 'after', requiresValue: true },
    { value: 'between', label: 'is between', shortLabel: 'between', requiresValue: true },
    { value: 'isEmpty', label: 'is empty', shortLabel: 'is empty', requiresValue: false },
    { value: 'isNotEmpty', label: 'is not empty', shortLabel: 'is set', requiresValue: false },
  ],
  boolean: [
    { value: 'is', label: 'is', shortLabel: 'is', requiresValue: true },
  ],
};

export function getDefaultOperator(variant: FilterVariant = 'text'): FilterOperator {
  switch (variant) {
    case 'select':
    case 'multi-select':
      return 'isAnyOf';
    case 'number':
      return 'gte';
    case 'date':
      return 'after';
    case 'boolean':
      return 'is';
    default:
      return 'contains';
  }
}

export function getOperatorMeta(variant: FilterVariant, operator: FilterOperator) {
  const list = OPERATORS_BY_VARIANT[variant] ?? OPERATORS_BY_VARIANT.text;
  return (
    list.find((item) => item.value === operator) ?? {
      value: operator,
      label: operator,
      shortLabel: operator,
      requiresValue: operator !== 'isEmpty' && operator !== 'isNotEmpty',
    }
  );
}
