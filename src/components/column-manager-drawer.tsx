import type { RowData } from '@tanstack/react-table';
import React, { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  PanelLeft,
  PanelRight,
  PinOff,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type { SiftController } from '../store/use-data-grid';
import { cn } from '../utils/cn';

interface ColumnManagerDrawerProps<TData extends RowData> {
  grid: SiftController<TData>;
  open: boolean;
  onClose: () => void;
}

/**
 * Column Studio Drawer:
 * Replicates and upgrades AG Grid's Columns Tool Panel with instant search,
 * Visible vs. Available buckets, @dnd-kit drag-and-drop column reordering,
 * and TanStack Table V9 logical 'start' / 'end' sticky pinning controls.
 */
export function ColumnManagerDrawer<TData extends RowData>({
  grid,
  open,
  onClose,
}: ColumnManagerDrawerProps<TData>) {
  const [search, setSearch] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const manageableColumns = useMemo(() => {
    const all = grid.table
      .getAllLeafColumns()
      .filter((col) => col.id !== '__select__' && col.columnDef.meta?.label);

    // Respect current columnOrder sequence
    const order = grid.columnOrder;
    return [...all].sort((a, b) => {
      const idxA = order.indexOf(a.id);
      const idxB = order.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [grid.table, grid.columnOrder]);

  const filteredColumns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return manageableColumns;
    return manageableColumns.filter((col) =>
      (col.columnDef.meta?.label ?? col.id).toLowerCase().includes(q)
    );
  }, [manageableColumns, search]);

  const visibleColumns = filteredColumns.filter((c) => c.getIsVisible());
  const hiddenColumns = filteredColumns.filter((c) => !c.getIsVisible());

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentIds = grid.table.getAllLeafColumns().map((c) => c.id);
    const baseOrder = grid.columnOrder.length > 0 ? grid.columnOrder : currentIds;
    const oldIndex = baseOrder.indexOf(String(active.id));
    const newIndex = baseOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    grid.setColumnOrder(arrayMove(baseOrder, oldIndex, newIndex));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[var(--sift-ink)]/25 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <aside
        role="dialog"
        aria-label="Column Manager"
        className={cn(
          'relative z-10 flex h-full w-full max-w-sm flex-col border-l border-[var(--sift-border)] bg-white shadow-2xl',
          'dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--sift-border)] px-5 py-4 dark:border-[var(--sift-ink)]">
          <div>
            <h2 className="text-sm font-semibold text-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]">
              Column Studio
            </h2>
            <p className="text-xs text-[var(--sift-muted)]">
              Toggle, drag to reorder, or pin columns to start/end.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--sift-muted)] hover:bg-[var(--sift-surface-subtle)] hover:text-[var(--sift-ink)] dark:hover:bg-[var(--sift-ink)]"
            aria-label="Close Column Studio"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search & Quick Toggles */}
        <div className="space-y-2.5 border-b border-[var(--sift-surface-subtle)] px-5 py-3 dark:border-[var(--sift-ink)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--sift-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search columns..."
              className="w-full rounded-lg border border-[var(--sift-border)] bg-[var(--sift-surface-subtle)] py-1.5 pl-8 pr-3 text-xs text-[var(--sift-ink)] focus:border-[var(--sift-accent)] focus:bg-white focus:outline-none dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]"
            />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => grid.table.toggleAllColumnsVisible(true)}
                className="font-medium text-[var(--sift-accent)] hover:underline dark:text-[var(--sift-accent)]"
              >
                Show all
              </button>
              <span className="text-[var(--sift-border)]">·</span>
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  for (const col of manageableColumns) {
                    if (!col.columnDef.meta?.lockedVisible) {
                      next[col.id] = false;
                    }
                  }
                  grid.setColumnVisibility(next);
                }}
                className="font-medium text-[var(--sift-muted)] hover:text-[var(--sift-ink)] dark:hover:text-[var(--sift-border)]"
              >
                Hide optional
              </button>
            </div>
            <button
              type="button"
              onClick={grid.resetColumnLayout}
              className="inline-flex items-center gap-1 font-medium text-[var(--sift-muted)] hover:text-[var(--sift-ink)] dark:hover:text-[var(--sift-surface-subtle)]"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>

        {/* Scrollable Buckets */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Bucket 1: Shown in Table (Sortable) */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sift-muted)]">
                Shown in Table ({visibleColumns.length})
              </span>
              <span className="text-[10px] text-[var(--sift-muted)]">Drag to reorder</span>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleColumns.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1.5">
                  {visibleColumns.map((col) => (
                    <SortableColumnRow key={col.id} column={col} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Bucket 2: Available to Add */}
          {hiddenColumns.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--sift-muted)]">
                Available to Add ({hiddenColumns.length})
              </div>
              <div className="space-y-1.5">
                {hiddenColumns.map((col) => (
                  <div
                    key={col.id}
                    className="flex items-center justify-between rounded-lg border border-dashed border-[var(--sift-border)] bg-[var(--sift-surface-subtle)]/70 px-3 py-2 text-xs text-[var(--sift-muted)] dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]/40"
                  >
                    <span className="truncate font-medium">
                      {col.columnDef.meta?.label ?? col.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => col.toggleVisibility(true)}
                      className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-[var(--sift-accent)] shadow-2xs ring-1 ring-[var(--sift-border)] hover:bg-[var(--sift-accent-subtle)] dark:bg-[var(--sift-ink)] dark:text-[var(--sift-accent)] dark:ring-[var(--sift-ink)]"
                    >
                      <Eye className="h-3 w-3" />
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

interface SortableColumnRowProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: any;
}

function SortableColumnRow({ column }: SortableColumnRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const pinned = column.getIsPinned(); // TanStack V9: 'start' | 'end' | false
  const locked = Boolean(column.columnDef.meta?.lockedVisible);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg border border-[var(--sift-border)] bg-white px-2.5 py-2 text-xs shadow-2xs transition-colors',
        'dark:border-[var(--sift-ink)] dark:bg-[var(--sift-ink)]',
        isDragging && 'z-20 border-[var(--sift-accent)] shadow-lg ring-2 ring-[var(--sift-accent)]/20'
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-[var(--sift-muted)] hover:text-[var(--sift-muted)] active:cursor-grabbing"
          aria-label="Drag to reorder column"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="truncate font-medium text-[var(--sift-ink)] dark:text-[var(--sift-surface-subtle)]">
          {column.columnDef.meta?.label ?? column.id}
        </span>
        {pinned && (
          <span className="rounded bg-[var(--sift-accent-subtle)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--sift-accent)] dark:bg-[var(--sift-accent-deep)] dark:text-[var(--sift-accent-border)]">
            {pinned}
          </span>
        )}
      </div>

      {/* Pin Start / Pin End / Hide */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => column.pin(pinned === 'start' ? false : 'start')}
          title={pinned === 'start' ? 'Unpin from start' : 'Pin to start (left)'}
          className={cn(
            'rounded p-1 transition-colors',
            pinned === 'start'
              ? 'bg-[var(--sift-accent-subtle)] text-[var(--sift-accent-strong)] dark:bg-[var(--sift-accent-deep)] dark:text-[var(--sift-accent-border)]'
              : 'text-[var(--sift-muted)] hover:bg-[var(--sift-surface-subtle)] hover:text-[var(--sift-ink)] dark:hover:bg-[var(--sift-ink)]'
          )}
        >
          {pinned === 'start' ? (
            <PinOff className="h-3.5 w-3.5" />
          ) : (
            <PanelLeft className="h-3.5 w-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => column.pin(pinned === 'end' ? false : 'end')}
          title={pinned === 'end' ? 'Unpin from end' : 'Pin to end (right)'}
          className={cn(
            'rounded p-1 transition-colors',
            pinned === 'end'
              ? 'bg-[var(--sift-accent-subtle)] text-[var(--sift-accent-strong)] dark:bg-[var(--sift-accent-deep)] dark:text-[var(--sift-accent-border)]'
              : 'text-[var(--sift-muted)] hover:bg-[var(--sift-surface-subtle)] hover:text-[var(--sift-ink)] dark:hover:bg-[var(--sift-ink)]'
          )}
        >
          {pinned === 'end' ? (
            <PinOff className="h-3.5 w-3.5" />
          ) : (
            <PanelRight className="h-3.5 w-3.5" />
          )}
        </button>

        {locked ? (
          <span
            title="Required column"
            className="p-1 text-[var(--sift-border)] dark:text-[var(--sift-muted)]"
          >
            <Lock className="h-3.5 w-3.5" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => column.toggleVisibility(false)}
            title="Hide column"
            className="rounded p-1 text-[var(--sift-muted)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
