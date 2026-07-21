'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { salesCRUD, purchaseCRUD, partyCRUD } from '@/lib/accounting-db';
import { AccountingNav } from '@/components/accounting/AccountingNav';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  AlertTriangle,
  Receipt,
  BookOpen,
  BarChart3,
  ArrowRight,
  Clock,
  Wallet,
  CreditCard,
} from 'lucide-react';

type Product = { id: string; name: string; sku: string; stock: number; unit: string; price: number; category: string };

function getReorder(sku: string): number {
  try { return Number(localStorage.getItem(`dtt-inv-reorder-${sku}`)) || 5; } catch { return 5; }
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtInt(n: number) {
  return Math.round(n).toLocaleString('en-IN');
}
function fmtNum(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Payment mode / account grouping (driven by the invoice Notes field) ──────
const UNTAGGED = 'NOT TAGGED';

function normalizeNote(note?: string): string {
  return (note || '').trim().toUpperCase() || UNTAGGED;
}

const NOTE_PALETTE = [
  { chip: 'bg-blue-500/20 text-blue-400 border-blue-500/30',     bar: 'bg-blue-500'   },
  { chip: 'bg-purple-500/20 text-purple-400 border-purple-500/30', bar: 'bg-purple-500' },
  { chip: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',     bar: 'bg-cyan-500'   },
  { chip: 'bg-pink-500/20 text-pink-400 border-pink-500/30',     bar: 'bg-pink-500'   },
  { chip: 'bg-amber-500/20 text-amber-400 border-amber-500/30',   bar: 'bg-amber-500'  },
  { chip: 'bg-teal-500/20 text-teal-400 border-teal-500/30',     bar: 'bg-teal-500'   },
];

/** Stable colour per label, so an account keeps its colour as totals shift. */
function noteStyle(label: string) {
  if (label === 'CASH') return { chip: 'bg-green-500/20 text-green-400 border-green-500/30', bar: 'bg-green-500' };
  if (label === UNTAGGED) return { chip: 'bg-slate-600/30 text-slate-400 border-slate-600/40', bar: 'bg-slate-500' };
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return NOTE_PALETTE[h % NOTE_PALETTE.length];
}

type NotePeriod = 'today' | 'month' | 'all';

function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-slate-400 text-sm">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-white text-2xl font-bold font-mono">{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function AccountingDashboard() {
  const sales     = useLiveQuery(() => salesCRUD.getAll(), []);
  const purchases = useLiveQuery(() => purchaseCRUD.getAll(), []);
  const parties   = useLiveQuery(() => partyCRUD.getAll(), []);

  const [products, setProducts] = useState<Product[] | null>(null);
  useEffect(() => {
    fetch('/api/products').then(r => r.ok ? r.json() : []).then(setProducts).catch(() => setProducts([]));
  }, []);

  const inventory = products?.map(p => ({
    id: p.id,
    description: p.name,
    unit: p.unit,
    stockQty: p.stock,
    reorderLevel: getReorder(p.sku),
  })) ?? null;

  const isLoading = sales === undefined || purchases === undefined || inventory === null || parties === undefined;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const todaySales = (sales || []).filter(s => new Date(s.timestamp).toISOString().split('T')[0] === todayStr);
  const todayRevenue = todaySales.reduce((s, r) => s + r.netAmount, 0);
  const todayGST = todaySales.reduce((s, r) => s + r.gstAmount, 0);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthSales = (sales || []).filter(s => new Date(s.timestamp) >= monthStart);
  const monthRevenue = monthSales.reduce((s, r) => s + r.netAmount, 0);
  const monthPurchases = (purchases || []).filter(p => new Date(p.timestamp) >= monthStart);
  const monthPurchaseNet = monthPurchases.reduce((s, r) => s + r.netAmount, 0);

  const totalGSTCollected = (sales || []).reduce((s, r) => s + r.gstAmount, 0);
  const lowStockItems = (inventory || []).filter(i => i.stockQty <= i.reorderLevel);
  const totalReceivable = (parties || []).filter(p => p.outstandingBalance > 0).reduce((s, p) => s + p.outstandingBalance, 0);

  const recentSales = [...(sales || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 6);

  // ── Sales grouped by the Notes tag (CASH / OD ACCOUNT / LHASHING … ) ──
  const [notePeriod, setNotePeriod] = useState<NotePeriod>('month');

  const noteGroups = useMemo(() => {
    if (!sales) return [];
    const now = new Date();
    let cutoff: number | null = null;
    if (notePeriod === 'today') cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    else if (notePeriod === 'month') cutoff = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const scoped = cutoff === null
      ? sales
      : sales.filter(s => new Date(s.timestamp).getTime() >= cutoff!);

    const map = new Map<string, { label: string; count: number; net: number; gst: number }>();
    for (const s of scoped) {
      const label = normalizeNote(s.notes);
      const g = map.get(label) ?? { label, count: 0, net: 0, gst: 0 };
      g.count += 1;
      g.net += s.netAmount;
      g.gst += s.gstAmount;
      map.set(label, g);
    }
    return [...map.values()].sort((a, b) => b.net - a.net);
  }, [sales, notePeriod]);

  const noteTotalNet = noteGroups.reduce((s, g) => s + g.net, 0);
  const noteTotalCount = noteGroups.reduce((s, g) => s + g.count, 0);

  return (
    <div className="min-h-screen bg-slate-900">
      <AccountingNav />

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-white text-2xl font-bold">Accounting Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Dawa Tshering Shop, Paro — {fmtDate(new Date())}
          </p>
        </div>


        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-5 animate-pulse h-28" />
            ))}
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Today's Revenue"
                value={`Nu. ${fmtInt(todayRevenue)}`}
                sub={`${todaySales.length} invoice${todaySales.length !== 1 ? 's' : ''} today`}
                color="bg-orange-500/20 text-orange-400"
                icon={TrendingUp}
              />
              <StatCard
                label="Month Revenue"
                value={`Nu. ${fmtInt(monthRevenue)}`}
                sub={`${monthSales.length} invoices this month`}
                color="bg-green-500/20 text-green-400"
                icon={Receipt}
              />
              <StatCard
                label="GST Collected (All)"
                value={`Nu. ${fmtInt(totalGSTCollected)}`}
                sub={`Today: Nu. ${fmtNum(todayGST)}`}
                color="bg-yellow-500/20 text-yellow-400"
                icon={BarChart3}
              />
              <StatCard
                label="Low Stock Alerts"
                value={String(lowStockItems.length)}
                sub={lowStockItems.length > 0 ? `${lowStockItems.slice(0, 2).map(i => i.description.split(' ')[0]).join(', ')}…` : 'All stock levels OK'}
                color={lowStockItems.length > 0 ? 'bg-red-500/20 text-red-400' : 'bg-slate-600/30 text-slate-400'}
                icon={AlertTriangle}
              />
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Month Purchases"
                value={`Nu. ${fmtInt(monthPurchaseNet)}`}
                sub={`${monthPurchases.length} purchase orders`}
                color="bg-blue-500/20 text-blue-400"
                icon={Package}
              />
              <StatCard
                label="Accounts Receivable"
                value={`Nu. ${fmtInt(totalReceivable)}`}
                sub={`${(parties || []).filter(p => p.outstandingBalance > 0).length} parties owe you`}
                color="bg-purple-500/20 text-purple-400"
                icon={BookOpen}
              />
              <StatCard
                label="Total Invoices"
                value={String((sales || []).length)}
                sub={`Starting from #${(sales || []).length > 0 ? (sales || [])[0]?.invoiceNo : '000568'}`}
                color="bg-slate-600/30 text-slate-300"
                icon={Receipt}
              />
              <StatCard
                label="Inventory Items"
                value={String((inventory || []).length)}
                sub={`${(inventory || []).reduce((s, i) => s + i.stockQty, 0)} total units`}
                color="bg-slate-600/30 text-slate-300"
                icon={Package}
              />
            </div>

            {/* Sales by Payment Mode / Account (from invoice Notes) */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-orange-400" />
                  Sales by Payment Mode / Account
                </h2>
                <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
                  {([
                    ['today', 'Today'],
                    ['month', 'This Month'],
                    ['all',   'All Time'],
                  ] as [NotePeriod, string][]).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setNotePeriod(id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        notePeriod === id ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                {noteGroups.length === 0 ? (
                  <div className="px-5 py-10 text-center text-slate-500 text-sm">
                    No invoices in this period.
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-slate-700">
                      {noteGroups.map(g => {
                        const pct = noteTotalNet > 0 ? (g.net / noteTotalNet) * 100 : 0;
                        const style = noteStyle(g.label);
                        return (
                          <div key={g.label} className="px-4 sm:px-5 py-3.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-md border ${style.chip}`}>
                                  {g.label}
                                </span>
                                <span className="text-slate-400 text-xs shrink-0">
                                  {g.count} invoice{g.count !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-white font-mono font-semibold text-sm">Nu. {fmtNum(g.net)}</p>
                                <p className="text-slate-500 text-[10px] mt-0.5">
                                  {pct.toFixed(1)}% · GST Nu. {fmtNum(g.gst)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-slate-700/40 border-t border-slate-700">
                      <span className="text-slate-300 text-sm font-semibold">
                        Total · {noteTotalCount} invoice{noteTotalCount !== 1 ? 's' : ''}
                      </span>
                      <span className="text-orange-400 font-mono font-bold">Nu. {fmtNum(noteTotalNet)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-white font-semibold mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    href: '/admin/accounting/pos',
                    icon: ShoppingCart,
                    title: 'New Invoice (POS)',
                    desc: 'Create a sales invoice and print it',
                    color: 'bg-orange-500 hover:bg-orange-600',
                  },
                  {
                    href: '/admin/accounting/ledgers',
                    icon: BookOpen,
                    title: 'Manage Ledgers',
                    desc: 'Sales, Purchases, Parties, Inventory',
                    color: 'bg-slate-700 hover:bg-slate-600',
                  },
                  {
                    href: '/admin/accounting/cash',
                    icon: Wallet,
                    title: 'Cash & Returns',
                    desc: 'Cash book, credit & debit notes',
                    color: 'bg-slate-700 hover:bg-slate-600',
                  },
                  {
                    href: '/admin/accounting/reports',
                    icon: BarChart3,
                    title: 'Reports & Export',
                    desc: 'Trial Balance, Tax Report, Excel/PDF',
                    color: 'bg-slate-700 hover:bg-slate-600',
                  },
                ].map(({ href, icon: Icon, title, desc, color }) => (
                  <Link key={href} href={href} className={`${color} rounded-xl p-5 flex items-center gap-4 transition-colors group`}>
                    <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold">{title}</p>
                      <p className="text-white/70 text-xs mt-0.5 truncate">{desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/50 group-hover:text-white/80 transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Transactions + Low Stock */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Invoices */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-400" /> Recent Invoices
                  </h3>
                  <Link href="/admin/accounting/ledgers" className="text-orange-400 hover:text-orange-300 text-xs transition-colors">View all</Link>
                </div>
                {recentSales.length === 0 ? (
                  <div className="px-5 py-10 text-center text-slate-500 text-sm">No invoices yet. Create one via Point of Sale.</div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {recentSales.map(sale => (
                      <div key={sale.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors">
                        <div>
                          <span className="text-orange-400 font-mono text-sm font-medium">#{sale.invoiceNo}</span>
                          <span className="text-white text-sm ml-3">{sale.customerName || <span className="text-slate-500 italic">Cash Sale</span>}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-mono text-sm font-semibold">Nu. {fmtNum(sale.netAmount)}</div>
                          <div className="text-slate-500 text-xs">{fmtDate(sale.timestamp)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Low Stock Alerts */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" /> Stock Alerts
                  </h3>
                  <Link href="/admin/accounting/ledgers?tab=inventory" className="text-orange-400 hover:text-orange-300 text-xs transition-colors">Manage</Link>
                </div>
                {lowStockItems.length === 0 ? (
                  <div className="px-5 py-10 text-center text-slate-500 text-sm">All stock levels are above reorder points.</div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {lowStockItems.slice(0, 6).map(item => (
                      <div key={item.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors">
                        <div>
                          <p className="text-white text-sm">{item.description}</p>
                          <p className="text-slate-500 text-xs">{item.unit} · Reorder at {item.reorderLevel}</p>
                        </div>
                        <div className={`font-mono font-bold text-sm px-2 py-0.5 rounded ${item.stockQty === 0 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {item.stockQty === 0 ? 'OUT' : `${item.stockQty} left`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
