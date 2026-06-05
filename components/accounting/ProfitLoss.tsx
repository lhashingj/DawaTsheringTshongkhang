'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, SaleRecord, PurchaseRecord, ExpenseRecord, ExpenseCategory } from '@/lib/accounting-db';
import { Download, FileText, TrendingUp, TrendingDown } from 'lucide-react';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Rent', 'Utilities', 'Salaries', 'Transport', 'Fuel',
  'Maintenance', 'Stationery', 'Communication', 'Other',
];

function fmt(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function thisMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  return { from, to };
}

interface PnLRow {
  label: string;
  amount: number;
  indent?: number;
  bold?: boolean;
  dividerAbove?: boolean;
  positive?: boolean;
}

export function ProfitLoss() {
  const defaultRange = thisMonthRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);

  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const purchases = useLiveQuery(() => db.purchases.toArray(), []);
  const expenses = useLiveQuery(() => db.expenses.toArray(), []);
  const glEntries = useLiveQuery(() => db.generalLedger.toArray(), []);

  const { filteredSales, filteredPurchases, filteredExpenses, filteredGLCOGS } = useMemo(() => {
    const fromDate = from ? new Date(from) : new Date(0);
    const toDate = to ? new Date(to + 'T23:59:59') : new Date('2099-12-31');
    return {
      filteredSales: (sales || []).filter(s => {
        const d = new Date(s.timestamp);
        return d >= fromDate && d <= toDate;
      }),
      filteredPurchases: (purchases || []).filter(p => {
        const d = new Date(p.timestamp);
        return d >= fromDate && d <= toDate;
      }),
      filteredExpenses: (expenses || []).filter(e => {
        const d = new Date(e.date);
        return d >= fromDate && d <= toDate;
      }),
      filteredGLCOGS: (glEntries || []).filter(e => {
        const d = new Date(e.timestamp);
        return e.account === 'Cost of Goods Sold' && d >= fromDate && d <= toDate;
      }),
    };
  }, [sales, purchases, expenses, glEntries, from, to]);

  const grossRevenue = filteredSales.reduce((s, r) => s + r.grossAmount, 0);
  const gstCollected = filteredSales.reduce((s, r) => s + r.gstAmount, 0);
  // Perpetual COGS: sum GL "Cost of Goods Sold" debits posted at time of each sale
  const cogs = filteredGLCOGS.reduce((s, e) => s + e.debit, 0);
  const grossProfit = grossRevenue - cogs;
  // Use NET expense (strip claimable input tax — that goes to GST Input Credit asset)
  const expensesByCategory = EXPENSE_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = filteredExpenses
      .filter(e => e.category === cat)
      .reduce((s, e) => s + e.amount - (e.inputTaxAmount ?? 0), 0);
    return acc;
  }, {});
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount - (e.inputTaxAmount ?? 0), 0);
  const netProfit = grossProfit - totalExpenses;
  const gstInputCredit = filteredPurchases.reduce((s, r) => s + r.gstAmount, 0)
    + filteredExpenses.reduce((s, e) => s + (e.inputTaxAmount ?? 0), 0);
  const netGSTPayable = gstCollected - gstInputCredit;

  const rows: PnLRow[] = [
    { label: 'GROSS REVENUE (Sales excl. GST)', amount: grossRevenue, bold: true, positive: true },
    { label: `  + GST Collected (5%)`, amount: gstCollected, indent: 1 },
    { label: `  Total Invoiced (incl. GST)`, amount: grossRevenue + gstCollected, indent: 1 },
    { label: 'COST OF GOODS SOLD (Purchases excl. GST)', amount: cogs, bold: true, dividerAbove: true },
    { label: 'GROSS PROFIT', amount: grossProfit, bold: true, dividerAbove: true, positive: grossProfit >= 0 },
    { label: 'OPERATING EXPENSES', amount: totalExpenses, bold: true, dividerAbove: true },
    ...EXPENSE_CATEGORIES
      .filter(cat => expensesByCategory[cat] > 0)
      .map(cat => ({ label: `  ${cat}`, amount: expensesByCategory[cat], indent: 1 })),
    { label: 'NET PROFIT / (LOSS)', amount: netProfit, bold: true, dividerAbove: true, positive: netProfit >= 0 },
  ];

  async function exportExcel() {
    const XLSX = await import('xlsx');
    const company = 'Dawa Tshering Tshongkhang, Paro, Bhutan';
    const period = `${from ? fmtDate(from) : 'All'} to ${to ? fmtDate(to) : 'All'}`;
    const data: (string | number)[][] = [
      [company],
      ['Profit & Loss Statement'],
      [`Period: ${period}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['', 'Amount (Nu.)'],
      ['REVENUE', ''],
      ['Gross Sales Revenue (excl. GST)', grossRevenue],
      ['GST Collected (5%)', gstCollected],
      ['Total Invoiced (incl. GST)', grossRevenue + gstCollected],
      [],
      ['COST OF GOODS SOLD', ''],
      ['Cost of Goods Sold (at purchase cost)', cogs],
      [],
      ['GROSS PROFIT', grossProfit],
      [],
      ['OPERATING EXPENSES', ''],
      ...EXPENSE_CATEGORIES
        .filter(cat => expensesByCategory[cat] > 0)
        .map(cat => [cat, expensesByCategory[cat]]),
      ['Total Operating Expenses', totalExpenses],
      [],
      ['NET PROFIT / (LOSS)', netProfit],
      [],
      ['GST SUMMARY', ''],
      ['GST Collected (Output Tax)', gstCollected],
      ['GST Input Credit (Purchases)', gstInputCredit],
      ['Net GST Payable to Govt', netGSTPayable],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 40 }, { wch: 18 }];
    // Bold the totals rows by cell styling (basic)
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Profit & Loss');
    XLSX.writeFile(wb, `PnL_${from}_to_${to}.xlsx`);
  }

  function printPDF() { window.print(); }

  if (!sales || !purchases || !expenses || !glEntries) {
    return <div className="text-slate-400 text-sm p-8 text-center">Computing P&L…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="flex flex-wrap items-end gap-3 bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div>
          <label className="block text-slate-400 text-xs mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
        </div>
        <div className="flex gap-2 pb-0.5">
          {[
            { label: 'This Month', ...thisMonthRange() },
            {
              label: 'This Year',
              from: `${new Date().getFullYear()}-01-01`,
              to: `${new Date().getFullYear()}-12-31`,
            },
            { label: 'All Time', from: '2012-01-01', to: new Date().toISOString().split('T')[0] },
          ].map(p => (
            <button key={p.label} onClick={() => { setFrom(p.from); setTo(p.to); }}
              className="text-xs px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
            >{p.label}</button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto pb-0.5">
          <button onClick={exportExcel} className="flex items-center gap-1.5 border border-slate-600 hover:border-green-500 text-slate-300 hover:text-green-400 px-4 py-2 rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={printPDF} className="flex items-center gap-1.5 border border-slate-600 hover:border-blue-500 text-slate-300 hover:text-blue-400 px-4 py-2 rounded-lg text-sm transition-colors">
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Gross Revenue', value: grossRevenue, color: 'text-green-400', icon: TrendingUp },
          { label: 'COGS', value: cogs, color: 'text-red-400', icon: TrendingDown },
          { label: 'Gross Profit', value: grossProfit, color: grossProfit >= 0 ? 'text-blue-400' : 'text-red-400', icon: TrendingUp },
          { label: 'Net Profit', value: netProfit, color: netProfit >= 0 ? 'text-orange-400' : 'text-red-400', icon: netProfit >= 0 ? TrendingUp : TrendingDown },
        ].map(c => (
          <div key={c.label} className="bg-slate-700/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className={`w-4 h-4 ${c.color}`} />
              <p className="text-slate-400 text-xs">{c.label}</p>
            </div>
            <p className={`font-mono font-bold text-lg ${c.color}`}>Nu. {fmt(c.value)}</p>
          </div>
        ))}
      </div>

      {/* P&L Statement table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h3 className="text-white font-bold text-base">Profit &amp; Loss Statement</h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Period: {from ? fmtDate(from) : 'All'} — {to ? fmtDate(to) : 'All'} &nbsp;|&nbsp; {filteredSales.length} invoices · {filteredPurchases.length} purchases · {filteredExpenses.length} expenses
          </p>
        </div>
        <div className="divide-y divide-slate-700/60">
          {rows.map((row, i) => (
            <div
              key={i}
              className={`flex justify-between items-center px-5 py-2.5 ${row.dividerAbove ? 'border-t-2 border-slate-500 mt-0' : ''} ${row.bold ? 'bg-slate-700/30' : 'hover:bg-slate-700/20'}`}
              style={{ paddingLeft: row.indent ? `${1.25 + row.indent * 1}rem` : undefined }}
            >
              <span className={row.bold ? 'text-white font-semibold text-sm' : 'text-slate-300 text-sm'}>{row.label}</span>
              <span className={`font-mono text-sm ${row.bold ? (row.positive === undefined ? 'text-slate-200' : row.positive ? 'text-green-400' : 'text-red-400') : 'text-slate-400'} ${row.bold ? 'font-bold' : ''}`}>
                {row.amount < 0 ? `(${fmt(Math.abs(row.amount))})` : fmt(row.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* GST Summary */}
      <div className="bg-slate-700/30 border border-slate-700 rounded-xl p-5">
        <h4 className="text-white font-semibold text-sm mb-4">GST Tax Liability (Isolated Account)</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <p className="text-slate-400 text-xs mb-1">GST Collected (Output)</p>
            <p className="text-yellow-400 font-mono font-bold text-lg">Nu. {fmt(gstCollected)}</p>
          </div>
          <div className="text-center border-x border-slate-600">
            <p className="text-slate-400 text-xs mb-1">GST Input Credit</p>
            <p className="text-blue-400 font-mono font-bold text-lg">Nu. {fmt(gstInputCredit)}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400 text-xs mb-1">Net GST Payable to Govt</p>
            <p className={`font-mono font-bold text-lg ${netGSTPayable >= 0 ? 'text-red-400' : 'text-green-400'}`}>Nu. {fmt(netGSTPayable)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
