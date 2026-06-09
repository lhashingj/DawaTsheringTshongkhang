'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { salesCRUD, purchaseCRUD, inventoryCRUD, partyCRUD } from '@/lib/accounting-db';
import { AccountingNav } from '@/components/accounting/AccountingNav';
import Link from 'next/link';
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
} from 'lucide-react';

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtInt(n: number) {
  return Math.round(n).toLocaleString('en-IN');
}
function fmtNum(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
  const inventory = useLiveQuery(() => inventoryCRUD.getAll(), []);
  const parties   = useLiveQuery(() => partyCRUD.getAll(), []);

  const isLoading = sales === undefined || purchases === undefined || inventory === undefined || parties === undefined;

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

            {/* Quick Actions */}
            <div>
              <h2 className="text-white font-semibold mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
