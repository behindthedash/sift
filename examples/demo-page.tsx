'use client';

import React, { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Activity,
  Archive,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  Globe,
  Mail,
  ShieldCheck,
  Tag,
  Trash2,
  User,
} from 'lucide-react';
import {
  DataGrid,
  buildPostgresWhereClause,
  createBrowserUrlAdapter,
  type BulkAction,
  type DataGridFeatures,
  type ServerQueryPayload,
} from '../src';

interface AccountRecord {
  id: string;
  company: string;
  owner: string;
  email: string;
  region: 'North America' | 'Europe' | 'APAC' | 'LATAM';
  plan: 'Starter' | 'Growth' | 'Enterprise';
  status: 'Active' | 'Trial' | 'At Risk' | 'Churned';
  arr: number;
  seats: number;
  healthScore: number;
  verified: boolean;
  renewalDate: string;
}

const REGIONS: AccountRecord['region'][] = ['North America', 'Europe', 'APAC', 'LATAM'];
const PLANS: AccountRecord['plan'][] = ['Starter', 'Growth', 'Enterprise'];
const STATUSES: AccountRecord['status'][] = ['Active', 'Trial', 'At Risk', 'Churned'];
const OWNERS = ['Alex Rivera', 'Morgan Chen', 'Jordan Patel', 'Taylor Kim', 'Samira Vance'];
const PREFIXES = ['Acme', 'Vertex', 'Northstar', 'Lumina', 'Stratos', 'Pulse', 'Helios', 'Kinetix', 'Vanguard', 'Nova'];
const SUFFIXES = ['Labs', 'Systems', 'Cloud', 'Analytics', 'Health', 'Logistics', 'Financial', 'AI', 'Commerce', 'Dynamics'];

function generateDemoAccounts(count = 1200): AccountRecord[] {
  return Array.from({ length: count }, (_, i) => {
    const company = `${PREFIXES[i % PREFIXES.length]} ${SUFFIXES[(i * 3) % SUFFIXES.length]} ${i + 1}`;
    const plan = PLANS[(i * 7) % PLANS.length];
    const baseArr = plan === 'Enterprise' ? 84000 : plan === 'Growth' ? 24000 : 4800;
    const arr = baseArr + ((i * 1350) % 45000);
    const month = String(((i * 5) % 12) + 1).padStart(2, '0');
    const day = String(((i * 11) % 28) + 1).padStart(2, '0');

    return {
      id: `acc_${String(i + 1001)}`,
      company,
      owner: OWNERS[i % OWNERS.length],
      email: `ops@${company.toLowerCase().replace(/\s+/g, '')}.io`,
      region: REGIONS[(i * 5) % REGIONS.length],
      plan,
      status: STATUSES[(i * 13) % STATUSES.length],
      arr,
      seats: 5 + ((i * 17) % 250),
      healthScore: 35 + ((i * 19) % 66),
      verified: i % 4 !== 0,
      renewalDate: `2026-${month}-${day}`,
    };
  });
}

const STATUS_BADGE: Record<AccountRecord['status'], string> = {
  Active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Trial: 'bg-sky-50 text-sky-700 ring-sky-200',
  'At Risk': 'bg-amber-50 text-amber-700 ring-amber-200',
  Churned: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const SQL_ALLOWLIST: Record<string, string> = {
  company: 'accounts.company',
  owner: 'accounts.owner_name',
  region: 'accounts.region',
  plan: 'accounts.plan_tier',
  status: 'accounts.status',
  arr: 'accounts.arr_usd',
  seats: 'accounts.seat_count',
  healthScore: 'accounts.health_score',
  verified: 'accounts.is_verified',
  renewalDate: 'accounts.renewal_date',
};

export default function AccountsGridDemoPage() {
  const [rows, setRows] = useState<AccountRecord[]>(() => generateDemoAccounts(1200));
  const [lastQuery, setLastQuery] = useState<ServerQueryPayload | null>(null);
  const [showSqlPreview, setShowSqlPreview] = useState(false);

  const urlAdapter = useMemo(() => createBrowserUrlAdapter(), []);

  const columns = useMemo<ColumnDef<DataGridFeatures, AccountRecord, unknown>[]>(
    () => [
      {
        accessorKey: 'company',
        header: 'Account',
        size: 220,
        meta: {
          label: 'Account',
          icon: Building2,
          filterVariant: 'text',
          lockedVisible: true,
          placeholder: 'Search company name...',
        },
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {row.original.company}
            </div>
            <div className="text-[11px] text-slate-400">{row.original.id}</div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 130,
        meta: {
          label: 'Status',
          icon: Activity,
          filterVariant: 'select',
          groupable: true,
          filterOptions: STATUSES.map((s) => ({ label: s, value: s })),
        },
        cell: ({ getValue }) => {
          const val = getValue() as AccountRecord['status'];
          return (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_BADGE[val]}`}
            >
              {val}
            </span>
          );
        },
      },
      {
        accessorKey: 'region',
        header: 'Region',
        size: 150,
        meta: {
          label: 'Region',
          icon: Globe,
          filterVariant: 'multi-select',
          groupable: true,
        },
      },
      {
        accessorKey: 'plan',
        header: 'Plan Tier',
        size: 130,
        meta: {
          label: 'Plan Tier',
          icon: Tag,
          filterVariant: 'select',
          groupable: true,
        },
      },
      {
        accessorKey: 'arr',
        header: 'ARR',
        size: 130,
        meta: {
          label: 'ARR (USD)',
          icon: DollarSign,
          filterVariant: 'number',
          align: 'end',
          formatValue: (v) => `$${Number(v).toLocaleString()}`,
        },
        cell: ({ getValue }) => (
          <span className="font-mono font-medium">
            ${Number(getValue()).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: 'healthScore',
        header: 'Health',
        size: 120,
        meta: {
          label: 'Health Score',
          icon: ShieldCheck,
          filterVariant: 'number',
          align: 'end',
        },
        cell: ({ getValue }) => {
          const score = Number(getValue());
          const color =
            score >= 75
              ? 'bg-emerald-500'
              : score >= 55
                ? 'bg-amber-500'
                : 'bg-rose-500';
          return (
            <div className="flex items-center justify-end gap-2">
              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
              </div>
              <span className="w-6 font-mono text-[11px]">{score}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'owner',
        header: 'Owner',
        size: 155,
        meta: {
          label: 'Owner',
          icon: User,
          filterVariant: 'select',
          groupable: true,
        },
      },
      {
        accessorKey: 'renewalDate',
        header: 'Renewal Date',
        size: 140,
        meta: {
          label: 'Renewal Date',
          icon: Calendar,
          filterVariant: 'date',
        },
      },
      {
        accessorKey: 'seats',
        header: 'Seats',
        size: 95,
        meta: {
          label: 'Seats',
          filterVariant: 'number',
          align: 'end',
          defaultHidden: true, // Starts in Column Studio "Available to Add" bucket
        },
      },
      {
        accessorKey: 'verified',
        header: 'Verified',
        size: 105,
        meta: {
          label: 'Verified',
          icon: CheckCircle2,
          filterVariant: 'boolean',
          defaultHidden: true,
        },
        cell: ({ getValue }) => (getValue() ? 'Yes' : 'No'),
      },
      {
        accessorKey: 'email',
        header: 'Billing Email',
        size: 220,
        meta: {
          label: 'Billing Email',
          icon: Mail,
          filterVariant: 'text',
          defaultHidden: true,
        },
      },
    ],
    []
  );

  const bulkActions = useMemo<BulkAction<AccountRecord>[]>(
    () => [
      {
        id: 'archive',
        label: 'Mark Active',
        icon: Archive,
        onAction: (selected, clear) => {
          const ids = new Set(selected.map((r) => r.id));
          setRows((prev) =>
            prev.map((r) => (ids.has(r.id) ? { ...r, status: 'Active' } : r))
          );
          clear();
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        variant: 'destructive',
        onAction: (selected, clear) => {
          const ids = new Set(selected.map((r) => r.id));
          setRows((prev) => prev.filter((r) => !ids.has(r.id)));
          clear();
        },
      },
    ],
    []
  );

  const postgresPreview = useMemo(() => {
    if (!lastQuery) return null;
    return buildPostgresWhereClause(
      {
        combinator: lastQuery.combinator,
        rules: lastQuery.filters.map((f, i) => ({
          id: String(i),
          columnId: f.field,
          operator: f.op,
          value: f.value,
        })),
      },
      SQL_ALLOWLIST
    );
  }, [lastQuery]);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            @your-org/data-grid — TanStack Table V9 Demo
          </h1>
          <p className="text-xs text-slate-500">
            Press <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono">⌘K</kbd> for faceted quick filters, toggle Rules for AND/OR queries, or click Group to test breadcrumb trails.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSqlPreview((v) => !v)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {showSqlPreview ? 'Hide' : 'Inspect'} Postgres / API Query Payload
        </button>
      </div>

      <DataGrid
        title="Customer Accounts"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        urlAdapter={urlAdapter}
        bulkActions={bulkActions}
        initialColumnPinning={{ start: ['__select__', 'company'], end: [] }}
        onServerQueryChange={setLastQuery}
        exportFilename="customer-accounts.csv"
      />

      {showSqlPreview && postgresPreview && (
        <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-300">
          {JSON.stringify(
            {
              postgresWhere: postgresPreview.sql || '(no active filters)',
              postgresParams: postgresPreview.params,
              serverQueryPayload: lastQuery,
            },
            null,
            2
          )}
        </pre>
      )}
    </main>
  );
}
