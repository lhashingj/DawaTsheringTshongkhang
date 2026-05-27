'use client';

import { useState } from 'react';
import { AccountingNav } from '@/components/accounting/AccountingNav';
import { TrialBalance } from '@/components/accounting/TrialBalance';
import { TaxReport } from '@/components/accounting/TaxReport';
import { ProfitLoss } from '@/components/accounting/ProfitLoss';
import { BalanceSheet } from '@/components/accounting/BalanceSheet';
import { ExpenseManager } from '@/components/accounting/ExpenseManager';
import {
  Scale, FileText, Download, TrendingUp, LayoutList, Receipt,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/accounting-db';

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'financial-statements' | 'expenses' | 'trial-balance' | 'tax-report' | 'export';
type FinStmt = 'pnl' | 'balance-sheet';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'financial-statements', label: 'Financial Statements', icon: TrendingUp },
  { id: 'expenses',             label: 'Expenses',             icon: LayoutList  },
  { id: 'trial-balance',        label: 'Trial Balance',        icon: Scale       },
  { id: 'tax-report',           label: 'Tax Records',          icon: Receipt     },
  { id: 'export',               label: 'Full Export',          icon: Download    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Full Export tab ───────────────────────────────────────────────────────────
function FullExport() {
  const sales     = useLiveQuery(() => db.sales.orderBy('timestamp').toArray(),     []);
  const purchases = useLiveQuery(() => db.purchases.orderBy('timestamp').toArray(), []);
  const parties   = useLiveQuery(() => db.parties.orderBy('name').toArray(),        []);
  const inventory = useLiveQuery(() => db.inventory.orderBy('description').toArray(), []);
  const expenses  = useLiveQuery(() => db.expenses.orderBy('date').toArray(),       []);

  async function exportAll() {
    if (!sales || !purchases || !parties || !inventory || !expenses) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Sales
    const wsSales = XLSX.utils.aoa_to_sheet([
      ['Invoice No.', 'Date', 'Customer', 'Phone', 'TPN', 'Gross', 'GST%', 'GST Amt', 'Net', 'Items'],
      ...sales.map(s => [
        s.invoiceNo, fmtDate(s.timestamp), s.customerName || '', s.customerPhone || '', s.customerTPN || '',
        s.grossAmount, s.gstRate, s.gstAmount, s.netAmount,
        s.items.map(i => `${i.description} (${i.qty} ${i.unit} @ ${i.rate})`).join('; '),
      ]),
    ]);
    wsSales['!cols'] = [10, 12, 25, 15, 15, 12, 6, 10, 12, 60].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsSales, 'Sales Ledger');

    // Purchases
    const wsPurchases = XLSX.utils.aoa_to_sheet([
      ['PO No.', 'Date', 'Supplier', 'Phone', 'TPN', 'Gross', 'GST%', 'GST Amt', 'Net', 'Items'],
      ...purchases.map(p => [
        p.purchaseOrderNo, fmtDate(p.timestamp), p.supplierName, p.supplierPhone || '', p.supplierTPN || '',
        p.grossAmount, p.gstRate, p.gstAmount, p.netAmount,
        p.items.map(i => `${i.description} (${i.qty} ${i.unit} @ ${i.rate})`).join('; '),
      ]),
    ]);
    wsPurchases['!cols'] = [10, 12, 25, 15, 15, 12, 6, 10, 12, 60].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsPurchases, 'Purchase Ledger');

    // Expenses
    const wsExpenses = XLSX.utils.aoa_to_sheet([
      ['Date', 'Category', 'Description', 'Reference', 'Amount (Nu.)', 'Notes'],
      ...expenses.map(e => [
        fmtDate(e.date), e.category, e.description, e.reference || '', e.amount, e.notes || '',
      ]),
    ]);
    wsExpenses['!cols'] = [12, 15, 35, 18, 14, 30].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');

    // Parties
    const wsParties = XLSX.utils.aoa_to_sheet([
      ['Type', 'Name', 'Phone', 'Email', 'TPN', 'Outstanding Balance'],
      ...parties.map(p => [p.partyType, p.name, p.phone || '', p.email || '', p.tpn || '', p.outstandingBalance]),
    ]);
    wsParties['!cols'] = [12, 25, 15, 25, 15, 18].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsParties, 'Party Directory');

    // Inventory
    const wsInv = XLSX.utils.aoa_to_sheet([
      ['Code', 'Description', 'Unit', 'Base Rate', 'Stock Qty', 'Reorder Level', 'Stock Value', 'Last Updated'],
      ...inventory.map(i => [
        i.itemCode || '', i.description, i.unit, i.baseRate, i.stockQty, i.reorderLevel,
        parseFloat((i.stockQty * i.baseRate).toFixed(2)), fmtDate(i.lastUpdated),
      ]),
    ]);
    wsInv['!cols'] = [10, 35, 8, 12, 12, 14, 14, 15].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsInv, 'Inventory');

    // P&L summary sheet
    const grossRevenue   = sales.reduce((s, r) => s + r.grossAmount, 0);
    const gstCollected   = sales.reduce((s, r) => s + r.gstAmount, 0);
    const cogs           = purchases.reduce((s, r) => s + r.grossAmount, 0);
    const gstInput       = purchases.reduce((s, r) => s + r.gstAmount, 0);
    const totalExp       = expenses.reduce((s, e) => s + e.amount, 0);
    const grossProfit    = grossRevenue - cogs;
    const netProfit      = grossProfit - totalExp;
    const wsPnL = XLSX.utils.aoa_to_sheet([
      ['Dawa Tshering Tshongkhang — P&L Summary'],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['Gross Revenue (excl. GST)', grossRevenue],
      ['GST Collected', gstCollected],
      ['Cost of Goods Sold (COGS)', cogs],
      ['Gross Profit', grossProfit],
      ['Total Operating Expenses', totalExp],
      ['Net Profit / (Loss)', netProfit],
      [],
      ['GST Input Credit', gstInput],
      ['Net GST Payable', Math.max(0, gstCollected - gstInput)],
    ]);
    wsPnL['!cols'] = [{ wch: 35 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsPnL, 'P&L Summary');

    XLSX.writeFile(wb, `DTT_Accounts_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportPnL() {
    if (!sales || !purchases || !expenses) return;
    const XLSX = await import('xlsx');
    const grossRevenue = sales.reduce((s, r) => s + r.grossAmount, 0);
    const gstCollected = sales.reduce((s, r) => s + r.gstAmount, 0);
    const cogs         = purchases.reduce((s, r) => s + r.grossAmount, 0);
    const gstInput     = purchases.reduce((s, r) => s + r.gstAmount, 0);
    const totalExp     = expenses.reduce((s, e) => s + e.amount, 0);
    const grossProfit  = grossRevenue - cogs;
    const netProfit    = grossProfit - totalExp;

    const expByCat: Record<string, number> = {};
    for (const e of expenses) expByCat[e.category] = (expByCat[e.category] || 0) + e.amount;

    const ws = XLSX.utils.aoa_to_sheet([
      ['Dawa Tshering Tshongkhang, Paro, Bhutan'],
      ['Profit & Loss Statement — All Time'],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['REVENUE', ''],
      ['Gross Sales Revenue (excl. GST)', grossRevenue],
      ['GST Collected (5%)', gstCollected],
      ['Total Invoiced (incl. GST)', grossRevenue + gstCollected],
      [],
      ['COST OF GOODS SOLD', ''],
      ['Total Purchases (excl. GST)', cogs],
      [],
      ['GROSS PROFIT', grossProfit],
      [],
      ['OPERATING EXPENSES', ''],
      ...Object.entries(expByCat).map(([cat, amt]) => [cat, amt]),
      ['Total Expenses', totalExp],
      [],
      ['NET PROFIT / (LOSS)', netProfit],
      [],
      ['GST Summary', ''],
      ['GST Collected', gstCollected],
      ['GST Input Credit', gstInput],
      ['Net GST Payable', Math.max(0, gstCollected - gstInput)],
    ]);
    ws['!cols'] = [{ wch: 38 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Profit & Loss');
    XLSX.writeFile(wb, `ProfitLoss_AllTime_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportBalanceSheet() {
    if (!sales || !purchases || !parties || !inventory || !expenses) return;
    const XLSX = await import('xlsx');
    const totalSalesNet    = sales.reduce((s, r) => s + r.netAmount, 0);
    const totalPurchNet    = purchases.reduce((s, r) => s + r.netAmount, 0);
    const totalExp         = expenses.reduce((s, e) => s + e.amount, 0);
    const cash             = Math.max(0, totalSalesNet - totalPurchNet - totalExp);
    const ar               = parties.filter(p => p.outstandingBalance > 0).reduce((s, p) => s + p.outstandingBalance, 0);
    const invVal           = inventory.reduce((s, i) => s + i.stockQty * i.baseRate, 0);
    const gstInput         = purchases.reduce((s, r) => s + r.gstAmount, 0);
    const totalAssets      = cash + ar + invVal + gstInput;
    const ap               = Math.abs(parties.filter(p => p.outstandingBalance < 0).reduce((s, p) => s + p.outstandingBalance, 0));
    const gstCollected     = sales.reduce((s, r) => s + r.gstAmount, 0);
    const netGST           = Math.max(0, gstCollected - gstInput);
    const totalLiabilities = ap + netGST;
    const equity           = totalAssets - totalLiabilities;
    const grossRevenue     = sales.reduce((s, r) => s + r.grossAmount, 0);
    const cogs             = purchases.reduce((s, r) => s + r.grossAmount, 0);
    const retainedEarnings = grossRevenue - cogs - totalExp;

    const ws = XLSX.utils.aoa_to_sheet([
      ['Dawa Tshering Tshongkhang, Paro, Bhutan'],
      ['Balance Sheet'],
      [`As of: ${fmtDate(new Date())}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['ASSETS', ''],
      ['Cash / Bank (net)', cash],
      ['Accounts Receivable', ar],
      ['Inventory at Cost', invVal],
      ['GST Input Credit', gstInput],
      ['Total Assets', totalAssets],
      [],
      ['LIABILITIES', ''],
      ['Accounts Payable', ap],
      ['GST Payable (Net)', netGST],
      ['Total Liabilities', totalLiabilities],
      [],
      ["OWNER'S EQUITY", ''],
      ['Retained Earnings', retainedEarnings],
      ["Total Equity", equity],
      [],
      ['Total Liabilities + Equity', totalLiabilities + equity],
    ]);
    ws['!cols'] = [{ wch: 35 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');
    XLSX.writeFile(wb, `BalanceSheet_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (!sales || !purchases || !parties || !inventory || !expenses) {
    return <div className="text-slate-400 text-sm p-8 text-center">Loading data…</div>;
  }

  const totalSalesNet    = sales.reduce((s, r) => s + r.netAmount, 0);
  const totalPurchaseNet = purchases.reduce((s, r) => s + r.netAmount, 0);
  const totalExpenses    = expenses.reduce((s, e) => s + e.amount, 0);
  const invVal           = inventory.reduce((s, i) => s + i.stockQty * i.baseRate, 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Sales Records',     value: sales.length,     sub: `Nu. ${totalSalesNet.toFixed(0)} total`,     color: 'text-orange-400' },
          { label: 'Purchase Records',  value: purchases.length, sub: `Nu. ${totalPurchaseNet.toFixed(0)} total`,  color: 'text-blue-400'   },
          { label: 'Expense Records',   value: expenses.length,  sub: `Nu. ${totalExpenses.toFixed(0)} total`,     color: 'text-red-400'    },
          { label: 'Inventory Value',   value: inventory.length, sub: `Nu. ${invVal.toFixed(0)} stock value`,      color: 'text-green-400'  },
        ].map(c => (
          <div key={c.label} className="bg-slate-700/50 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs mb-1">{c.label}</p>
            <p className={`font-bold text-2xl font-mono ${c.color}`}>{c.value}</p>
            <p className="text-slate-500 text-xs mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Statement-specific exports */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          {
            title: 'Profit & Loss (.xlsx)',
            desc: 'Revenue, COGS, expenses, net profit with GST summary.',
            action: exportPnL,
            btnLabel: 'Download P&L',
            color: 'hover:border-green-500 hover:text-green-400',
          },
          {
            title: 'Balance Sheet (.xlsx)',
            desc: 'Assets, liabilities, equity as of today.',
            action: exportBalanceSheet,
            btnLabel: 'Download Balance Sheet',
            color: 'hover:border-blue-500 hover:text-blue-400',
          },
          {
            title: 'Full Ledgers Workbook (.xlsx)',
            desc: 'All 5 sheets: Sales, Purchases, Expenses, Parties, Inventory + P&L summary.',
            action: exportAll,
            btnLabel: 'Download All Ledgers',
            color: 'hover:border-orange-500 hover:text-orange-400',
          },
        ].map(card => (
          <div key={card.title} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h4 className="text-white font-semibold text-sm mb-1">{card.title}</h4>
            <p className="text-slate-400 text-xs mb-4 leading-relaxed">{card.desc}</p>
            <button
              onClick={card.action}
              className={`flex items-center gap-2 border border-slate-600 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full justify-center ${card.color}`}
            >
              <Download className="w-4 h-4" />
              {card.btnLabel}
            </button>
          </div>
        ))}
      </div>

      {/* Print / PDF */}
      <div className="bg-slate-700/30 border border-slate-700 rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h4 className="text-slate-300 font-medium text-sm">Print / PDF</h4>
          <p className="text-slate-500 text-xs mt-0.5">Use the Financial Statements tab, then click the PDF button there for a formatted printout.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 border border-slate-600 hover:border-blue-500 text-slate-300 hover:text-blue-400 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <FileText className="w-4 h-4" /> Print This Page
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [tab, setTab]       = useState<Tab>('financial-statements');
  const [finStmt, setFinStmt] = useState<FinStmt>('pnl');

  return (
    <div className="min-h-screen bg-slate-900">
      <AccountingNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-white text-2xl font-bold">Reports &amp; Export</h1>
          <p className="text-slate-400 text-sm mt-1">
            Financial statements, expense tracking, trial balance, and data exports.
          </p>
        </div>

        {/* Main tab bar */}
        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 mb-6 overflow-x-auto no-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${
                tab === id
                  ? 'bg-orange-500 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Financial Statements: sub-selector */}
        {tab === 'financial-statements' && (
          <div className="flex gap-1 bg-slate-800/60 border border-slate-700/60 rounded-lg p-1 mb-6 w-fit">
            {([
              { id: 'pnl' as FinStmt,           label: 'Profit & Loss'  },
              { id: 'balance-sheet' as FinStmt,  label: 'Balance Sheet'  },
            ]).map(s => (
              <button
                key={s.id}
                onClick={() => setFinStmt(s.id)}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                  finStmt === s.id
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div>
          {tab === 'financial-statements' && finStmt === 'pnl'          && <ProfitLoss />}
          {tab === 'financial-statements' && finStmt === 'balance-sheet' && <BalanceSheet />}
          {tab === 'expenses'             && <ExpenseManager />}
          {tab === 'trial-balance'        && <TrialBalance />}
          {tab === 'tax-report'           && <TaxReport />}
          {tab === 'export'               && <FullExport />}
        </div>
      </div>
    </div>
  );
}
