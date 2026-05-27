'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/accounting-db';
import { Scale, CheckCircle, AlertCircle, Download, RefreshCw } from 'lucide-react';

interface TrialRow {
  account: string;
  category: string;
  debit: number;
  credit: number;
}

function today() { return new Date().toISOString().split('T')[0]; }
function fmt(n: number) { return n.toFixed(2); }

const CATEGORY_COLORS: Record<string, string> = {
  Revenue:   'text-green-400',
  Expense:   'text-red-400',
  Asset:     'text-blue-400',
  Liability: 'text-yellow-400',
};

export function TrialBalance() {
  const [asOf,         setAsOf]         = useState(today());
  const [suppressZero, setSuppressZero] = useState(true);
  const [refreshKey,   setRefreshKey]   = useState(0);

  const sales     = useLiveQuery(() => db.sales.toArray(),     [refreshKey]);
  const purchases = useLiveQuery(() => db.purchases.toArray(), [refreshKey]);
  const parties   = useLiveQuery(() => db.parties.toArray(),   [refreshKey]);
  const expenses  = useLiveQuery(() => db.expenses.toArray(),  [refreshKey]);

  const { rows, totalDebit, totalCredit, difference, isBalanced, netGSTLiability } = useMemo(() => {
    const cutoff = asOf ? new Date(asOf + 'T23:59:59') : new Date();

    const fSales     = (sales     || []).filter(s => new Date(s.timestamp) <= cutoff);
    const fPurchases = (purchases || []).filter(p => new Date(p.timestamp) <= cutoff);
    const fExpenses  = (expenses  || []).filter(e => new Date(e.date)      <= cutoff);

    const totalSalesGross    = fSales.reduce((s, r) => s + r.grossAmount, 0);
    const totalSalesGST      = fSales.reduce((s, r) => s + r.gstAmount,   0);
    const totalSalesNet      = fSales.reduce((s, r) => s + r.netAmount,    0);
    const totalPurchaseGross = fPurchases.reduce((s, r) => s + r.grossAmount, 0);
    const totalPurchaseGST   = fPurchases.reduce((s, r) => s + r.gstAmount,   0);
    const totalPurchaseNet   = fPurchases.reduce((s, r) => s + r.netAmount,    0);
    const totalExpenses      = fExpenses.reduce((s, e)  => s + e.amount,       0);

    const totalReceivable = (parties || [])
      .filter(p => p.outstandingBalance > 0)
      .reduce((s, p) => s + p.outstandingBalance, 0);
    const totalPayable = Math.abs(
      (parties || []).filter(p => p.outstandingBalance < 0).reduce((s, p) => s + p.outstandingBalance, 0),
    );

    // Cash: receipts from sales (net of receivable) minus payments to suppliers (net of payable) minus expenses
    const cashReceipts  = Math.max(0, totalSalesNet - totalReceivable);
    const cashPayments  = Math.max(0, totalPurchaseNet - totalPayable) + totalExpenses;

    // Expense rows grouped by category
    const expByCategory: Record<string, number> = {};
    for (const e of fExpenses) {
      expByCategory[e.category] = (expByCategory[e.category] || 0) + e.amount;
    }

    const rawRows: TrialRow[] = [
      // Assets (Dr-normal)
      { account: 'Cash / Bank (Receipts)',      category: 'Asset',     debit: cashReceipts,      credit: 0             },
      { account: 'Cash / Bank (Payments)',      category: 'Asset',     debit: 0,                 credit: cashPayments  },
      { account: 'Accounts Receivable',         category: 'Asset',     debit: totalReceivable,   credit: 0             },
      { account: 'Inventory / COGS',            category: 'Asset',     debit: totalPurchaseGross,credit: 0             },
      { account: 'GST Input Credit',            category: 'Asset',     debit: totalPurchaseGST,  credit: 0             },
      // Liabilities (Cr-normal)
      { account: 'Accounts Payable',            category: 'Liability', debit: 0,                 credit: totalPayable  },
      { account: 'GST Collected (5%)',          category: 'Liability', debit: 0,                 credit: totalSalesGST },
      // Revenue (Cr-normal)
      { account: 'Sales Revenue',               category: 'Revenue',   debit: 0,                 credit: totalSalesGross },
      // Expenses (Dr-normal) — one row per category
      ...Object.entries(expByCategory).map(([cat, amt]) => ({
        account: cat, category: 'Expense', debit: amt, credit: 0,
      })),
    ];

    const rows = suppressZero
      ? rawRows.filter(r => r.debit > 0.005 || r.credit > 0.005)
      : rawRows;

    const totalDebit      = rows.reduce((s, r) => s + r.debit,  0);
    const totalCredit     = rows.reduce((s, r) => s + r.credit, 0);
    const difference      = Math.abs(totalDebit - totalCredit);
    const isBalanced      = difference < 0.02;
    const netGSTLiability = totalSalesGST - totalPurchaseGST;

    return { rows, totalDebit, totalCredit, difference, isBalanced, netGSTLiability };
  }, [sales, purchases, parties, expenses, asOf, suppressZero]);

  async function exportExcel() {
    const XLSX = await import('xlsx');
    const data: (string | number)[][] = [
      ['Trial Balance — Dawa Tshering Tshongkhang, Paro, Bhutan'],
      [`As on: ${asOf}`, '', '', '', ''],
      [`Generated: ${new Date().toLocaleString()}`, '', '', '', ''],
      [],
      ['Account', 'Category', 'Debit (Nu.)', 'Credit (Nu.)', 'Balance (Nu.)', 'Dr/Cr'],
      ...rows.map(r => {
        const bal  = Math.abs(r.debit - r.credit);
        const drCr = r.debit >= r.credit ? 'Dr' : 'Cr';
        return [r.account, r.category, r.debit || '', r.credit || '', bal, drCr];
      }),
      [],
      ['TOTALS', '', totalDebit.toFixed(2), totalCredit.toFixed(2), '', ''],
      ['Difference', '', difference.toFixed(2), '', '', ''],
      [],
      ['GST Summary', '', '', '', '', ''],
      ['Net GST Payable to Govt', '', '', netGSTLiability.toFixed(2), '', 'Cr'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 6 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance');
    XLSX.writeFile(wb, `TrialBalance_${asOf}.xlsx`);
  }

  if (!sales || !purchases || !parties || !expenses) {
    return <div className="text-slate-400 text-sm p-8 text-center">Computing trial balance…</div>;
  }

  return (
    <div className="space-y-6">

      {/* ── Controls ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-4 bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div>
          <label className="block text-slate-400 text-xs mb-1">Trial Balance as on</label>
          <input
            type="date"
            value={asOf}
            onChange={e => setAsOf(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer pb-1">
          <input
            type="checkbox"
            checked={suppressZero}
            onChange={e => setSuppressZero(e.target.checked)}
            className="w-4 h-4 accent-orange-500 rounded"
          />
          <span className="text-slate-300 text-sm">Suppress Zero-Balance Accounts</span>
        </label>
        <div className="flex gap-2 ml-auto pb-0.5">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="flex items-center gap-1.5 border border-slate-600 hover:border-orange-500 text-slate-300 hover:text-orange-400 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 border border-slate-600 hover:border-green-500 text-slate-300 hover:text-green-400 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* ── Balance indicator ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isBalanced ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          {isBalanced
            ? <CheckCircle className="w-5 h-5 text-green-400" />
            : <AlertCircle className="w-5 h-5 text-red-400" />}
        </div>
        <div>
          <p className={`font-semibold text-sm ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>
            {isBalanced ? 'Trial balance — accounts balance' : `Discrepancy detected — difference: Nu. ${fmt(difference)}`}
          </p>
          <p className="text-slate-500 text-xs">As on {asOf} &nbsp;·&nbsp; {rows.length} active accounts</p>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Debits',    value: totalDebit,              color: 'text-blue-400'   },
          { label: 'Total Credits',   value: totalCredit,             color: 'text-green-400'  },
          { label: 'Difference',      value: difference,              color: isBalanced ? 'text-green-400' : 'text-red-400' },
          { label: 'Net GST Payable', value: Math.max(0, netGSTLiability), color: 'text-yellow-400' },
        ].map(c => (
          <div key={c.label} className="bg-slate-700/50 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs mb-1">{c.label}</p>
            <p className={`font-mono font-bold text-lg ${c.color}`}>Nu. {fmt(c.value)}</p>
          </div>
        ))}
      </div>

      {/* ── Trial Balance Table ───────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Particulars</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Category</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Debit (Nu.)</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Credit (Nu.)</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Balance (Nu.)</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium w-16">Dr/Cr</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">No transactions recorded yet.</td></tr>
            ) : rows.map((row, i) => {
              const balance = Math.abs(row.debit - row.credit);
              const drCr    = row.debit >= row.credit ? 'Dr' : 'Cr';
              return (
                <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/30">
                  <td className="px-4 py-2.5 text-white">{row.account}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium ${CATEGORY_COLORS[row.category] || 'text-slate-400'}`}>
                      {row.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm">
                    {row.debit > 0.005
                      ? <span className="text-slate-200">{fmt(row.debit)}</span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm">
                    {row.credit > 0.005
                      ? <span className="text-slate-200">{fmt(row.credit)}</span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-slate-200">
                    {fmt(balance)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${drCr === 'Dr' ? 'bg-blue-500/15 text-blue-400' : 'bg-yellow-500/15 text-yellow-400'}`}>
                      {drCr}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-500 bg-slate-700/50">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-white font-bold">TOTAL</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-orange-400">{fmt(totalDebit)}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-orange-400">{fmt(totalCredit)}</td>
              <td className={`px-4 py-3 text-right font-mono font-bold ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>
                {fmt(difference)}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`text-xs font-bold ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>
                  {isBalanced ? '✓' : '!'}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── GST Reconciliation ───────────────────────────────────────────────── */}
      <div className="bg-slate-700/30 border border-slate-700 rounded-xl p-5">
        <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Scale className="w-4 h-4 text-orange-400" /> GST Reconciliation
        </h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <p className="text-slate-400 text-xs mb-1">GST Collected (Output)</p>
            <p className="text-yellow-400 font-mono font-bold text-lg">Nu. {fmt((sales || []).reduce((s, r) => s + (new Date(r.timestamp) <= new Date(asOf + 'T23:59:59') ? r.gstAmount : 0), 0))}</p>
          </div>
          <div className="text-center border-x border-slate-600">
            <p className="text-slate-400 text-xs mb-1">GST Input Credit</p>
            <p className="text-blue-400 font-mono font-bold text-lg">Nu. {fmt((purchases || []).reduce((s, r) => s + (new Date(r.timestamp) <= new Date(asOf + 'T23:59:59') ? r.gstAmount : 0), 0))}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400 text-xs mb-1">Net GST Payable to Govt</p>
            <p className={`font-mono font-bold text-lg ${netGSTLiability >= 0 ? 'text-red-400' : 'text-green-400'}`}>
              Nu. {fmt(Math.max(0, netGSTLiability))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
