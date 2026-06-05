'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db, partyCRUD, paymentCRUD, postPaymentToGL,
  PartyRecord, SaleRecord, PurchaseRecord, PaymentRecord,
  PaymentMode, PaymentDirection, PartyType,
} from '@/lib/accounting-db';
import { AccountingNav } from '@/components/accounting/AccountingNav';
import { InvoicePrint } from '@/components/accounting/InvoicePrint';
import {
  ArrowLeft, Plus, Download, CreditCard, FileText,
  TrendingUp, TrendingDown, X, ChevronDown,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateInput(d: Date) {
  return d.toISOString().split('T')[0];
}

const inputCls = 'w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-400';

const PARTY_BADGE: Record<PartyType, string> = {
  customer: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  supplier: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  both:     'bg-green-500/20 text-green-400 border border-green-500/30',
};

const PAYMENT_MODES: PaymentMode[] = ['Cash', 'Bank Transfer', 'Cheque', 'Online'];

type Tab = 'history' | 'payments' | 'statement';

// ── Ledger entry for statement ────────────────────────────────────────────────
interface LedgerEntry {
  date: Date;
  particulars: string;
  ref: string;
  debit: number;
  credit: number;
  type: 'sale' | 'purchase' | 'payment' | 'opening';
}

// ── Payment form state ────────────────────────────────────────────────────────
const emptyPayment = (direction: PaymentDirection): Omit<PaymentRecord, 'id' | 'partyId'> => ({
  timestamp: new Date(),
  amount: 0,
  direction,
  mode: 'Cash',
  reference: '',
  notes: '',
});

// ── Main component ─────────────────────────────────────────────────────────────
export default function PartyProfilePage() {
  const params  = useParams();
  const partyId = Number(params.id);

  const [tab,          setTab]          = useState<Tab>('history');
  const [invoiceModal, setInvoiceModal] = useState<SaleRecord | null>(null);
  const [payModal,     setPayModal]     = useState(false);
  const [payForm,      setPayForm]      = useState(emptyPayment('in'));
  const [isSaving,     setIsSaving]     = useState(false);
  const [deletePayId,  setDeletePayId]  = useState<number | null>(null);

  // Live data
  const party     = useLiveQuery(() => db.parties.get(partyId), [partyId]);
  const allSales  = useLiveQuery(() => db.sales.toArray(),    []);
  const allPurch  = useLiveQuery(() => db.purchases.toArray(),[]);
  const payments  = useLiveQuery(
    () => db.payments.where('partyId').equals(partyId).sortBy('timestamp'),
    [partyId],
  );

  // Filter transactions matching this party's name (case-insensitive)
  const partySales: SaleRecord[] = useMemo(() => {
    if (!party || !allSales) return [];
    const name = party.name.toLowerCase();
    return [...allSales]
      .filter(s => s.customerName?.toLowerCase() === name)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [party, allSales]);

  const partyPurchases: PurchaseRecord[] = useMemo(() => {
    if (!party || !allPurch) return [];
    const name = party.name.toLowerCase();
    return [...allPurch]
      .filter(p => p.supplierName?.toLowerCase() === name)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [party, allPurch]);

  // Financials
  const totalInvoiced  = partySales.reduce((s, r) => s + r.netAmount, 0);
  const totalPurchased = partyPurchases.reduce((s, r) => s + r.netAmount, 0);
  const totalPaidIn    = (payments || []).filter(p => p.direction === 'in').reduce((s, p) => s + p.amount, 0);
  const totalPaidOut   = (payments || []).filter(p => p.direction === 'out').reduce((s, p) => s + p.amount, 0);
  const outstanding    = party?.outstandingBalance ?? 0;

  // Build Dr/Cr statement entries
  const statement: LedgerEntry[] = useMemo(() => {
    if (!party) return [];
    const entries: LedgerEntry[] = [];

    const ob = party.openingBalance ?? 0;
    if (ob !== 0) {
      entries.push({
        date: new Date(party.createdAt),
        particulars: 'Opening Balance',
        ref: '—',
        debit:  ob > 0 ? ob : 0,
        credit: ob < 0 ? Math.abs(ob) : 0,
        type: 'opening',
      });
    }

    for (const s of partySales) {
      entries.push({
        date: new Date(s.timestamp),
        particulars: `Sale Invoice #${s.invoiceNo}`,
        ref: s.invoiceNo,
        debit: s.netAmount,
        credit: 0,
        type: 'sale',
      });
    }

    for (const p of partyPurchases) {
      entries.push({
        date: new Date(p.timestamp),
        particulars: `Purchase ${p.purchaseOrderNo}`,
        ref: p.purchaseOrderNo,
        debit: 0,
        credit: p.netAmount,
        type: 'purchase',
      });
    }

    for (const p of (payments || [])) {
      entries.push({
        date: new Date(p.timestamp),
        particulars: `Payment ${p.direction === 'in' ? 'Received' : 'Made'} — ${p.mode}${p.reference ? ` (${p.reference})` : ''}`,
        ref: `PAY-${p.id}`,
        debit:  p.direction === 'out' ? p.amount : 0,
        credit: p.direction === 'in'  ? p.amount : 0,
        type: 'payment',
      });
    }

    return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [party, partySales, partyPurchases, payments]);

  // Running balance for statement
  const statementWithBalance = useMemo(() => {
    let balance = 0;
    return statement.map(entry => {
      balance += entry.debit - entry.credit;
      return { ...entry, runningBalance: balance };
    });
  }, [statement]);

  // ── Payment save ─────────────────────────────────────────────────────────────
  async function savePayment() {
    if (!party || payForm.amount <= 0) return;
    setIsSaving(true);
    const record: Omit<PaymentRecord, 'id'> = {
      ...payForm,
      partyId,
      timestamp: new Date(payForm.timestamp),
    };
    const id = await paymentCRUD.create(record) as number;
    // Update party outstanding balance
    const delta = payForm.direction === 'in' ? -payForm.amount : payForm.amount;
    await partyCRUD.updateBalance(partyId, delta);
    // Post to GL
    await postPaymentToGL({ ...record, id }, party.name);
    setIsSaving(false);
    setPayModal(false);
    setPayForm(emptyPayment(payForm.direction));
  }

  async function deletePayment(payId: number, pay: PaymentRecord) {
    // Reverse the balance adjustment
    const reverseDelta = pay.direction === 'in' ? pay.amount : -pay.amount;
    await partyCRUD.updateBalance(partyId, reverseDelta);
    await paymentCRUD.delete(payId);
    setDeletePayId(null);
  }

  // ── Excel export ─────────────────────────────────────────────────────────────
  async function exportStatement() {
    if (!party) return;
    const XLSX = await import('xlsx');
    const rows: (string | number)[][] = [
      [`Party Statement — ${party.name}`],
      [`Type: ${party.partyType} | TPN: ${party.tpn || '—'} | Phone: ${party.phone || '—'}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['Date', 'Particulars', 'Reference', 'Debit (Nu.)', 'Credit (Nu.)', 'Balance (Nu.)', 'Dr/Cr'],
    ];
    for (const e of statementWithBalance) {
      const bal = Math.abs(e.runningBalance);
      const drCr = e.runningBalance > 0.005 ? 'Dr' : e.runningBalance < -0.005 ? 'Cr' : 'Nil';
      rows.push([fmtDate(e.date), e.particulars, e.ref, e.debit || '', e.credit || '', bal, drCr]);
    }
    rows.push([], [`Outstanding Balance`, '', '', '', '', Math.abs(outstanding), outstanding > 0.005 ? 'Dr' : 'Cr']);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [14, 40, 14, 14, 14, 14, 6].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Party Statement');
    XLSX.writeFile(wb, `Statement_${party.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ── Loading / not found ───────────────────────────────────────────────────────
  if (party === undefined) {
    return (
      <div className="min-h-screen bg-slate-900">
        <AccountingNav />
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-400">Loading party profile…</p>
        </div>
      </div>
    );
  }
  if (party === null) {
    return (
      <div className="min-h-screen bg-slate-900">
        <AccountingNav />
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <p className="text-slate-300 font-medium">Party not found.</p>
          <Link href="/admin/accounting/ledgers?tab=parties" className="text-orange-400 hover:text-orange-300 text-sm">
            ← Back to Party Directory
          </Link>
        </div>
      </div>
    );
  }

  const drCrLabel = outstanding > 0.005 ? 'Dr' : outstanding < -0.005 ? 'Cr' : 'Nil';
  const defaultDirection: PaymentDirection = party.partyType === 'supplier' ? 'out' : 'in';

  return (
    <div className="min-h-screen bg-slate-900">
      <AccountingNav />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-sm">
          <Link href="/admin/accounting/ledgers?tab=parties" className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Party Directory
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300">{party.name}</span>
        </div>

        {/* ── Party header ────────────────────────────────────────────────────── */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-white text-xl font-bold">{party.name}</h1>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${PARTY_BADGE[party.partyType]}`}>
                  {party.partyType}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                {party.phone && <span>📞 {party.phone}</span>}
                {party.email && <span>✉ {party.email}</span>}
                {party.address && <span>📍 {party.address}</span>}
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                {party.tpn      && <span>TPN: <span className="text-slate-300">{party.tpn}</span></span>}
                {party.licenseNo && <span>License: <span className="text-slate-300">{party.licenseNo}</span></span>}
                {party.gstNo    && <span>GST No.: <span className="text-slate-300">{party.gstNo}</span></span>}
                {party.procurementOfficer && <span>Officer: <span className="text-slate-300">{party.procurementOfficer}</span></span>}
              </div>
              {party.notes && <p className="text-slate-500 text-xs italic">{party.notes}</p>}
            </div>
            <button
              onClick={() => { setPayForm(emptyPayment(defaultDirection)); setPayModal(true); }}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <CreditCard className="w-4 h-4" /> Record Payment
            </button>
          </div>
        </div>

        {/* ── Summary cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <p className="text-slate-400 text-xs">Total Invoiced</p>
            </div>
            <p className="text-green-400 font-mono font-bold text-lg">Nu. {fmt(totalInvoiced)}</p>
            <p className="text-slate-500 text-xs mt-0.5">{partySales.length} invoice{partySales.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-blue-400" />
              <p className="text-slate-400 text-xs">Total Purchased</p>
            </div>
            <p className="text-blue-400 font-mono font-bold text-lg">Nu. {fmt(totalPurchased)}</p>
            <p className="text-slate-500 text-xs mt-0.5">{partyPurchases.length} order{partyPurchases.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-orange-400" />
              <p className="text-slate-400 text-xs">Payments Received</p>
            </div>
            <p className="text-orange-400 font-mono font-bold text-lg">Nu. {fmt(totalPaidIn)}</p>
            <p className="text-slate-500 text-xs mt-0.5">Paid out: Nu. {fmt(totalPaidOut)}</p>
          </div>
          <div className={`border rounded-xl p-4 ${outstanding > 0.005 ? 'bg-green-500/5 border-green-700/50' : outstanding < -0.005 ? 'bg-red-500/5 border-red-700/50' : 'bg-slate-800 border-slate-700'}`}>
            <p className="text-slate-400 text-xs mb-1">Outstanding Balance</p>
            <p className={`font-mono font-bold text-xl ${outstanding > 0.005 ? 'text-green-400' : outstanding < -0.005 ? 'text-red-400' : 'text-slate-400'}`}>
              Nu. {fmt(Math.abs(outstanding))}
            </p>
            <p className={`text-xs font-semibold mt-0.5 ${outstanding > 0.005 ? 'text-green-500' : outstanding < -0.005 ? 'text-red-500' : 'text-slate-500'}`}>
              {outstanding > 0.005 ? `Dr — They owe us` : outstanding < -0.005 ? `Cr — We owe them` : 'Settled'}
            </p>
          </div>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 w-fit">
          {([
            { id: 'history' as Tab,   label: 'Transaction History' },
            { id: 'payments' as Tab,  label: 'Payments' },
            { id: 'statement' as Tab, label: 'Account Statement' },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── HISTORY TAB ─────────────────────────────────────────────────────── */}
        {tab === 'history' && (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Reference</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Items</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Gross</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">GST</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Net (Nu.)</th>
                </tr>
              </thead>
              <tbody>
                {partySales.length === 0 && partyPurchases.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-500">No transactions found for this party.</td></tr>
                ) : (
                  <>
                    {[...partySales.map(s => ({ ...s, _type: 'sale' as const })),
                       ...partyPurchases.map(p => ({ ...p, _type: 'purchase' as const }))]
                      .sort((a, b) => new Date(a.timestamp ?? a.timestamp).getTime() - new Date(b.timestamp ?? b.timestamp).getTime())
                      .map((row, i) => {
                        const isSale = row._type === 'sale';
                        const sale   = isSale ? (row as SaleRecord & { _type: 'sale' }) : null;
                        const purch  = !isSale ? (row as PurchaseRecord & { _type: 'purchase' }) : null;
                        return (
                          <tr
                            key={`${row._type}-${i}`}
                            className={`border-t border-slate-700 transition-colors ${isSale ? 'hover:bg-blue-500/5 cursor-pointer' : 'hover:bg-purple-500/5'}`}
                            onClick={isSale && sale ? () => setInvoiceModal(sale) : undefined}
                          >
                            <td className="px-4 py-3 text-slate-300 font-mono text-xs">{fmtDate(row.timestamp)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isSale ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                {isSale ? 'Sale' : 'Purchase'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                              {isSale ? `#${(row as SaleRecord).invoiceNo}` : (row as PurchaseRecord).purchaseOrderNo}
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">
                              {row.items.map(it => `${it.description} ×${it.qty}`).join(', ')}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-300 font-mono text-xs">{fmt(row.grossAmount)}</td>
                            <td className="px-4 py-3 text-right text-yellow-500/80 font-mono text-xs">{fmt(row.gstAmount)}</td>
                            <td className={`px-4 py-3 text-right font-mono font-semibold text-sm ${isSale ? 'text-green-400' : 'text-purple-400'}`}>
                              {fmt(row.netAmount)}
                              {isSale && <span className="ml-1 text-xs text-slate-500 font-normal">↗</span>}
                            </td>
                          </tr>
                        );
                      })}
                  </>
                )}
              </tbody>
            </table>
            {partySales.length > 0 && (
              <div className="px-4 py-2 bg-slate-800 border-t border-slate-700 text-xs text-slate-500">
                Click any Sale row to view & reprint the full invoice.
              </div>
            )}
          </div>
        )}

        {/* ── PAYMENTS TAB ────────────────────────────────────────────────────── */}
        {tab === 'payments' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => { setPayForm(emptyPayment(defaultDirection)); setPayModal(true); }}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Record Payment
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Direction</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Mode</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Reference</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Amount (Nu.)</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Notes</th>
                    <th className="text-center px-4 py-3 text-slate-400 font-medium">Del</th>
                  </tr>
                </thead>
                <tbody>
                  {!payments || payments.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-slate-500">No payments recorded. Click &ldquo;Record Payment&rdquo; to add one.</td></tr>
                  ) : [...payments].reverse().map(p => (
                    <tr key={p.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs">{fmtDate(p.timestamp)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${p.direction === 'in' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {p.direction === 'in' ? 'Received' : 'Paid Out'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{p.mode}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{p.reference || '—'}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${p.direction === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{p.notes || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setDeletePayId(p.id!)} className="text-slate-500 hover:text-red-400 transition-colors text-xs">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── STATEMENT TAB ───────────────────────────────────────────────────── */}
        {tab === 'statement' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-white font-semibold">Account Statement</h3>
                <p className="text-slate-400 text-xs mt-0.5">Chronological Dr/Cr ledger with running balance</p>
              </div>
              <button onClick={exportStatement} className="flex items-center gap-2 border border-slate-600 hover:border-green-500 text-slate-300 hover:text-green-400 px-4 py-2 rounded-lg text-sm transition-colors">
                <Download className="w-4 h-4" /> Export Excel
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Particulars</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Ref</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Debit (Nu.)</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Credit (Nu.)</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Balance (Nu.)</th>
                    <th className="text-center px-4 py-3 text-slate-400 font-medium w-14">Dr/Cr</th>
                  </tr>
                </thead>
                <tbody>
                  {statementWithBalance.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-slate-500">No transactions recorded for this party.</td></tr>
                  ) : statementWithBalance.map((e, i) => {
                    const bal = e.runningBalance;
                    const drCr = bal > 0.005 ? 'Dr' : bal < -0.005 ? 'Cr' : 'Nil';
                    return (
                      <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/20">
                        <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{fmtDate(e.date)}</td>
                        <td className="px-4 py-2.5 text-slate-200 text-xs">{e.particulars}</td>
                        <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{e.ref}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">
                          {e.debit > 0 ? <span className="text-green-400">{fmt(e.debit)}</span> : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">
                          {e.credit > 0 ? <span className="text-red-400">{fmt(e.credit)}</span> : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-200">{fmt(Math.abs(bal))}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${drCr === 'Dr' ? 'bg-green-500/15 text-green-400' : drCr === 'Cr' ? 'bg-red-500/15 text-red-400' : 'text-slate-500'}`}>
                            {drCr}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-slate-500 bg-slate-700/50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-white font-bold text-sm">Outstanding Balance</td>
                    <td colSpan={2} className="px-4 py-3" />
                    <td className={`px-4 py-3 text-right font-mono font-bold text-sm ${outstanding > 0.005 ? 'text-green-400' : outstanding < -0.005 ? 'text-red-400' : 'text-slate-400'}`}>
                      Nu. {fmt(Math.abs(outstanding))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${drCrLabel === 'Dr' ? 'bg-green-500/15 text-green-400' : drCrLabel === 'Cr' ? 'bg-red-500/15 text-red-400' : 'text-slate-500'}`}>
                        {drCrLabel}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Invoice Modal ─────────────────────────────────────────────────────── */}
      {invoiceModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-3xl mt-8">
            <InvoicePrint invoice={invoiceModal} onClose={() => setInvoiceModal(null)} />
          </div>
        </div>
      )}

      {/* ── Record Payment Modal ──────────────────────────────────────────────── */}
      {payModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setPayModal(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">Record Payment — {party.name}</h3>
              <button onClick={() => setPayModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Direction</label>
                <div className="relative">
                  <select
                    className={inputCls + ' appearance-none pr-8'}
                    value={payForm.direction}
                    onChange={e => setPayForm(p => ({ ...p, direction: e.target.value as PaymentDirection }))}
                  >
                    <option value="in">Payment Received (Customer pays us)</option>
                    <option value="out">Payment Made (We pay Supplier)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Date *</label>
                  <input type="date" className={inputCls}
                    value={fmtDateInput(new Date(payForm.timestamp))}
                    onChange={e => setPayForm(p => ({ ...p, timestamp: new Date(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Mode *</label>
                  <div className="relative">
                    <select className={inputCls + ' appearance-none pr-8'}
                      value={payForm.mode}
                      onChange={e => setPayForm(p => ({ ...p, mode: e.target.value as PaymentMode }))}>
                      {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Amount (Nu.) *</label>
                <input type="number" min="0.01" step="0.01" className={inputCls}
                  placeholder="0.00"
                  value={payForm.amount || ''}
                  onChange={e => setPayForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Reference (cheque/deposit no.)</label>
                <input className={inputCls} placeholder="Optional"
                  value={payForm.reference || ''}
                  onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))} />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Notes</label>
                <textarea className={inputCls} rows={2}
                  value={payForm.notes || ''}
                  onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            {payForm.direction === 'in' && payForm.amount > 0 && (
              <div className="mt-3 bg-green-500/10 border border-green-700/40 rounded-lg p-3 text-xs text-green-300">
                DR Cash/Bank +Nu. {fmt(payForm.amount)} &nbsp;|&nbsp; CR Accounts Receivable −Nu. {fmt(payForm.amount)}
              </div>
            )}
            {payForm.direction === 'out' && payForm.amount > 0 && (
              <div className="mt-3 bg-red-500/10 border border-red-700/40 rounded-lg p-3 text-xs text-red-300">
                DR Accounts Payable −Nu. {fmt(payForm.amount)} &nbsp;|&nbsp; CR Cash/Bank −Nu. {fmt(payForm.amount)}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={savePayment}
                disabled={isSaving || payForm.amount <= 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {isSaving ? 'Saving…' : 'Save Payment'}
              </button>
              <button onClick={() => setPayModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Payment Confirmation ───────────────────────────────────────── */}
      {deletePayId !== null && (() => {
        const pay = (payments || []).find(p => p.id === deletePayId);
        if (!pay) return null;
        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full">
              <h3 className="text-white font-semibold mb-2">Delete Payment?</h3>
              <p className="text-slate-400 text-sm mb-1">
                {pay.direction === 'in' ? 'Received' : 'Paid'} Nu. {fmt(pay.amount)} on {fmtDate(pay.timestamp)}
              </p>
              <p className="text-slate-500 text-xs mb-5">Party balance will be reversed. GL entries remain for audit.</p>
              <div className="flex gap-3">
                <button onClick={() => deletePayment(deletePayId, pay)} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium">Delete</button>
                <button onClick={() => setDeletePayId(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
