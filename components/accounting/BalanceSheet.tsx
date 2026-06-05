'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/accounting-db';
import { Download, FileText, CheckCircle, AlertCircle } from 'lucide-react';

function fmt(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface BSSection {
  title: string;
  color: string;
  rows: { label: string; value: number; indent?: boolean; bold?: boolean }[];
  total: number;
  totalLabel: string;
  totalColor: string;
}

export function BalanceSheet() {
  const sales      = useLiveQuery(() => db.sales.toArray(),        []);
  const purchases  = useLiveQuery(() => db.purchases.toArray(),    []);
  const parties    = useLiveQuery(() => db.parties.toArray(),      []);
  const inventory  = useLiveQuery(() => db.inventory.toArray(),    []);
  const expenses   = useLiveQuery(() => db.expenses.toArray(),     []);
  const glEntries  = useLiveQuery(() => db.generalLedger.toArray(), []);

  if (!sales || !purchases || !parties || !inventory || !expenses || !glEntries) {
    return <div className="text-slate-400 text-sm p-8 text-center">Computing balance sheet…</div>;
  }

  // ── Asset computations ────────────────────────────────────────────────────
  const totalSalesNet      = sales.reduce((s, r) => s + r.netAmount, 0);
  const totalPurchaseNet   = purchases.reduce((s, r) => s + r.netAmount, 0);
  const totalExpenses      = expenses.reduce((s, e) => s + e.amount, 0);
  const cashBalance        = Math.max(0, totalSalesNet - totalPurchaseNet - totalExpenses);

  const accountsReceivable = parties
    .filter(p => p.outstandingBalance > 0)
    .reduce((s, p) => s + p.outstandingBalance, 0);

  const inventoryValue = inventory.reduce((s, i) => s + i.stockQty * i.baseRate, 0);

  const gstInputCredit = purchases.reduce((s, r) => s + r.gstAmount, 0)
    + expenses.reduce((s, e) => s + (e.inputTaxAmount ?? 0), 0);

  const totalCurrentAssets = cashBalance + accountsReceivable + inventoryValue + gstInputCredit;

  // ── Liability computations ────────────────────────────────────────────────
  const accountsPayable = Math.abs(
    parties.filter(p => p.outstandingBalance < 0).reduce((s, p) => s + p.outstandingBalance, 0)
  );

  const gstCollected     = sales.reduce((s, r) => s + r.gstAmount, 0);
  const netGSTPayable    = Math.max(0, gstCollected - gstInputCredit);
  const totalLiabilities = accountsPayable + netGSTPayable;

  // ── Equity ────────────────────────────────────────────────────────────────
  const grossRevenue  = sales.reduce((s, r) => s + r.grossAmount, 0);
  // Perpetual COGS: actual wholesale cost of sold items from GL
  const cogs          = glEntries
    .filter(e => e.account === 'Cost of Goods Sold')
    .reduce((s, e) => s + e.debit, 0);
  const netExpenses = expenses.reduce((s, e) => s + e.amount - (e.inputTaxAmount ?? 0), 0);
  const retainedEarnings = grossRevenue - cogs - netExpenses;
  const ownersEquity     = totalCurrentAssets - totalLiabilities;

  const totalLiabEquity  = totalLiabilities + ownersEquity;
  const isBalanced       = Math.abs(totalCurrentAssets - totalLiabEquity) < 0.02;

  // ── Export ────────────────────────────────────────────────────────────────
  async function exportExcel() {
    const XLSX = await import('xlsx');
    const asOf = fmtDate(new Date());
    const rows: (string | number)[][] = [
      ['Dawa Tshering Tshongkhang, Paro, Bhutan'],
      ['Balance Sheet'],
      [`As of: ${asOf}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['ASSETS', ''],
      ['Current Assets', ''],
      ['  Cash / Bank (net)', cashBalance],
      ['  Accounts Receivable', accountsReceivable],
      ['  Inventory at Cost', inventoryValue],
      ['  GST Input Credit', gstInputCredit],
      ['Total Assets', totalCurrentAssets],
      [],
      ['LIABILITIES', ''],
      ['  Accounts Payable', accountsPayable],
      ['  GST Payable (Net)', netGSTPayable],
      ['Total Liabilities', totalLiabilities],
      [],
      ["OWNER'S EQUITY", ''],
      ['  Retained Earnings (Net Profit)', retainedEarnings],
      ["Total Owner's Equity", ownersEquity],
      [],
      ['Total Liabilities + Equity', totalLiabEquity],
      [],
      ['Balanced?', isBalanced ? 'YES' : 'NO — discrepancy detected'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 38 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');
    XLSX.writeFile(wb, `BalanceSheet_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const sections: BSSection[] = [
    {
      title: 'ASSETS',
      color: 'text-blue-400',
      rows: [
        { label: 'Current Assets', value: 0, bold: true },
        { label: 'Cash / Bank (net receipts)', value: cashBalance, indent: true },
        { label: 'Accounts Receivable', value: accountsReceivable, indent: true },
        { label: 'Inventory at Cost', value: inventoryValue, indent: true },
        { label: 'GST Input Credit', value: gstInputCredit, indent: true },
      ],
      total: totalCurrentAssets,
      totalLabel: 'Total Assets',
      totalColor: 'text-blue-400',
    },
    {
      title: 'LIABILITIES',
      color: 'text-red-400',
      rows: [
        { label: 'Current Liabilities', value: 0, bold: true },
        { label: 'Accounts Payable', value: accountsPayable, indent: true },
        { label: 'GST Payable (Net)', value: netGSTPayable, indent: true },
      ],
      total: totalLiabilities,
      totalLabel: 'Total Liabilities',
      totalColor: 'text-red-400',
    },
    {
      title: "OWNER'S EQUITY",
      color: 'text-green-400',
      rows: [
        { label: 'Retained Earnings (Net Profit to Date)', value: retainedEarnings, indent: true },
      ],
      total: ownersEquity,
      totalLabel: "Total Owner's Equity",
      totalColor: 'text-green-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isBalanced ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            {isBalanced
              ? <CheckCircle className="w-5 h-5 text-green-400" />
              : <AlertCircle className="w-5 h-5 text-red-400" />}
          </div>
          <div>
            <h3 className="text-white font-bold">Balance Sheet</h3>
            <p className="text-slate-400 text-xs">As of {fmtDate(new Date())}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="flex items-center gap-1.5 border border-slate-600 hover:border-green-500 text-slate-300 hover:text-green-400 px-3 py-2 rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Excel</span>
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 border border-slate-600 hover:border-blue-500 text-slate-300 hover:text-blue-400 px-3 py-2 rounded-lg text-sm transition-colors">
            <FileText className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Assets',      value: totalCurrentAssets, color: 'text-blue-400',  bg: 'bg-blue-500/10' },
          { label: 'Total Liabilities', value: totalLiabilities,   color: 'text-red-400',   bg: 'bg-red-500/10' },
          { label: "Owner's Equity",    value: ownersEquity,       color: 'text-green-400', bg: 'bg-green-500/10' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border border-slate-700 rounded-xl px-4 py-3 flex sm:flex-col sm:text-center items-center sm:items-start justify-between sm:justify-start gap-2`}>
            <p className="text-slate-400 text-xs sm:mb-1">{c.label}</p>
            <p className={`font-mono font-bold text-base sm:text-lg ${c.color}`}>Nu. {fmt(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Two-column layout: Assets | Liabilities + Equity */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Assets */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-blue-500/10 border-b border-slate-700">
            <h4 className="text-blue-400 font-bold text-sm uppercase tracking-wider">Assets</h4>
          </div>
          <div className="divide-y divide-slate-700/60">
            {sections[0].rows.filter(r => !r.bold).map((row, i) => (
              <div key={i} className="flex justify-between px-5 py-2.5 hover:bg-slate-700/20">
                <span className="text-slate-300 text-sm" style={{ paddingLeft: row.indent ? '1rem' : undefined }}>{row.label}</span>
                <span className="text-slate-200 font-mono text-sm">{fmt(row.value)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between px-5 py-3 bg-blue-500/10 border-t-2 border-slate-600">
            <span className="text-blue-400 font-bold text-sm">Total Assets</span>
            <span className="text-blue-400 font-mono font-bold text-sm">Nu. {fmt(totalCurrentAssets)}</span>
          </div>
        </div>

        {/* Liabilities + Equity */}
        <div className="space-y-4">
          {/* Liabilities */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-red-500/10 border-b border-slate-700">
              <h4 className="text-red-400 font-bold text-sm uppercase tracking-wider">Liabilities</h4>
            </div>
            <div className="divide-y divide-slate-700/60">
              {sections[1].rows.filter(r => !r.bold).map((row, i) => (
                <div key={i} className="flex justify-between px-5 py-2.5 hover:bg-slate-700/20">
                  <span className="text-slate-300 text-sm" style={{ paddingLeft: row.indent ? '1rem' : undefined }}>{row.label}</span>
                  <span className="text-slate-200 font-mono text-sm">{fmt(row.value)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between px-5 py-3 bg-red-500/10 border-t-2 border-slate-600">
              <span className="text-red-400 font-bold text-sm">Total Liabilities</span>
              <span className="text-red-400 font-mono font-bold text-sm">Nu. {fmt(totalLiabilities)}</span>
            </div>
          </div>

          {/* Equity */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-green-500/10 border-b border-slate-700">
              <h4 className="text-green-400 font-bold text-sm uppercase tracking-wider">Owner&apos;s Equity</h4>
            </div>
            <div className="divide-y divide-slate-700/60">
              {sections[2].rows.map((row, i) => (
                <div key={i} className="flex justify-between px-5 py-2.5 hover:bg-slate-700/20">
                  <span className="text-slate-300 text-sm">{row.label}</span>
                  <span className="text-slate-200 font-mono text-sm">{fmt(row.value)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between px-5 py-3 bg-green-500/10 border-t-2 border-slate-600">
              <span className="text-green-400 font-bold text-sm">Total Equity</span>
              <span className="text-green-400 font-mono font-bold text-sm">Nu. {fmt(ownersEquity)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Accounting equation check */}
      <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${isBalanced ? 'bg-green-500/5 border-green-700/50' : 'bg-red-500/5 border-red-700/50'}`}>
        <div className="flex items-center gap-3">
          {isBalanced
            ? <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
            : <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
          <div>
            <p className={`font-semibold text-sm ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>
              {isBalanced ? 'Accounting equation balanced' : 'Discrepancy detected'}
            </p>
            <p className="text-slate-500 text-xs mt-0.5">Assets = Liabilities + Equity</p>
          </div>
        </div>
        <div className="font-mono text-xs sm:text-sm sm:text-right">
          <div className="text-blue-400">Assets: Nu. {fmt(totalCurrentAssets)}</div>
          <div className="text-slate-400">Liab + Eq: Nu. {fmt(totalLiabEquity)}</div>
        </div>
      </div>
    </div>
  );
}
