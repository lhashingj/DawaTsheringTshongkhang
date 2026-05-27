'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, SaleRecord, PurchaseRecord } from '@/lib/accounting-db';
import { Download, FileText, Calendar } from 'lucide-react';

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtNum(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}
function today() {
  return new Date().toISOString().split('T')[0];
}

export function TaxReport() {
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [showDetailSales, setShowDetailSales] = useState(false);
  const [showDetailPurchases, setShowDetailPurchases] = useState(false);

  const allSales = useLiveQuery(() => db.sales.orderBy('timestamp').toArray(), []);
  const allPurchases = useLiveQuery(() => db.purchases.orderBy('timestamp').toArray(), []);

  if (!allSales || !allPurchases) return <div className="text-slate-400 text-sm p-8 text-center">Loading tax data…</div>;

  const fromDate = new Date(from);
  const toDate = new Date(to + 'T23:59:59');

  const filteredSales = allSales.filter(s => {
    const d = new Date(s.timestamp);
    return d >= fromDate && d <= toDate;
  });
  const filteredPurchases = allPurchases.filter(p => {
    const d = new Date(p.timestamp);
    return d >= fromDate && d <= toDate;
  });

  const salesGross = filteredSales.reduce((s, r) => s + r.grossAmount, 0);
  const salesGST = filteredSales.reduce((s, r) => s + r.gstAmount, 0);
  const salesNet = filteredSales.reduce((s, r) => s + r.netAmount, 0);

  const purchaseGross = filteredPurchases.reduce((s, r) => s + r.grossAmount, 0);
  const purchaseGST = filteredPurchases.reduce((s, r) => s + r.gstAmount, 0);
  const purchaseNet = filteredPurchases.reduce((s, r) => s + r.netAmount, 0);

  const netGSTLiability = salesGST - purchaseGST;

  async function exportExcel() {
    const XLSX = await import('xlsx');
    const header = `Tax Report: ${from} to ${to} — Dawa Tshering Shop, Paro`;
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      [header],
      [],
      ['SALES TAX SUMMARY'],
      ['Metric', 'Amount (Nu.)'],
      ['Total Transactions', filteredSales.length],
      ['Gross Sales (excl. GST)', salesGross.toFixed(2)],
      ['GST Collected @ 5%', salesGST.toFixed(2)],
      ['Total Invoiced (incl. GST)', salesNet.toFixed(2)],
      [],
      ['PURCHASE TAX SUMMARY'],
      ['Metric', 'Amount (Nu.)'],
      ['Total Transactions', filteredPurchases.length],
      ['Gross Purchases (excl. GST)', purchaseGross.toFixed(2)],
      ['GST Input Credit @ 5%', purchaseGST.toFixed(2)],
      ['Total Paid (incl. GST)', purchaseNet.toFixed(2)],
      [],
      ['GST PAYABLE RECONCILIATION'],
      ['GST Collected (Output Tax)', salesGST.toFixed(2)],
      ['GST Input Credit', purchaseGST.toFixed(2)],
      ['Net GST Payable to Government', netGSTLiability.toFixed(2)],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 40 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tax Summary');

    // Sales detail sheet
    const salesData = [
      ['Invoice No.', 'Date', 'Customer', 'Gross Amount', 'GST 5%', 'Net Amount'],
      ...filteredSales.map(s => [s.invoiceNo, fmtDate(s.timestamp), s.customerName || 'Cash', s.grossAmount.toFixed(2), s.gstAmount.toFixed(2), s.netAmount.toFixed(2)]),
      [],
      ['', '', 'TOTAL', salesGross.toFixed(2), salesGST.toFixed(2), salesNet.toFixed(2)],
    ];
    const wsSales = XLSX.utils.aoa_to_sheet(salesData);
    wsSales['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsSales, 'Sales Detail');

    // Purchases detail sheet
    const purchasesData = [
      ['PO No.', 'Date', 'Supplier', 'Gross Amount', 'GST 5%', 'Net Amount'],
      ...filteredPurchases.map(p => [p.purchaseOrderNo, fmtDate(p.timestamp), p.supplierName, p.grossAmount.toFixed(2), p.gstAmount.toFixed(2), p.netAmount.toFixed(2)]),
      [],
      ['', '', 'TOTAL', purchaseGross.toFixed(2), purchaseGST.toFixed(2), purchaseNet.toFixed(2)],
    ];
    const wsPurchases = XLSX.utils.aoa_to_sheet(purchasesData);
    wsPurchases['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsPurchases, 'Purchases Detail');

    XLSX.writeFile(wb, `TaxReport_${from}_to_${to}.xlsx`);
  }

  async function exportPDF() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-slate-400 text-xs mb-1"><Calendar className="inline w-3 h-3 mr-1" />From</label>
          <input type="date" className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">To</label>
          <input type="date" className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="flex gap-2 pb-px">
          {[
            { label: 'This Month', fn: () => { setFrom(startOfMonth()); setTo(today()); } },
            { label: 'This Year', fn: () => { setFrom(`${new Date().getFullYear()}-01-01`); setTo(today()); } },
            { label: 'All Time', fn: () => { setFrom('2020-01-01'); setTo(today()); } },
          ].map(p => (
            <button key={p.label} onClick={p.fn} className="border border-slate-600 hover:border-orange-500 text-slate-400 hover:text-orange-400 px-3 py-2 rounded-lg text-xs transition-colors">{p.label}</button>
          ))}
        </div>
        <div className="flex gap-2 pb-px ml-auto">
          <button onClick={exportExcel} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={exportPDF} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <FileText className="w-4 h-4" /> Print PDF
          </button>
        </div>
      </div>

      <p className="text-slate-400 text-sm">
        Period: <span className="text-white">{from}</span> to <span className="text-white">{to}</span>
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Sales Block */}
        <div className="bg-slate-700/30 border border-slate-700 rounded-xl p-5 col-span-1">
          <h4 className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-4">Sales</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Transactions</span>
              <span className="text-white font-semibold">{filteredSales.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Gross (excl. GST)</span>
              <span className="text-white font-mono">Nu. {fmtNum(salesGross)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <span className="text-yellow-400 text-sm font-medium">GST Collected @ 5%</span>
              <span className="text-yellow-400 font-mono font-bold">Nu. {fmtNum(salesGST)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300 text-sm font-medium">Total Invoiced</span>
              <span className="text-orange-400 font-mono font-bold">Nu. {fmtNum(salesNet)}</span>
            </div>
          </div>
        </div>

        {/* Purchases Block */}
        <div className="bg-slate-700/30 border border-slate-700 rounded-xl p-5 col-span-1">
          <h4 className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-4">Purchases</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Transactions</span>
              <span className="text-white font-semibold">{filteredPurchases.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Gross (excl. GST)</span>
              <span className="text-white font-mono">Nu. {fmtNum(purchaseGross)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <span className="text-blue-400 text-sm font-medium">GST Input Credit @ 5%</span>
              <span className="text-blue-400 font-mono font-bold">Nu. {fmtNum(purchaseGST)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300 text-sm font-medium">Total Paid</span>
              <span className="text-orange-400 font-mono font-bold">Nu. {fmtNum(purchaseNet)}</span>
            </div>
          </div>
        </div>

        {/* GST Payable Block */}
        <div className={`border rounded-xl p-5 col-span-1 ${netGSTLiability >= 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
          <h4 className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-4">GST Liability</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Output Tax (Collected)</span>
              <span className="text-yellow-400 font-mono">Nu. {fmtNum(salesGST)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Input Credit (Paid)</span>
              <span className="text-blue-400 font-mono">Nu. {fmtNum(purchaseGST)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-600 pt-2">
              <span className="text-white font-bold">Net GST Payable</span>
              <span className={`font-mono font-bold text-xl ${netGSTLiability >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                Nu. {fmtNum(netGSTLiability)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {netGSTLiability >= 0 ? '⚠ Amount payable to Government' : '✓ Input credit exceeds output tax'}
            </p>
          </div>
        </div>
      </div>

      {/* Sales Detail Table */}
      <div className="border border-slate-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowDetailSales(p => !p)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/50 text-left hover:bg-slate-700 transition-colors"
        >
          <span className="text-white font-medium text-sm">Sales Detail ({filteredSales.length} records)</span>
          <span className="text-slate-400 text-xs">{showDetailSales ? '▲ Hide' : '▼ Show'}</span>
        </button>
        {showDetailSales && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700">
                <tr>
                  <th className="text-left px-4 py-2 text-slate-400">Invoice</th>
                  <th className="text-left px-4 py-2 text-slate-400">Date</th>
                  <th className="text-left px-4 py-2 text-slate-400">Customer</th>
                  <th className="text-right px-4 py-2 text-slate-400">Gross</th>
                  <th className="text-right px-4 py-2 text-slate-400">GST</th>
                  <th className="text-right px-4 py-2 text-slate-400">Net</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0
                  ? <tr><td colSpan={6} className="text-center py-6 text-slate-500">No sales in this period</td></tr>
                  : filteredSales.map(s => (
                    <tr key={s.id} className="border-t border-slate-700 hover:bg-slate-700/20">
                      <td className="px-4 py-2 text-orange-400 font-mono">{s.invoiceNo}</td>
                      <td className="px-4 py-2 text-slate-300">{fmtDate(s.timestamp)}</td>
                      <td className="px-4 py-2 text-white">{s.customerName || <span className="text-slate-500 italic">Cash</span>}</td>
                      <td className="px-4 py-2 text-right text-slate-300 font-mono">{fmtNum(s.grossAmount)}</td>
                      <td className="px-4 py-2 text-right text-yellow-400 font-mono">{fmtNum(s.gstAmount)}</td>
                      <td className="px-4 py-2 text-right text-orange-400 font-mono font-semibold">{fmtNum(s.netAmount)}</td>
                    </tr>
                  ))}
              </tbody>
              {filteredSales.length > 0 && (
                <tfoot className="border-t-2 border-slate-600 bg-slate-700/30">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-white font-bold text-sm">Total</td>
                    <td className="px-4 py-2 text-right text-slate-300 font-mono font-bold">{fmtNum(salesGross)}</td>
                    <td className="px-4 py-2 text-right text-yellow-400 font-mono font-bold">{fmtNum(salesGST)}</td>
                    <td className="px-4 py-2 text-right text-orange-400 font-mono font-bold">{fmtNum(salesNet)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Purchases Detail Table */}
      <div className="border border-slate-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowDetailPurchases(p => !p)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/50 text-left hover:bg-slate-700 transition-colors"
        >
          <span className="text-white font-medium text-sm">Purchases Detail ({filteredPurchases.length} records)</span>
          <span className="text-slate-400 text-xs">{showDetailPurchases ? '▲ Hide' : '▼ Show'}</span>
        </button>
        {showDetailPurchases && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700">
                <tr>
                  <th className="text-left px-4 py-2 text-slate-400">PO No.</th>
                  <th className="text-left px-4 py-2 text-slate-400">Date</th>
                  <th className="text-left px-4 py-2 text-slate-400">Supplier</th>
                  <th className="text-right px-4 py-2 text-slate-400">Gross</th>
                  <th className="text-right px-4 py-2 text-slate-400">GST</th>
                  <th className="text-right px-4 py-2 text-slate-400">Net</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.length === 0
                  ? <tr><td colSpan={6} className="text-center py-6 text-slate-500">No purchases in this period</td></tr>
                  : filteredPurchases.map(p => (
                    <tr key={p.id} className="border-t border-slate-700 hover:bg-slate-700/20">
                      <td className="px-4 py-2 text-blue-400 font-mono">{p.purchaseOrderNo}</td>
                      <td className="px-4 py-2 text-slate-300">{fmtDate(p.timestamp)}</td>
                      <td className="px-4 py-2 text-white">{p.supplierName}</td>
                      <td className="px-4 py-2 text-right text-slate-300 font-mono">{fmtNum(p.grossAmount)}</td>
                      <td className="px-4 py-2 text-right text-blue-400 font-mono">{fmtNum(p.gstAmount)}</td>
                      <td className="px-4 py-2 text-right text-orange-400 font-mono font-semibold">{fmtNum(p.netAmount)}</td>
                    </tr>
                  ))}
              </tbody>
              {filteredPurchases.length > 0 && (
                <tfoot className="border-t-2 border-slate-600 bg-slate-700/30">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-white font-bold text-sm">Total</td>
                    <td className="px-4 py-2 text-right text-slate-300 font-mono font-bold">{fmtNum(purchaseGross)}</td>
                    <td className="px-4 py-2 text-right text-blue-400 font-mono font-bold">{fmtNum(purchaseGST)}</td>
                    <td className="px-4 py-2 text-right text-orange-400 font-mono font-bold">{fmtNum(purchaseNet)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
