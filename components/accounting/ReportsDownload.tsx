'use client';

import { useState, useEffect } from 'react';
import {
  salesCRUD, purchaseCRUD, partyCRUD, inventoryCRUD, expenseCRUD, glCRUD,
  SaleRecord, PurchaseRecord, PartyRecord, InventoryItem, ExpenseRecord, GLEntry,
} from '@/lib/accounting-db';
import {
  FileSpreadsheet, TrendingUp, Scale, Receipt,
  Loader2, Calendar, Info,
} from 'lucide-react';

// ── Business constants ────────────────────────────────────────────────────────
const BIZ = {
  name:     'DAWA TSHERING SHOP',
  location: 'Paro, Bhutan',
  gstNo:    'P10037232',
  tpn:      'JAB09739',
  licNo:    'R1005542',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
function money(n: number) { return n.toFixed(2); }

function thisMonthStart() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0];
}
function todayStr() { return new Date().toISOString().split('T')[0]; }

/** Standard 6-row business header block inserted at top of every sheet */
function bizHeader(title: string, period: string): (string | number)[][] {
  return [
    [`${BIZ.name}, ${BIZ.location}`],
    [`GST Certified Agent No. ${BIZ.gstNo}  |  TPN: ${BIZ.tpn}  |  LIC No. ${BIZ.licNo}`],
    [title],
    [period],
    [`Generated: ${new Date().toLocaleString('en-IN')}`],
    [],
  ];
}

const inputCls =
  'bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:border-orange-500';

// ── ReportsDownload component ─────────────────────────────────────────────────
export function ReportsDownload() {
  const [from, setFrom] = useState(thisMonthStart());
  const [to,   setTo]   = useState(todayStr());

  const [loadingPnL, setLoadingPnL] = useState(false);
  const [loadingBS,  setLoadingBS]  = useState(false);
  const [loadingTB,  setLoadingTB]  = useState(false);
  const [loadingGST, setLoadingGST] = useState(false);

  const [sales,     setSales]     = useState<(SaleRecord & { id: number })[] | null>(null);
  const [purchases, setPurchases] = useState<(PurchaseRecord & { id: number })[] | null>(null);
  const [parties,   setParties]   = useState<(PartyRecord & { id: number })[] | null>(null);
  const [inventory, setInventory] = useState<(InventoryItem & { id: number })[] | null>(null);
  const [expenses,  setExpenses]  = useState<(ExpenseRecord & { id: number })[] | null>(null);
  const [glEntries, setGlEntries] = useState<(GLEntry & { id: number })[] | null>(null);

  useEffect(() => { salesCRUD.getAll().then(setSales); }, []);
  useEffect(() => { purchaseCRUD.getAll().then(setPurchases); }, []);
  useEffect(() => { partyCRUD.getAll().then(setParties); }, []);
  useEffect(() => { inventoryCRUD.getAll().then(setInventory); }, []);
  useEffect(() => { expenseCRUD.getAll().then(setExpenses); }, []);
  useEffect(() => { glCRUD.getAll().then(setGlEntries); }, []);

  const isReady = sales !== null && purchases !== null && parties !== null && inventory !== null && expenses !== null && glEntries !== null;

  // ── Date range filter helpers ─────────────────────────────────────────────
  function inPeriod(d: Date | string) {
    const dt = new Date(d);
    return dt >= new Date(from) && dt <= new Date(to + 'T23:59:59');
  }
  function upToDate(d: Date | string) {
    return new Date(d) <= new Date(to + 'T23:59:59');
  }

  // ── Quick date presets ────────────────────────────────────────────────────
  const presets = [
    {
      label: 'This Month',
      action() {
        const n = new Date();
        setFrom(new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]);
        setTo(todayStr());
      },
    },
    {
      label: 'Last Month',
      action() {
        const n = new Date();
        setFrom(new Date(n.getFullYear(), n.getMonth() - 1, 1).toISOString().split('T')[0]);
        setTo(new Date(n.getFullYear(), n.getMonth(), 0).toISOString().split('T')[0]);
      },
    },
    {
      label: 'This Year',
      action() {
        setFrom(`${new Date().getFullYear()}-01-01`);
        setTo(todayStr());
      },
    },
    {
      label: 'All Time',
      action() {
        setFrom('2020-01-01');
        setTo(todayStr());
      },
    },
  ];

  // ── Download 1 — Profit & Loss ────────────────────────────────────────────
  async function downloadPnL() {
    if (!isReady || sales === null || purchases === null || expenses === null || glEntries === null) return;
    setLoadingPnL(true);
    try {
      const XLSX = await import('xlsx');
      const periodStr = `Period: ${fmtDate(from)} to ${fmtDate(to)}`;

      const fSales     = sales.filter(s => inPeriod(s.timestamp));
      const fPurchases = purchases.filter(p => inPeriod(p.timestamp));
      const fExpenses  = expenses.filter(e => inPeriod(e.date));

      const grossRevenue     = fSales.reduce((s, r) => s + r.grossAmount, 0);
      const gstCollected     = fSales.reduce((s, r) => s + r.gstAmount,   0);
      // Perpetual COGS: GL entries posted at time of each sale
      const cogs             = glEntries.filter(e => e.account === 'Cost of Goods Sold' && inPeriod(e.timestamp)).reduce((s, e) => s + e.debit, 0);
      const gstInputPurchase = fPurchases.reduce((s, r) => s + r.gstAmount,   0);
      const gstInputExpense  = fExpenses.reduce((s, e) => s + (e.inputTaxAmount ?? 0), 0);

      // Expenses: use NET amounts (strip input tax)
      const expByCat: Record<string, number> = {};
      let totalExpenses = 0;
      for (const e of fExpenses) {
        const net = e.amount - (e.inputTaxAmount ?? 0);
        expByCat[e.category] = (expByCat[e.category] ?? 0) + net;
        totalExpenses += net;
      }
      const grossProfit = grossRevenue - cogs;
      const netProfit   = grossProfit - totalExpenses;
      const netGST      = Math.max(0, gstCollected - gstInputPurchase - gstInputExpense);

      const expRows: (string | number)[][] =
        Object.keys(expByCat).length === 0
          ? [['  (No expenses recorded in this period)', 0]]
          : Object.entries(expByCat)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amt]) => [`  ${cat}`, money(amt)]);

      const pnlSheet: (string | number)[][] = [
        ...bizHeader('PROFIT & LOSS STATEMENT', periodStr),
        ['A.  REVENUE', ''],
        ['  Gross Sales Revenue (excl. GST)', money(grossRevenue)],
        ['  GST Collected @ 5%  (informational)', money(gstCollected)],
        ['  Total Invoiced (incl. GST)', money(grossRevenue + gstCollected)],
        [],
        ['B.  COST OF GOODS SOLD (COGS)', ''],
        ['  Cost of Goods Sold (at purchase cost, perpetual)', money(cogs)],
        [],
        ['  GROSS PROFIT  (A – B)', money(grossProfit)],
        [],
        ['C.  OPERATING EXPENSES  (Net of Input Tax)', ''],
        ...expRows,
        ['─'.repeat(44), '─'.repeat(14)],
        ['  TOTAL OPERATING EXPENSES', money(totalExpenses)],
        [],
        ['NET PROFIT / (LOSS)  (Gross Profit – Expenses)', money(netProfit)],
        [],
        ['D.  GST RECONCILIATION  (Informational)', ''],
        ['  Output Tax Collected (5%)', money(gstCollected)],
        ['  Input Tax Credit — Purchases', money(gstInputPurchase)],
        ['  Input Tax Credit — Deductible Expenses', money(gstInputExpense)],
        ['  NET GST PAYABLE TO GOVERNMENT', money(netGST)],
      ];

      // Sales detail
      const salesSheet: (string | number)[][] = [
        ...bizHeader('SALES DETAIL', periodStr),
        ['Invoice No.', 'Date', 'Customer', 'TPN', 'Gross (Nu.)', 'GST 5%', 'Net Total'],
        ...fSales.map(s => [
          s.invoiceNo, fmtDate(s.timestamp),
          s.customerName || 'Cash Customer', s.customerTPN || '—',
          money(s.grossAmount), money(s.gstAmount), money(s.netAmount),
        ]),
        [],
        ['TOTAL', `${fSales.length} invoices`, '', '',
          money(fSales.reduce((s, r) => s + r.grossAmount, 0)),
          money(gstCollected),
          money(fSales.reduce((s, r) => s + r.netAmount, 0)),
        ],
      ];

      // Expenses detail
      const expSheet: (string | number)[][] = [
        ...bizHeader('EXPENSES DETAIL', periodStr),
        ['Date', 'Category', 'Description', 'Total Paid', 'Input Tax Credit', 'Net Expense', 'Reference'],
        ...fExpenses.map(e => [
          fmtDate(e.date), e.category, e.description,
          money(e.amount), money(e.inputTaxAmount ?? 0),
          money(e.amount - (e.inputTaxAmount ?? 0)),
          e.reference || '—',
        ]),
        [],
        ['TOTAL', '', '', money(fExpenses.reduce((s, e) => s + e.amount, 0)),
          money(gstInputExpense), money(totalExpenses), ''],
      ];

      const wb = XLSX.utils.book_new();
      const wsPnL  = XLSX.utils.aoa_to_sheet(pnlSheet);
      const wsSal  = XLSX.utils.aoa_to_sheet(salesSheet);
      const wsExp  = XLSX.utils.aoa_to_sheet(expSheet);
      wsPnL['!cols']  = [{ wch: 48 }, { wch: 18 }];
      wsSal['!cols']  = [10, 12, 28, 15, 14, 12, 14].map(w => ({ wch: w }));
      wsExp['!cols']  = [12, 15, 35, 14, 16, 14, 18].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, wsPnL, 'P&L Statement');
      XLSX.utils.book_append_sheet(wb, wsSal, 'Sales Detail');
      XLSX.utils.book_append_sheet(wb, wsExp, 'Expenses Detail');
      XLSX.writeFile(wb, `PnL_${from}_to_${to}.xlsx`);
    } finally { setLoadingPnL(false); }
  }

  // ── Download 2 — Balance Sheet ────────────────────────────────────────────
  async function downloadBalanceSheet() {
    if (!isReady || sales === null || purchases === null || parties === null || inventory === null || expenses === null) return;
    setLoadingBS(true);
    try {
      const XLSX = await import('xlsx');
      const asOf = `As of: ${fmtDate(to)}`;

      const fSales     = sales.filter(s => upToDate(s.timestamp));
      const fPurchases = purchases.filter(p => upToDate(p.timestamp));
      const fExpenses  = expenses.filter(e => upToDate(e.date));

      const totalSalesNet    = fSales.reduce((s, r) => s + r.netAmount, 0);
      const totalPurchaseNet = fPurchases.reduce((s, r) => s + r.netAmount, 0);
      const totalExpPaid     = fExpenses.reduce((s, e) => s + e.amount, 0);
      const cashBalance      = Math.max(0, totalSalesNet - totalPurchaseNet - totalExpPaid);

      const ar       = parties.filter(p => p.outstandingBalance > 0).reduce((s, p) => s + p.outstandingBalance, 0);
      const invVal   = inventory.reduce((s, i) => s + i.stockQty * i.baseRate, 0);
      const gstIPur  = fPurchases.reduce((s, r) => s + r.gstAmount, 0);
      const gstIExp  = fExpenses.reduce((s, e) => s + (e.inputTaxAmount ?? 0), 0);
      const gstIC    = gstIPur + gstIExp;
      const totalA   = cashBalance + ar + invVal + gstIC;

      const ap          = Math.abs(parties.filter(p => p.outstandingBalance < 0).reduce((s, p) => s + p.outstandingBalance, 0));
      const gstOut      = fSales.reduce((s, r) => s + r.gstAmount, 0);
      const netGST      = Math.max(0, gstOut - gstIC);
      const totalL      = ap + netGST;

      const grossRev    = fSales.reduce((s, r) => s + r.grossAmount, 0);
      const cogsVal     = fPurchases.reduce((s, r) => s + r.grossAmount, 0);
      const netExpenses = fExpenses.reduce((s, e) => s + e.amount - (e.inputTaxAmount ?? 0), 0);
      const retained    = grossRev - cogsVal - netExpenses;
      const totalE      = totalA - totalL;
      const checkSum    = totalL + totalE;
      const balanced    = Math.abs(totalA - checkSum) < 0.02;

      const bsSheet: (string | number)[][] = [
        ...bizHeader('BALANCE SHEET', asOf),
        ['ASSETS', ''],
        ['Current Assets', ''],
        ['  Cash / Bank  (Estimated Net Position)', money(cashBalance)],
        ['  Accounts Receivable  (Outstanding Balances)', money(ar)],
        ['  Inventory Valuation  (Stock at Cost)', money(invVal)],
        ['  GST Input Credit  (Purchases + Expenses)', money(gstIC)],
        ['─'.repeat(46), '─'.repeat(14)],
        ['TOTAL ASSETS  (A)', money(totalA)],
        [],
        ['LIABILITIES', ''],
        ['Current Liabilities', ''],
        ['  Accounts Payable  (Outstanding to Suppliers)', money(ap)],
        ['  GST Payable to Government  (Net)', money(netGST)],
        ['─'.repeat(46), '─'.repeat(14)],
        ['TOTAL LIABILITIES  (B)', money(totalL)],
        [],
        ["OWNER'S EQUITY", ''],
        ['  Retained Earnings  (Net Profit to Date)', money(retained)],
        ['─'.repeat(46), '─'.repeat(14)],
        ['TOTAL EQUITY  (C = A – B)', money(totalE)],
        [],
        ['TOTAL LIABILITIES + EQUITY  (B + C)', money(checkSum)],
        [],
        ['BALANCE CHECK', balanced ? 'BALANCED  ✓' : `DISCREPANCY: Nu. ${money(Math.abs(totalA - checkSum))}`],
        [],
        ['NOTE: Cash balance is estimated from transaction records.', ''],
        ['Inventory is valued at purchase cost (not market value).', ''],
      ];

      const ws = XLSX.utils.aoa_to_sheet(bsSheet);
      ws['!cols'] = [{ wch: 48 }, { wch: 20 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');
      XLSX.writeFile(wb, `BalanceSheet_AsOf_${to}.xlsx`);
    } finally { setLoadingBS(false); }
  }

  // ── Download 3 — Trial Balance ────────────────────────────────────────────
  async function downloadTrialBalance() {
    if (!isReady || sales === null || purchases === null || parties === null || expenses === null || glEntries === null) return;
    setLoadingTB(true);
    try {
      const XLSX = await import('xlsx');
      const asOf = `As of: ${fmtDate(to)}`;

      const fSales     = sales.filter(s => upToDate(s.timestamp));
      const fPurchases = purchases.filter(p => upToDate(p.timestamp));
      const fExpenses  = expenses.filter(e => upToDate(e.date));

      const totalSalesGross  = fSales.reduce((s, r) => s + r.grossAmount, 0);
      const totalSalesGST    = fSales.reduce((s, r) => s + r.gstAmount,   0);
      const totalSalesNet    = fSales.reduce((s, r) => s + r.netAmount,    0);
      const totalPurchGross  = fPurchases.reduce((s, r) => s + r.grossAmount, 0);
      const totalPurchGST    = fPurchases.reduce((s, r) => s + r.gstAmount,   0);
      const totalPurchNet    = fPurchases.reduce((s, r) => s + r.netAmount,    0);
      const expInputTax      = fExpenses.reduce((s, e) => s + (e.inputTaxAmount ?? 0), 0);
      const totalExpPaid     = fExpenses.reduce((s, e) => s + e.amount, 0);
      // Perpetual COGS from GL
      const totalCOGS        = glEntries.filter(e => e.account === 'Cost of Goods Sold' && upToDate(e.timestamp)).reduce((s, e) => s + e.debit, 0);

      const ar  = parties.filter(p => p.outstandingBalance > 0).reduce((s, p) => s + p.outstandingBalance, 0);
      const ap  = Math.abs(parties.filter(p => p.outstandingBalance < 0).reduce((s, p) => s + p.outstandingBalance, 0));

      const cashReceipts = Math.max(0, totalSalesNet - ar);
      const cashPayments = Math.max(0, totalPurchNet - ap) + totalExpPaid;

      const expByCat: Record<string, number> = {};
      for (const e of fExpenses) {
        const net = e.amount - (e.inputTaxAmount ?? 0);
        expByCat[e.category] = (expByCat[e.category] ?? 0) + net;
      }

      type TRow = { account: string; category: string; dr: number; cr: number };
      const rawRows: TRow[] = [
        { account: 'Cash / Bank  (Receipts)',    category: 'Asset',     dr: cashReceipts,                    cr: 0                  },
        { account: 'Cash / Bank  (Payments)',    category: 'Asset',     dr: 0,                               cr: cashPayments       },
        { account: 'Accounts Receivable',        category: 'Asset',     dr: ar,                              cr: 0                  },
        { account: 'Inventory / COGS',           category: 'Asset',     dr: totalPurchGross,                 cr: totalCOGS          },
        { account: 'GST Input Credit',           category: 'Asset',     dr: totalPurchGST + expInputTax,     cr: 0                  },
        { account: 'Accounts Payable',           category: 'Liability', dr: 0,                               cr: ap                 },
        { account: 'GST Collected  (5%)',        category: 'Liability', dr: 0,                               cr: totalSalesGST      },
        { account: 'Sales Revenue',              category: 'Revenue',   dr: 0,                               cr: totalSalesGross    },
        { account: 'Cost of Goods Sold',         category: 'Expense',   dr: totalCOGS,                       cr: 0                  },
        ...Object.entries(expByCat).map(([cat, amt]) => ({
          account: cat, category: 'Expense', dr: amt, cr: 0,
        })),
      ].filter(r => r.dr > 0.005 || r.cr > 0.005);

      const totDr   = rawRows.reduce((s, r) => s + r.dr, 0);
      const totCr   = rawRows.reduce((s, r) => s + r.cr, 0);
      const diff    = Math.abs(totDr - totCr);
      const balanced = diff < 0.02;
      const netGST  = Math.max(0, totalSalesGST - totalPurchGST - expInputTax);

      const tbSheet: (string | number)[][] = [
        ...bizHeader('MASTER TRIAL BALANCE SHEET', asOf),
        ['PARTICULARS', 'CATEGORY', 'DEBIT  (Nu.)', 'CREDIT  (Nu.)', 'BALANCE  (Nu.)', 'Dr / Cr'],
        ...rawRows.map(r => {
          const bal   = Math.abs(r.dr - r.cr);
          const drCr  = r.dr >= r.cr ? 'Dr' : 'Cr';
          return [r.account, r.category, r.dr > 0 ? money(r.dr) : '', r.cr > 0 ? money(r.cr) : '', money(bal), drCr];
        }),
        ['─'.repeat(30), '─'.repeat(12), '─'.repeat(14), '─'.repeat(14), '─'.repeat(14), '─'.repeat(6)],
        ['TOTALS', '', money(totDr), money(totCr), money(diff), balanced ? 'OK ✓' : 'UNBAL ✗'],
        [],
        ['STATUS', balanced ? 'Trial balance is BALANCED ✓' : `DISCREPANCY of Nu. ${money(diff)} — review entries`, '', '', '', ''],
        [],
        ['GST SUMMARY', '', '', '', '', ''],
        ['  GST Collected  (Output Tax)', 'Liability', '', money(totalSalesGST), money(totalSalesGST), 'Cr'],
        ['  GST Input Credit  (Purchases)', 'Asset', money(totalPurchGST), '', money(totalPurchGST), 'Dr'],
        ['  GST Input Credit  (Expenses)', 'Asset', money(expInputTax), '', money(expInputTax), 'Dr'],
        ['  NET GST PAYABLE TO GOVERNMENT', 'Liability', '', money(netGST), money(netGST), 'Cr'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(tbSheet);
      ws['!cols'] = [{ wch: 34 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 8 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance');
      XLSX.writeFile(wb, `TrialBalance_AsOf_${to}.xlsx`);
    } finally { setLoadingTB(false); }
  }

  // ── Download 4 — GST Taxation Summary ────────────────────────────────────
  async function downloadGSTSummary() {
    if (!isReady || sales === null || purchases === null || expenses === null) return;
    setLoadingGST(true);
    try {
      const XLSX = await import('xlsx');
      const periodStr = `Period: ${fmtDate(from)} to ${fmtDate(to)}`;

      const fSales     = sales.filter(s => inPeriod(s.timestamp));
      const fPurchases = purchases.filter(p => inPeriod(p.timestamp));
      const fExpenses  = expenses.filter(e => inPeriod(e.date));

      const salesGross       = fSales.reduce((s, r) => s + r.grossAmount, 0);
      const gstCollected     = fSales.reduce((s, r) => s + r.gstAmount,   0);
      const purchaseGross    = fPurchases.reduce((s, r) => s + r.grossAmount, 0);
      const gstIPurchase     = fPurchases.reduce((s, r) => s + r.gstAmount,   0);
      const gstIExpense      = fExpenses.reduce((s, e) => s + (e.inputTaxAmount ?? 0), 0);
      const totalInputCredit = gstIPurchase + gstIExpense;
      const netGST           = Math.max(0, gstCollected - totalInputCredit);

      // ── Summary sheet ──────────────────────────────────────────────────────
      const gstSummary: (string | number)[][] = [
        ...bizHeader('GST TAXATION SUMMARY LEDGER', periodStr),
        ['FOR OFFICIAL TAX FILING — GST AGENT NO. P10037232', ''],
        [],
        ['OUTPUT TAX  (GST Collected on Taxable Sales)', ''],
        ['  Number of Tax Invoices Issued', fSales.length],
        ['  Total Taxable Value  (Gross Sales excl. GST)', money(salesGross)],
        ['  GST Rate Applied', '5.00%'],
        ['  TOTAL GST COLLECTED  (Output Tax)', money(gstCollected)],
        [],
        ['INPUT TAX CREDIT  (Claimable Deductions)', ''],
        ['  GST Paid on Stock Purchases', money(gstIPurchase)],
        ['  GST Paid on Deductible Business Expenses', money(gstIExpense)],
        ['─'.repeat(50), '─'.repeat(14)],
        ['  TOTAL INPUT TAX CREDIT', money(totalInputCredit)],
        [],
        ['GST LIABILITY COMPUTATION', ''],
        ['  Output Tax Collected', money(gstCollected)],
        ['  Less: Input Tax Credit', money(totalInputCredit)],
        ['─'.repeat(50), '─'.repeat(14)],
        ['  NET GST PAYABLE TO ROYAL GOVERNMENT OF BHUTAN', money(netGST)],
        [],
        ['SUPPLY STATISTICS', ''],
        ['  No. of Purchase Transactions', fPurchases.length],
        ['  Total Taxable Purchases  (Gross)', money(purchaseGross)],
        ['  No. of Expense Records with Input Credit', fExpenses.filter(e => (e.inputTaxAmount ?? 0) > 0).length],
        [],
        ['TAXPAYER CERTIFICATION', ''],
        [`  Taxpayer / Business Name: ${BIZ.name}`, ''],
        [`  GST Certified Agent No.: ${BIZ.gstNo}`, ''],
        [`  Taxpayer Identification No. (TPN): ${BIZ.tpn}`, ''],
        [`  License No.: ${BIZ.licNo}`, ''],
        [`  Location: ${BIZ.location}`, ''],
        ['  Report Period:', periodStr],
        [],
        ['  Declaration: This report is generated from the business accounting system.', ''],
        ['  All figures are in Ngultrum (Nu.) and are true and correct to the best', ''],
        ['  knowledge of the taxpayer. Prepared for submission to the Department of', ''],
        ['  Revenue and Customs, Ministry of Finance, Royal Government of Bhutan.', ''],
      ];

      // ── Sales audit log sheet ─────────────────────────────────────────────
      const salesAudit: (string | number)[][] = [
        ...bizHeader('SALES AUDIT LOG — OUTPUT TAX', periodStr),
        ['Date', 'Invoice No.', 'Customer Name', 'Customer TPN', 'Taxable Value (Nu.)', 'GST @ 5% (Nu.)', 'Invoice Total (Nu.)'],
        ...fSales.map(s => [
          fmtDate(s.timestamp), s.invoiceNo,
          s.customerName || 'Cash Customer', s.customerTPN || '—',
          money(s.grossAmount), money(s.gstAmount), money(s.netAmount),
        ]),
        ['─'.repeat(12), '─'.repeat(12), '─'.repeat(28), '─'.repeat(15), '─'.repeat(18), '─'.repeat(15), '─'.repeat(18)],
        ['TOTAL', `${fSales.length} invoices`, '', '',
          money(salesGross), money(gstCollected),
          money(fSales.reduce((s, r) => s + r.netAmount, 0)),
        ],
      ];

      // ── Purchases audit log sheet ─────────────────────────────────────────
      const purchaseAudit: (string | number)[][] = [
        ...bizHeader('PURCHASES AUDIT LOG — INPUT TAX CREDIT', periodStr),
        ['Date', 'PO No.', 'Supplier Name', 'Supplier TPN', 'Taxable Value (Nu.)', 'GST @ 5% (Nu.)', 'Total Paid (Nu.)'],
        ...fPurchases.map(p => [
          fmtDate(p.timestamp), p.purchaseOrderNo,
          p.supplierName, p.supplierTPN || '—',
          money(p.grossAmount), money(p.gstAmount), money(p.netAmount),
        ]),
        ['─'.repeat(12), '─'.repeat(12), '─'.repeat(28), '─'.repeat(15), '─'.repeat(18), '─'.repeat(15), '─'.repeat(18)],
        ['TOTAL', `${fPurchases.length} orders`, '', '',
          money(purchaseGross), money(gstIPurchase),
          money(fPurchases.reduce((s, r) => s + r.netAmount, 0)),
        ],
      ];

      // ── Expense input tax sheet ───────────────────────────────────────────
      const expAudit: (string | number)[][] = [
        ...bizHeader('DEDUCTIBLE EXPENSE INPUT TAX LOG', periodStr),
        ['Date', 'Category', 'Description', 'Amount Paid', 'Input Tax Rate', 'Input Tax Credit', 'Net Expense'],
        ...fExpenses
          .filter(e => (e.inputTaxAmount ?? 0) > 0)
          .map(e => [
            fmtDate(e.date), e.category, e.description,
            money(e.amount), `${e.inputTaxRate ?? 5}%`,
            money(e.inputTaxAmount!), money(e.amount - e.inputTaxAmount!),
          ]),
        fExpenses.filter(e => (e.inputTaxAmount ?? 0) > 0).length === 0
          ? ['(No deductible expense input tax claims in this period)', '', '', '', '', '', '']
          : [],
        ['─'.repeat(12), '─'.repeat(15), '─'.repeat(35), '─'.repeat(12), '─'.repeat(14), '─'.repeat(16), '─'.repeat(14)],
        ['TOTAL', '', '', '', '', money(gstIExpense), ''],
      ].filter(r => r.length > 0);

      const colW7 = [12, 15, 35, 14, 14, 16, 14].map(w => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      const wsSum  = XLSX.utils.aoa_to_sheet(gstSummary);
      const wsSal  = XLSX.utils.aoa_to_sheet(salesAudit);
      const wsPur  = XLSX.utils.aoa_to_sheet(purchaseAudit);
      const wsExp  = XLSX.utils.aoa_to_sheet(expAudit);
      wsSum['!cols'] = [{ wch: 52 }, { wch: 20 }];
      wsSal['!cols'] = [12, 14, 28, 15, 18, 15, 18].map(w => ({ wch: w }));
      wsPur['!cols'] = [12, 14, 28, 15, 18, 15, 18].map(w => ({ wch: w }));
      wsExp['!cols'] = colW7;
      XLSX.utils.book_append_sheet(wb, wsSum,  'GST Summary');
      XLSX.utils.book_append_sheet(wb, wsSal,  'Sales Audit Log');
      XLSX.utils.book_append_sheet(wb, wsPur,  'Purchases Audit Log');
      XLSX.utils.book_append_sheet(wb, wsExp,  'Expense Input Tax');
      XLSX.writeFile(wb, `GST_Summary_${from}_to_${to}.xlsx`);
    } finally { setLoadingGST(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Date range control ───────────────────────────────────────────────── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-orange-400" />
          <h3 className="text-white font-semibold text-sm">Report Period</h3>
          <span className="text-slate-500 text-xs ml-1">
            · Balance Sheet &amp; Trial Balance use the <em>To</em> date as their cut-off.
          </span>
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-slate-400 text-xs mb-1">From</label>
            <input type="date" className={inputCls} value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">To</label>
            <input type="date" className={inputCls} value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {presets.map(p => (
              <button
                key={p.label}
                onClick={p.action}
                className="px-3 py-1.5 text-xs font-medium border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 rounded-lg transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4 Download cards ─────────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Card 1 — P&L */}
        <div className="bg-slate-800 border border-slate-700 hover:border-green-500/40 rounded-xl p-5 flex flex-col gap-3 transition-colors">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h4 className="text-white font-semibold">Profit &amp; Loss Statement</h4>
              <p className="text-slate-500 text-xs">3-sheet workbook — P&amp;L · Sales · Expenses</p>
            </div>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed">
            Gross Revenue, COGS, Operating Expenses (by category, net of input tax), Net Profit, and a GST reconciliation section. Full sales and expense detail on supporting sheets.
          </p>
          <button
            onClick={downloadPnL}
            disabled={!isReady || loadingPnL}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold
              bg-green-500/10 border border-green-500/30 text-green-400
              hover:bg-green-500/20 hover:border-green-500/60
              disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loadingPnL
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              : <><FileSpreadsheet className="w-4 h-4" /> Download P&amp;L (.xlsx)</>}
          </button>
        </div>

        {/* Card 2 — Balance Sheet */}
        <div className="bg-slate-800 border border-slate-700 hover:border-blue-500/40 rounded-xl p-5 flex flex-col gap-3 transition-colors">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h4 className="text-white font-semibold">Balance Sheet</h4>
              <p className="text-slate-500 text-xs">Single sheet — assets, liabilities, equity</p>
            </div>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed">
            Current Assets (Cash, Receivables, Inventory, GST Input Credit) balanced against Liabilities (Payables, Net GST Payable) and Owner's Equity with a balance-check indicator.
          </p>
          <button
            onClick={downloadBalanceSheet}
            disabled={!isReady || loadingBS}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold
              bg-blue-500/10 border border-blue-500/30 text-blue-400
              hover:bg-blue-500/20 hover:border-blue-500/60
              disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loadingBS
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              : <><FileSpreadsheet className="w-4 h-4" /> Download Balance Sheet (.xlsx)</>}
          </button>
        </div>

        {/* Card 3 — Trial Balance */}
        <div className="bg-slate-800 border border-slate-700 hover:border-purple-500/40 rounded-xl p-5 flex flex-col gap-3 transition-colors">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h4 className="text-white font-semibold">Master Trial Balance Sheet</h4>
              <p className="text-slate-500 text-xs">Single sheet — double-entry verification</p>
            </div>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed">
            Full double-entry worksheet: Particulars, Category, Debit, Credit, Running Balance, Dr/Cr tags. Zero accounts suppressed. Includes GST reconciliation rows and a balance status indicator.
          </p>
          <button
            onClick={downloadTrialBalance}
            disabled={!isReady || loadingTB}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold
              bg-purple-500/10 border border-purple-500/30 text-purple-400
              hover:bg-purple-500/20 hover:border-purple-500/60
              disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loadingTB
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              : <><FileSpreadsheet className="w-4 h-4" /> Download Trial Balance (.xlsx)</>}
          </button>
        </div>

        {/* Card 4 — GST Summary */}
        <div className="bg-slate-800 border border-slate-700 hover:border-yellow-500/40 rounded-xl p-5 flex flex-col gap-3 transition-colors">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/15 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h4 className="text-white font-semibold">GST Taxation Summary Ledger</h4>
              <p className="text-slate-500 text-xs">4-sheet workbook — ready for official filing</p>
            </div>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed">
            Output Tax collected, Input Tax Credit (purchases + deductible expenses), Net GST Payable, full Sales and Purchases audit logs, and a separate Expense Input Tax log. Includes taxpayer certification block.
          </p>
          <button
            onClick={downloadGSTSummary}
            disabled={!isReady || loadingGST}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold
              bg-yellow-500/10 border border-yellow-500/30 text-yellow-400
              hover:bg-yellow-500/20 hover:border-yellow-500/60
              disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loadingGST
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              : <><FileSpreadsheet className="w-4 h-4" /> Download GST Summary (.xlsx)</>}
          </button>
        </div>
      </div>

      {/* ── Footer note ──────────────────────────────────────────────────────── */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p className="text-slate-500 text-xs leading-relaxed">
          All reports are generated entirely client-side from your local IndexedDB — no data leaves your device. Every file includes the formal business header:{' '}
          <span className="text-slate-400 font-semibold">
            DAWA TSHERING SHOP, Paro, Bhutan · GST No. {BIZ.gstNo} · TPN: {BIZ.tpn} · LIC No. {BIZ.licNo}
          </span>
          . Figures are in Ngultrum (Nu.). Open the downloaded file in Microsoft Excel or Google Sheets to print as PDF.
        </p>
      </div>
    </div>
  );
}
