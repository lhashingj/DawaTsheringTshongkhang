'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/accounting-db';
import { Scale, CheckCircle, AlertCircle, Download } from 'lucide-react';

interface TrialRow {
  account: string;
  category: string;
  debit: number;
  credit: number;
}

export function TrialBalance() {
  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const purchases = useLiveQuery(() => db.purchases.toArray(), []);
  const parties = useLiveQuery(() => db.parties.toArray(), []);

  if (!sales || !purchases || !parties) {
    return <div className="text-slate-400 text-sm p-8 text-center">Computing trial balance…</div>;
  }

  const totalSalesGross = sales.reduce((s, r) => s + r.grossAmount, 0);
  const totalSalesGST = sales.reduce((s, r) => s + r.gstAmount, 0);
  const totalSalesNet = sales.reduce((s, r) => s + r.netAmount, 0);

  const totalPurchaseGross = purchases.reduce((s, r) => s + r.grossAmount, 0);
  const totalPurchaseGST = purchases.reduce((s, r) => s + r.gstAmount, 0);
  const totalPurchaseNet = purchases.reduce((s, r) => s + r.netAmount, 0);

  const totalReceivable = parties.filter(p => p.outstandingBalance > 0).reduce((s, p) => s + p.outstandingBalance, 0);
  const totalPayable = Math.abs(parties.filter(p => p.outstandingBalance < 0).reduce((s, p) => s + p.outstandingBalance, 0));

  // Cash collected = net sales (simplified: all sales paid in cash unless in receivable)
  const cashFromSales = totalSalesNet - totalReceivable;
  const cashToSuppliers = totalPurchaseNet - totalPayable;

  const rows: TrialRow[] = [
    { account: 'Sales Revenue (Gross)', category: 'Revenue', debit: 0, credit: totalSalesGross },
    { account: 'GST Collected on Sales', category: 'Liability', debit: 0, credit: totalSalesGST },
    { account: 'Cost of Purchases (Gross)', category: 'Expense', debit: totalPurchaseGross, credit: 0 },
    { account: 'GST Paid on Purchases', category: 'Asset', debit: totalPurchaseGST, credit: 0 },
    { account: 'Accounts Receivable', category: 'Asset', debit: totalReceivable, credit: 0 },
    { account: 'Accounts Payable', category: 'Liability', debit: 0, credit: totalPayable },
    { account: 'Cash / Bank Receipts', category: 'Asset', debit: Math.max(0, cashFromSales), credit: 0 },
    { account: 'Cash / Bank Payments', category: 'Asset', debit: 0, credit: Math.max(0, cashToSuppliers) },
  ].filter(r => r.debit > 0 || r.credit > 0);

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.01;

  const netGSTLiability = totalSalesGST - totalPurchaseGST;

  async function exportExcel() {
    const XLSX = await import('xlsx');
    const data = [
      ['Trial Balance — DTT Hardware Accounting', '', '', ''],
      ['Generated:', new Date().toLocaleString(), '', ''],
      ['', '', '', ''],
      ['Account', 'Category', 'Debit (Nu.)', 'Credit (Nu.)'],
      ...rows.map(r => [r.account, r.category, r.debit || '', r.credit || '']),
      ['', '', '', ''],
      ['TOTALS', '', totalDebit.toFixed(2), totalCredit.toFixed(2)],
      ['Difference', '', difference.toFixed(2), ''],
      ['', '', '', ''],
      ['GST Summary', '', '', ''],
      ['GST Collected', '', '', totalSalesGST.toFixed(2)],
      ['GST Input Credit', '', totalPurchaseGST.toFixed(2), ''],
      ['Net GST Liability', '', '', netGSTLiability.toFixed(2)],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance');
    XLSX.writeFile(wb, `TrialBalance_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const CATEGORY_COLORS: Record<string, string> = {
    Revenue: 'text-green-400',
    Expense: 'text-red-400',
    Asset: 'text-blue-400',
    Liability: 'text-yellow-400',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isBalanced ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            {isBalanced
              ? <CheckCircle className="w-5 h-5 text-green-400" />
              : <AlertCircle className="w-5 h-5 text-red-400" />}
          </div>
          <div>
            <h3 className="text-white font-semibold">Trial Balance</h3>
            <p className={`text-sm ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>
              {isBalanced ? 'Accounts balance — no discrepancy' : `Discrepancy: Nu. ${difference.toFixed(2)}`}
            </p>
          </div>
        </div>
        <button onClick={exportExcel} className="flex items-center gap-2 border border-slate-600 hover:border-orange-500 text-slate-300 hover:text-orange-400 px-4 py-2 rounded-lg text-sm transition-colors">
          <Download className="w-4 h-4" /> Export Excel
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Sales', value: totalSalesNet, color: 'green' },
          { label: 'Total Purchases', value: totalPurchaseNet, color: 'red' },
          { label: 'Net GST Liability', value: netGSTLiability, color: 'yellow' },
          { label: 'Net Profit (Gross)', value: totalSalesGross - totalPurchaseGross, color: 'blue' },
        ].map(card => (
          <div key={card.label} className="bg-slate-700/50 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-xs mb-1">{card.label}</p>
            <p className={`font-mono font-bold text-lg ${card.value >= 0 ? `text-${card.color}-400` : 'text-red-400'}`}>
              Nu. {card.value.toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Account</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Category</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Debit (Nu.)</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Credit (Nu.)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/30">
                <td className="px-4 py-3 text-white">{row.account}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${CATEGORY_COLORS[row.category] || 'text-slate-400'}`}>{row.category}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono">{row.debit > 0 ? <span className="text-slate-300">{row.debit.toFixed(2)}</span> : <span className="text-slate-600">—</span>}</td>
                <td className="px-4 py-3 text-right font-mono">{row.credit > 0 ? <span className="text-slate-300">{row.credit.toFixed(2)}</span> : <span className="text-slate-600">—</span>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-500 bg-slate-700/50">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-white font-bold">TOTAL</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-orange-400">{totalDebit.toFixed(2)}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-orange-400">{totalCredit.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={2} className="px-4 py-2 text-slate-400 text-sm">Difference</td>
              <td colSpan={2} className={`px-4 py-2 text-right font-mono text-sm font-semibold ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>
                {difference.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* GST Reconciliation */}
      <div className="bg-slate-700/30 border border-slate-700 rounded-xl p-5">
        <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Scale className="w-4 h-4 text-orange-400" /> GST Reconciliation
        </h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <p className="text-slate-400 text-xs mb-1">GST Collected (Output)</p>
            <p className="text-yellow-400 font-mono font-bold text-lg">Nu. {totalSalesGST.toFixed(2)}</p>
          </div>
          <div className="text-center border-x border-slate-600">
            <p className="text-slate-400 text-xs mb-1">GST Input Credit</p>
            <p className="text-blue-400 font-mono font-bold text-lg">Nu. {totalPurchaseGST.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400 text-xs mb-1">Net GST Payable to Govt</p>
            <p className={`font-mono font-bold text-lg ${netGSTLiability >= 0 ? 'text-red-400' : 'text-green-400'}`}>
              Nu. {netGSTLiability.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
