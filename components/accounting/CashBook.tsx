'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CashBookEntry,
  CashBookType,
  cashBookCRUD,
  partyCRUD,
  glCRUD,
  postCashBookToGL,
  PartyRecord,
} from '@/lib/accounting-db';
import { numberToWords } from '@/lib/number-to-words';
import {
  Plus, Printer, Trash2, Search, RefreshCw, ArrowDownLeft,
  ArrowUpRight, ChevronLeft, ChevronRight, X, Save, AlertTriangle,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:border-orange-500 placeholder-slate-400';

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const PAGE_SIZE = 30;

// ── VoucherPrint (in-page preview, mirrors InvoicePrint layout) ───────────────

function VoucherPrint({ entry, onClose }: { entry: CashBookEntry; onClose: () => void }) {
  const isReceived = entry.type === 'received';

  return (
    <>
      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          #dtt-voucher-print, #dtt-voucher-print * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #dtt-voucher-print {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 8px 14px !important;
            background: white !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-weight: 500 !important;
            color: #000 !important;
            font-size: 10px !important;
          }
          #dtt-voucher-print table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          #dtt-voucher-print th,
          #dtt-voucher-print td {
            border: 1px solid #000 !important;
            padding: 2px 5px !important;
          }
          #dtt-voucher-print th {
            background: #e8e8e8 !important;
            font-weight: 800 !important;
            font-size: 9px !important;
          }
          .no-print { display: none !important; }
          @page { margin: 0.4cm; size: A4; }
        }
      `}</style>

      {/* Voucher body — font sizes match InvoicePrint exactly */}
      <div
        id="dtt-voucher-print"
        className="bg-white text-black p-4 max-w-[720px] mx-auto"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px', fontWeight: 500, lineHeight: 1.4, color: '#000' }}
      >
        {/* Header */}
        <div className="relative text-center pb-2 mb-1" style={{ borderBottom: '2px solid #000' }}>
          <div className="absolute top-0 left-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="DTT Logo" style={{ width: '72px', height: '72px', objectFit: 'contain' }} />
          </div>
          <div className="absolute top-0 right-0" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <div style={{ border: '2px solid #000', padding: '3px 10px', fontWeight: 900, fontSize: '13px', letterSpacing: '0.05em' }}>
              {isReceived ? 'CASH RECEIPT' : 'CASH PAYMENT'}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, textAlign: 'right', lineHeight: 1.6 }}>
              <div><span style={{ fontWeight: 700 }}>Date:&nbsp;</span>{fmtDate(entry.timestamp)}</div>
              <div><span style={{ fontWeight: 700 }}>Voucher No.:&nbsp;</span>{entry.voucherNo}</div>
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '0.02em', lineHeight: 1.1 }}>ཟླ་བ་ཚེ་རིང་ཚོང་ཁང་།</div>
          <div style={{ fontSize: '15px', fontWeight: 900, letterSpacing: '0.04em', lineHeight: 1.2, marginTop: '1px' }}>DAWA TSHERING SHOP</div>
          <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '1px' }}>PARO, BHUTAN</div>
          <div style={{ fontSize: '10px', fontWeight: 600, marginTop: '2px' }}>
            GST Certified Agent No.&nbsp;P10037232 &nbsp;|&nbsp; TPN:&nbsp;JAB09739 &nbsp;|&nbsp; LIC No.&nbsp;R1005542
          </div>
          <div style={{ fontSize: '10px', fontWeight: 600, marginTop: '1px' }}>
            Ph:&nbsp;17716895 / 17711469 &nbsp;|&nbsp; www.dawatsheringshop.com
          </div>
        </div>

        {/* To / From */}
        <div style={{ marginBottom: '6px', fontSize: '12px' }}>
          <span style={{ fontWeight: 700 }}>{isReceived ? 'Received From:' : 'Paid To:'}&nbsp;</span>
          <span style={{ fontWeight: 600 }}>{entry.partyName}</span>
        </div>

        {/* Particulars table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'center', background: '#e8e8e8', fontWeight: 800, fontSize: '11px', width: '32px' }}>SL</th>
              <th style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'left', background: '#e8e8e8', fontWeight: 800, fontSize: '11px' }}>Particulars (Narration)</th>
              <th style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'right', background: '#e8e8e8', fontWeight: 800, fontSize: '11px', width: '120px' }}>Amount (Nu.)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: '1.5px solid #000', padding: '3px 6px', textAlign: 'center', fontWeight: 600 }}>1</td>
              <td style={{ border: '1.5px solid #000', padding: '3px 6px', fontWeight: 600 }}>
                {entry.description}
                {entry.reference && (
                  <div style={{ fontSize: '10px', color: '#555', fontWeight: 500 }}>Ref: {entry.reference}</div>
                )}
              </td>
              <td style={{ border: '1.5px solid #000', padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>{fmt(entry.amount)}</td>
            </tr>
            <tr>
              <td style={{ border: '1.5px solid #000', padding: '3px 6px', textAlign: 'center' }}>&nbsp;</td>
              <td style={{ border: '1.5px solid #000', padding: '3px 6px' }}>&nbsp;</td>
              <td style={{ border: '1.5px solid #000', padding: '3px 6px' }}></td>
            </tr>
            <tr>
              <td style={{ border: '1.5px solid #000', padding: '3px 6px', textAlign: 'center' }}>&nbsp;</td>
              <td style={{ border: '1.5px solid #000', padding: '3px 6px' }}>&nbsp;</td>
              <td style={{ border: '1.5px solid #000', padding: '3px 6px' }}></td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ border: '1.5px solid #000', padding: '3px 6px', fontWeight: 700 }}>
                {isReceived ? 'Total Amount Received' : 'Total Amount Paid'}
              </td>
              <td style={{ border: '1.5px solid #000', padding: '3px 6px', textAlign: 'right', fontWeight: 700 }}>{fmt(entry.amount)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Net amount row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #000', borderBottom: '2px solid #000', padding: '5px 0', marginTop: '-1px', marginBottom: '8px' }}>
          <span style={{ fontStyle: 'italic', fontSize: '10px', fontWeight: 600, flex: 1, paddingRight: '12px' }}>
            {numberToWords(entry.amount)}
          </span>
          <div style={{ display: 'flex', gap: '24px', fontWeight: 900, fontSize: '13px', whiteSpace: 'nowrap' }}>
            <span>{isReceived ? 'Amount Received' : 'Amount Paid'}</span>
            <span>Nu.&nbsp;{fmt(entry.amount)}</span>
          </div>
        </div>

        {/* Terms & footer */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ border: '1px dashed #000', padding: '2px 8px', fontWeight: 800, fontSize: '11px' }}>
              Terms &amp; Conditions:
            </span>
            <span style={{ fontStyle: 'italic', fontSize: '11px', fontWeight: 600 }}>E. &amp; O. E.</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 500, lineHeight: 1.4, flex: 1 }}>
              <p>We declare that this voucher shows the actual amount of the transaction described and that all particulars are true and correct.</p>
              <p style={{ marginTop: '2px', fontWeight: 700 }}>Bank Details: BOB: 225667231 — Please include voucher number in payment reference.</p>
            </div>
            <div style={{ fontWeight: 800, fontSize: '12px', whiteSpace: 'nowrap', paddingTop: '4px' }}>
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>

      {/* Buttons — matches InvoicePrint embedded layout */}
      <div className="no-print flex gap-2 mt-4 px-4 pb-4">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print Voucher
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </>
  );
}

// ── New Entry form ────────────────────────────────────────────────────────────

interface EntryForm {
  type: CashBookType;
  partyId: string;
  partyName: string;
  amount: string;
  description: string;
  reference: string;
  date: string;
  time: string;
}

function blankForm(): EntryForm {
  const now = new Date();
  return {
    type: 'received',
    partyId: '',
    partyName: '',
    amount: '',
    description: '',
    reference: '',
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CashBook() {
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState<EntryForm>(blankForm);
  const [saving, setSaving]             = useState(false);
  const [deletingId, setDeletingId]     = useState<number | null>(null);
  const [voucherEntry, setVoucherEntry] = useState<CashBookEntry | null>(null);

  // Filters
  const [search, setSearch]             = useState('');
  const [filterType, setFilterType]     = useState<CashBookType | ''>('');
  const [fromDate, setFromDate]         = useState('');
  const [toDate, setToDate]             = useState('');
  const [page, setPage]                 = useState(0);

  const entries = useLiveQuery(() => cashBookCRUD.getAll(), []);
  const parties = useLiveQuery(() => partyCRUD.getAll(), [], [] as (PartyRecord & { id: number })[]);

  // ── Filters ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries.filter(e => {
      const matchSearch =
        !search ||
        e.partyName.toLowerCase().includes(search.toLowerCase()) ||
        e.voucherNo.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        (e.reference || '').toLowerCase().includes(search.toLowerCase());
      const matchType = !filterType || e.type === filterType;
      const matchFrom = !fromDate || new Date(e.timestamp) >= new Date(fromDate);
      const matchTo   = !toDate   || new Date(e.timestamp) <= new Date(toDate + 'T23:59:59');
      return matchSearch && matchType && matchFrom && matchTo;
    });
  }, [entries, search, filterType, fromDate, toDate]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Running balance (desc order — show cumulative from oldest to newest, reversed for display)
  const totalIn  = filtered.reduce((s, e) => e.type === 'received' ? s + e.amount : s, 0);
  const totalOut = filtered.reduce((s, e) => e.type === 'payment'  ? s + e.amount : s, 0);
  const netCash  = totalIn - totalOut;

  // ── Save new entry ─────────────────────────────────────────────────────────
  async function saveEntry() {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0 || !form.description.trim() || !form.partyName.trim()) return;

    setSaving(true);
    const voucherNo = await cashBookCRUD.getNextVoucherNo();
    const ts = new Date(`${form.date}T${form.time}`);
    const newEntry: Omit<CashBookEntry, 'id'> = {
      voucherNo,
      timestamp: ts,
      type: form.type,
      partyId: form.partyId ? parseInt(form.partyId) : undefined,
      partyName: form.partyName.trim(),
      amount,
      description: form.description.trim(),
      reference: form.reference.trim() || undefined,
      syncStatus: 'pending',
    };

    const id = await cashBookCRUD.create(newEntry) as number;
    await postCashBookToGL({ ...newEntry, id });

    // Update linked party balance
    if (newEntry.partyId) {
      // Received: cash came in → party owes us less → balance ↓
      // Payment: cash went out → supplier owes us less to pay → balance ↑ (reduces liability)
      const delta = newEntry.type === 'received' ? -amount : amount;
      await partyCRUD.updateBalance(newEntry.partyId, delta);
    }

    setSaving(false);
    setShowModal(false);
    setForm(blankForm());
  }

  // ── Delete with cascade ────────────────────────────────────────────────────
  async function confirmDelete() {
    if (deletingId == null) return;
    const entry = await cashBookCRUD.getById(deletingId);
    if (entry) {
      // Reverse party balance
      if (entry.partyId) {
        const delta = entry.type === 'received' ? entry.amount : -entry.amount;
        await partyCRUD.updateBalance(entry.partyId, delta);
      }
      // Clear GL
      await glCRUD.deleteByRef(entry.voucherNo);
      // Delete record
      await cashBookCRUD.delete(deletingId);
    }
    setDeletingId(null);
  }

  // ── Party selection helper ─────────────────────────────────────────────────
  function onPartySelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const partyId = e.target.value;
    setForm(f => {
      const party = (parties || []).find(p => String(p.id) === partyId);
      return { ...f, partyId, partyName: party ? party.name : f.partyName };
    });
  }

  if (entries === undefined) {
    return <div className="text-slate-400 text-sm p-8 text-center animate-pulse">Loading cash book…</div>;
  }

  return (
    <div className="space-y-4">

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Inflows', value: totalIn,  color: 'text-green-400', icon: ArrowDownLeft, bg: 'bg-green-500/10 border-green-500/20' },
          { label: 'Total Outflows', value: totalOut, color: 'text-red-400',   icon: ArrowUpRight,  bg: 'bg-red-500/10 border-red-500/20'   },
          { label: 'Net Cash',      value: netCash,  color: netCash >= 0 ? 'text-orange-400' : 'text-red-400', icon: null, bg: 'bg-slate-700/50 border-slate-600' },
        ].map(c => (
          <div key={c.label} className={`border rounded-xl px-4 py-3 ${c.bg}`}>
            <p className="text-slate-400 text-xs">{c.label}</p>
            <p className={`text-xl font-bold font-mono mt-1 ${c.color}`}>Nu. {fmt(c.value)}</p>
          </div>
        ))}
      </div>

      {/* ── Filters + New button ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-end bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex-1 min-w-44">
          <label className="block text-slate-400 text-xs mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              className={inputCls + ' pl-9'}
              placeholder="Party, voucher, description…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Type</label>
          <select
            className={inputCls + ' w-auto'}
            value={filterType}
            onChange={e => { setFilterType(e.target.value as CashBookType | ''); setPage(0); }}
          >
            <option value="">All</option>
            <option value="received">Cash Received</option>
            <option value="payment">Cash Payment</option>
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">From</label>
          <input type="date" className={inputCls + ' w-auto'} value={fromDate}
            onChange={e => { setFromDate(e.target.value); setPage(0); }} />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">To</label>
          <input type="date" className={inputCls + ' w-auto'} value={toDate}
            onChange={e => { setToDate(e.target.value); setPage(0); }} />
        </div>
        <button
          onClick={() => { setSearch(''); setFilterType(''); setFromDate(''); setToDate(''); setPage(0); }}
          className="flex items-center gap-1.5 border border-slate-600 hover:border-orange-500 text-slate-400 hover:text-orange-400 px-3 py-2 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Clear
        </button>
        <button
          onClick={() => { setForm(blankForm()); setShowModal(true); }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-auto"
        >
          <Plus className="w-4 h-4" /> New Entry
        </button>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-xs">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">Date/Time</th>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">Voucher No</th>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">Type</th>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">Party</th>
              <th className="text-right px-3 py-3 text-slate-400 font-medium">Amount (Nu.)</th>
              <th className="text-left px-3 py-3 text-slate-400 font-medium max-w-48">Description</th>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">Ref</th>
              <th className="text-center px-3 py-3 text-slate-400 font-medium w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-500">
                  No cash book entries found.
                </td>
              </tr>
            ) : pageRows.map(entry => (
              <tr
                key={entry.id}
                className="border-t border-slate-700/60 hover:bg-slate-700/20 transition-colors"
              >
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{fmtDateTime(entry.timestamp)}</td>
                <td className="px-3 py-2.5 text-orange-400 font-mono whitespace-nowrap">{entry.voucherNo}</td>
                <td className="px-3 py-2.5">
                  <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                    entry.type === 'received'
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-red-500/15 text-red-400'
                  }`}>
                    {entry.type === 'received'
                      ? <ArrowDownLeft className="w-2.5 h-2.5" />
                      : <ArrowUpRight className="w-2.5 h-2.5" />}
                    {entry.type === 'received' ? 'Received' : 'Payment'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-white font-medium">{entry.partyName}</td>
                <td className={`px-3 py-2.5 text-right font-mono font-semibold ${
                  entry.type === 'received' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {entry.type === 'received' ? '+' : '−'} {fmt(entry.amount)}
                </td>
                <td className="px-3 py-2.5 text-slate-400 max-w-48 truncate">{entry.description}</td>
                <td className="px-3 py-2.5 text-slate-500 font-mono text-[10px]">{entry.reference || '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setVoucherEntry(entry)}
                      title="Preview & print voucher"
                      className="text-slate-500 hover:text-orange-400 transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingId(entry.id!)}
                      title="Delete entry"
                      className="text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            Page {page + 1} of {totalPages} &nbsp;·&nbsp; {filtered.length} entries
          </span>
          <div className="flex gap-1">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 text-xs">
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 text-xs">
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          NEW ENTRY MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-base">New Cash Book Entry</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type toggle */}
            <div className="flex gap-2">
              {(['received', 'payment'] as CashBookType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                    form.type === t
                      ? t === 'received'
                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                        : 'bg-red-500/20 border-red-500/50 text-red-400'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                  }`}
                >
                  {t === 'received'
                    ? <><ArrowDownLeft className="w-4 h-4" /> Cash Received</>
                    : <><ArrowUpRight className="w-4 h-4" /> Cash Payment</>}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Date */}
              <div>
                <label className="block text-slate-400 text-xs mb-1">Date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              {/* Time */}
              <div>
                <label className="block text-slate-400 text-xs mb-1">Time</label>
                <input
                  type="time"
                  className={inputCls}
                  value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                />
              </div>

              {/* Party dropdown */}
              <div className="col-span-2">
                <label className="block text-slate-400 text-xs mb-1">Party (optional — links to ledger)</label>
                <select className={inputCls} value={form.partyId} onChange={onPartySelect}>
                  <option value="">— Select party —</option>
                  {(parties || []).map(p => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} ({p.partyType})
                    </option>
                  ))}
                </select>
              </div>

              {/* Party name (editable even without selecting from list) */}
              <div className="col-span-2">
                <label className="block text-slate-400 text-xs mb-1">Party Name *</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Dzongkhag Administration, Paro"
                  value={form.partyName}
                  onChange={e => setForm(f => ({ ...f, partyName: e.target.value }))}
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-slate-400 text-xs mb-1">Amount (Nu.) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={inputCls}
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>

              {/* Reference */}
              <div>
                <label className="block text-slate-400 text-xs mb-1">Reference (optional)</label>
                <input
                  className={inputCls}
                  placeholder="Invoice #, PO #, Cheque #…"
                  value={form.reference}
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div className="col-span-2">
                <label className="block text-slate-400 text-xs mb-1">Description / Narration *</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Received against Invoice #000567 — payment in full"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            {/* Preview amount */}
            {form.amount && parseFloat(form.amount) > 0 && (
              <div className={`rounded-lg px-4 py-2.5 text-sm font-semibold font-mono text-center border ${
                form.type === 'received'
                  ? 'bg-green-500/10 border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {form.type === 'received' ? 'INFLOW' : 'OUTFLOW'} &nbsp;·&nbsp;
                Nu. {fmt(parseFloat(form.amount) || 0)}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={saveEntry}
                disabled={saving || !form.description.trim() || !form.partyName.trim() || !parseFloat(form.amount)}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save Entry'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Voucher preview modal ──────────────────────────────────────────── */}
      {voucherEntry && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setVoucherEntry(null)}
        >
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl relative">
            <button
              onClick={() => setVoucherEntry(null)}
              className="no-print absolute top-3 right-3 z-10 bg-slate-100 hover:bg-slate-200 rounded-full p-1.5 transition-colors"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
            <VoucherPrint entry={voucherEntry} onClose={() => setVoucherEntry(null)} />
          </div>
        </div>
      )}

      {/* ── Delete confirm ─────────────────────────────────────────────────── */}
      {deletingId != null && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-red-500/30 rounded-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Delete Cash Entry?</h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  GL entries will be removed and party balance reversed.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
