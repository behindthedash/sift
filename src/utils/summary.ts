import type { Row, RowData } from '@tanstack/react-table';
import type { SiftFeatures } from '../features/grid-features';
import type { SiftColumnMeta } from '../types/grid.types';

export function summarizeColumn<TData extends RowData>(rows: Row<SiftFeatures, TData>[], id: string, kind: NonNullable<SiftColumnMeta['summary']>): string {
  const data = rows.filter((row) => !row.getIsGrouped()).map((row) => row.getValue(id)).filter((v) => v !== null && v !== undefined && v !== '');
  if (kind === 'count') return String(data.length);
  const numeric = data.map(Number).filter(Number.isFinite);
  if (!numeric.length) return '—';
  const result = kind === 'sum' ? numeric.reduce((a, b) => a + b, 0)
    : kind === 'avg' ? numeric.reduce((a, b) => a + b, 0) / numeric.length
    : kind === 'min' ? Math.min(...numeric) : Math.max(...numeric);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(result);
}
