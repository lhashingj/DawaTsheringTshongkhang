'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  CreditNote,
  ReturnItem,
  ReturnSettlement,
  UnitType,
  InventoryItem,
  creditNoteCRUD,
  inventoryCRUD,
  partyCRUD,
  postCreditNoteToGL,
} from '@/lib/accounting-db';
import {
  Plus, Trash2, Search, RefreshCw, X, Save, AlertTriangle,
  ChevronLeft, ChevronRight, RotateCcw, ArrowDownLeft,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const UNIT_TYPES: UnitType[] = ['EACH', 'PCS', 'KG', 'MTR', 'SET', 'BOX', 'LTR', 'NOS', 'PAIR'];
const GST_RATE = 5;
const PAGE_SIZE = 25;

const inputCls =
  'w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:border-orange-500 placeholder-slate-400';

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Item row form state ───────────────────────────────────────────────────────

interface ItemRow {
  description: string;
  qty: string;
  unit: UnitType;
  rate: string;
}

function blankItem(): ItemRow {
  return { description: '', qty: '', unit: 'EACH', rate: '' };
}

// ── Main component ────────────────────────────────────────────────────────────

export function CustomerReturns() {
  const [showModal, setShowModal]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Filters
  const [search, setSearch]   = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [page, setPage]         = useState(0);

  // Form state
  const [partyId, setPartyId]                   = useState('');
  const [partyName, setPartyName]               = useState('');
  const [originalInvoiceNo, setOriginalInvoice] = useState('');
  const [settlementType, setSettlement]         = useState<ReturnSettlement>('ledger');
  const [notes, setNotes]                       = useState('');
  const [date, setDate]                         = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems]                       = useState<ItemRow[]>([blankItem()]);

  const creditNotes = useLiveQuery(() => db.creditNotes.orderBy('timestamp').reverse().toArray(), []);
  const parties     = useLiveQuery(() => db.parties.where('partyType').anyOf(['customer', 'both']).toArray(), []);
  const inventory   = useLiveQuery(() => db.inventory.orderBy('description').toArray(), []);

  // ── Computed totals ────────────────────────────────────────────────────────
  const computedItems: ReturnItem[] = useMemo(() => items.map(i => ({
    description: i.description,
    qty: parseFloat(i.qty) || 0,
    unit: i.unit,
    rate: parseFloat(i.rate) || 0,
    amount: Math.round((parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0) * 100) / 100,
  })), [items]);

  const grossAmount = computedItems.reduce((s, i) => s + i.amount, 0);
  const gstAmount   = Math.round(grossAmount * GST_RATE) / 100;
  const netAmount   = Math.round((grossAmount + gstAmount) * 100) / 100;

  // ── Filters ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!creditNotes) return [];
    return creditNotes.filter(cn => {
      const matchSearch =
        !search ||
        cn.partyName.toLowerCase().includes(search.toLowerCase()) ||
        cn.creditNoteNo.toLowerCase().includes(search.toLowerCase()) ||
        (cn.originalInvoiceNo || '').toLowerCase().includes(search.toLowerCase());
      const matchFrom = !fromDate || new Date(cn.timestamp) >= new Date(fromDate);
      const matchTo   = !toDate   || new Date(cn.timestamp) <= new Date(toDate + 'T23:59:59');
      return matchSearch && matchFrom && matchTo;
    });
  }, [creditNotes, search, fromDate, toDate]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Inventory suggestion state ─────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<{ idx: number; list: InventoryItem[] } | null>(null);

  // ── Item row helpers ───────────────────────────────────────────────────────
  function updateItem(idx: number, field: keyof ItemRow, value: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function onDescriptionChange(idx: number, value: string) {
    updateItem(idx, 'description', value);
    if (value.trim().length >= 2 && inventory) {
      const q = value.toLowerCase();
      const matches = inventory.filter(i => i.description.toLowerCase().includes(q)).slice(0, 6);
      setSuggestions(matches.length > 0 ? { idx, list: matches } : null);
    } else {
      setSuggestions(null);
    }
  }

  function selectInventoryItem(idx: number, inv: InventoryItem) {
    setItems(prev => prev.map((it, i) => i === idx
      ? { ...it, description: inv.description, unit: inv.unit, rate: inv.baseRate.toString() }
      : it
    ));
    setSuggestions(null);
  }

  function removeItem(idx: number) {
    setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }

  // ── Submit credit note ─────────────────────────────────────────────────────
  async function submit() {
    const validItems = computedItems.filter(i => i.description && i.qty > 0 && i.rate > 0);
    if (!partyName.trim() || validItems.length === 0) return;

    setSaving(true);
    const creditNoteNo = await creditNoteCRUD.getNextCNNo();
    const ts = new Date(date + 'T' + new Date().toTimeString().slice(0, 5));

    const cn: Omit<CreditNote, 'id'> = {
      creditNoteNo,
      timestamp: ts,
      originalInvoiceNo: originalInvoiceNo.trim() || undefined,
      partyId: partyId ? parseInt(partyId) : undefined,
      partyName: partyName.trim(),
      items: validItems,
      grossAmount,
      gstRate: GST_RATE,
      gstAmount,
      netAmount,
      settlementType,
      notes: notes.trim() || undefined,
      syncStatus: 'pending',
    };

    const id = await creditNoteCRUD.create(cn) as number;
    await postCreditNoteToGL({ ...cn, id });

    // Restore inventory stock for each returned item
    for (const item of validItems) {
      const inv = (inventory || []).find(
        i => i.description.toLowerCase().trim() === item.description.toLowerCase().trim()
      );
      if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, item.qty);
    }

    // Update party balance: customer gets credit → their outstanding balance decreases
    if (cn.partyId) {
      await partyCRUD.updateBalance(cn.partyId, -cn.netAmount);
    }

    setSaving(false);
    resetForm();
    setShowModal(false);
  }

  function resetForm() {
    setPartyId('');
    setPartyName('');
    setOriginalInvoice('');
    setSettlement('ledger');
    setNotes('');
    setDate(new Date().toISOString().slice(0, 10));
    setItems([blankItem()]);
  }

  // ── Delete credit note with cascade ───────────────────────────────────────
  async function confirmDelete() {
    if (deletingId == null) return;
    const cn = await db.creditNotes.get(deletingId);
    if (cn) {
      // Reverse inventory (remove stock again)
      for (const item of cn.items) {
        const inv = await db.inventory
          .filter(i => i.description.toLowerCase().trim() === item.description.toLowerCase().trim())
          .first();
        if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, -item.qty);
      }
      // Reverse party balance
      if (cn.partyId) await partyCRUD.updateBalance(cn.partyId, cn.netAmount);
      // Clear GL
      await db.generalLedger.where('transactionRef').equals(cn.creditNoteNo).delete();
      await creditNoteCRUD.delete(deletingId);
    }
    setDeletingId(null);
  }

  if (!creditNotes || !parties) {
    return <div className="text-slate-400 text-sm p-8 text-center animate-pulse">Loading…</div>;
  }

  return (
    <div className="space-y-4">

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
        <RotateCcw className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-blue-300 text-xs leading-relaxed">
          <span className="font-semibold">Customer Returns (Credit Notes)</span> — When a customer returns goods,
          a credit note reverses the original sale revenue, reduces the GST liability, restores physical stock,
          and credits the customer's outstanding balance or issues a cash refund.
        </p>
      </div>

      {/* Filters + button */}
      <div className="flex flex-wrap gap-3 items-end bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex-1 min-w-44">
          <label className="block text-slate-400 text-xs mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              className={inputCls + ' pl-9'}
              placeholder="Party, CN#, invoice…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
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
          onClick={() => { setSearch(''); setFromDate(''); setToDate(''); setPage(0); }}
          className="flex items-center gap-1.5 border border-slate-600 hover:border-orange-500 text-slate-400 hover:text-orange-400 px-3 py-2 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Clear
        </button>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-auto"
        >
          <Plus className="w-4 h-4" /> New Credit Note
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-xs">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">Date</th>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">CN #</th>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">Party</th>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">Orig. Invoice</th>
              <th className="text-right px-3 py-3 text-slate-400 font-medium">Gross</th>
              <th className="text-right px-3 py-3 text-slate-400 font-medium">GST (5%)</th>
              <th className="text-right px-3 py-3 text-slate-400 font-medium">Net</th>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">Settlement</th>
              <th className="text-center px-3 py-3 text-slate-400 font-medium w-12">Del</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-500">
                  No credit notes yet.
                </td>
              </tr>
            ) : pageRows.map(cn => (
              <tr key={cn.id} className="border-t border-slate-700/60 hover:bg-slate-700/20 transition-colors">
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{fmtDate(cn.timestamp)}</td>
                <td className="px-3 py-2.5 text-orange-400 font-mono whitespace-nowrap">{cn.creditNoteNo}</td>
                <td className="px-3 py-2.5 text-white font-medium">{cn.partyName}</td>
                <td className="px-3 py-2.5 text-slate-400 font-mono">{cn.originalInvoiceNo || '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-300">{fmt(cn.grossAmount)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-400">{fmt(cn.gstAmount)}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-orange-400">{fmt(cn.netAmount)}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    cn.settlementType === 'cash'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {cn.settlementType === 'cash' ? 'Cash Refund' : 'Ledger Credit'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <button
                    onClick={() => setDeletingId(cn.id!)}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Page {page + 1} of {totalPages}</span>
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
          NEW CREDIT NOTE MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-base flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-orange-400" />
                  New Credit Note — Customer Return
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Reverses revenue, GST liability, restores stock, and credits the customer ledger.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Header fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Date</label>
                <input type="date" className={inputCls} value={date}
                  onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Original Invoice # (optional)</label>
                <input className={inputCls} placeholder="e.g. 25-0042"
                  value={originalInvoiceNo} onChange={e => setOriginalInvoice(e.target.value)} />
              </div>

              {/* Customer party */}
              <div>
                <label className="block text-slate-400 text-xs mb-1">Customer (select)</label>
                <select
                  className={inputCls}
                  value={partyId}
                  onChange={e => {
                    const id = e.target.value;
                    setPartyId(id);
                    const p = (parties || []).find(p => String(p.id) === id);
                    if (p) setPartyName(p.name);
                  }}
                >
                  <option value="">— Select customer —</option>
                  {(parties || []).map(p => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Customer Name *</label>
                <input className={inputCls} placeholder="Name"
                  value={partyName} onChange={e => setPartyName(e.target.value)} />
              </div>

              {/* Settlement type */}
              <div className="col-span-2">
                <label className="block text-slate-400 text-xs mb-1">Settlement Method</label>
                <div className="flex gap-2">
                  {([
                    { v: 'ledger' as ReturnSettlement, label: 'Ledger Credit', sub: 'Reduce customer outstanding balance' },
                    { v: 'cash'   as ReturnSettlement, label: 'Cash Refund',   sub: 'Issue physical cash back to customer' },
                  ]).map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setSettlement(opt.v)}
                      className={`flex-1 text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
                        settlementType === opt.v
                          ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                          : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Items grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-slate-400 text-xs font-medium">Returned Items</label>
                <button
                  onClick={() => setItems(i => [...i, blankItem()])}
                  className="flex items-center gap-1 text-orange-400 hover:text-orange-300 text-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {/* Header row */}
                <div className="grid grid-cols-12 gap-2 px-1">
                  {['Description', 'Qty', 'Unit', 'Rate', 'Amount', ''].map((h, i) => (
                    <div key={h} className={`text-[9px] text-slate-500 uppercase tracking-wide font-semibold ${
                      i === 0 ? 'col-span-4' : i === 4 ? 'col-span-2 text-right' : i === 5 ? 'col-span-1' : 'col-span-2'
                    }`}>{h}</div>
                  ))}
                </div>

                {items.map((item, idx) => {
                  const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      {/* Description with inventory suggestions */}
                      <div className="col-span-4 relative">
                        <input
                          className={inputCls + ' text-xs py-1.5'}
                          placeholder="Search inventory…"
                          value={item.description}
                          onChange={e => onDescriptionChange(idx, e.target.value)}
                          onBlur={() => setTimeout(() => setSuggestions(null), 150)}
                        />
                        {suggestions?.idx === idx && suggestions.list.length > 0 && (
                          <div className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-slate-700 border border-slate-600 rounded-lg overflow-hidden shadow-xl">
                            {suggestions.list.map(inv => (
                              <button
                                key={inv.id}
                                type="button"
                                onMouseDown={() => selectInventoryItem(idx, inv)}
                                className="w-full text-left px-3 py-2 hover:bg-slate-600 transition-colors text-xs border-b border-slate-600 last:border-0"
                              >
                                <span className="text-white">{inv.description}</span>
                                <span className="text-slate-400 ml-2">Nu.{inv.baseRate}/{inv.unit} · Stock:{inv.stockQty}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number" min="0.001" step="0.001"
                          className={inputCls + ' text-xs py-1.5'}
                          placeholder="Qty"
                          value={item.qty}
                          onChange={e => updateItem(idx, 'qty', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <select
                          className={inputCls + ' text-xs py-1.5'}
                          value={item.unit}
                          onChange={e => updateItem(idx, 'unit', e.target.value)}
                        >
                          {UNIT_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number" min="0" step="0.01"
                          className={inputCls + ' text-xs py-1.5'}
                          placeholder="Rate"
                          value={item.rate}
                          onChange={e => updateItem(idx, 'rate', e.target.value)}
                        />
                      </div>
                      <div className="col-span-1 text-right font-mono text-xs text-slate-300 pr-1">
                        {amount > 0 ? fmt(amount) : '—'}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => removeItem(idx)}
                          className="text-slate-600 hover:text-red-400 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* Totals */}
            {grossAmount > 0 && (
              <div className="bg-slate-700/40 rounded-lg px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Gross Return Amount</span>
                  <span className="text-white font-mono">Nu. {fmt(grossAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">GST 5% (reversed)</span>
                  <span className="text-red-400 font-mono">− Nu. {fmt(gstAmount)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-600 pt-1.5 mt-1">
                  <span className="text-white font-semibold">Total Credit / Refund</span>
                  <span className="text-orange-400 font-mono font-bold">Nu. {fmt(netAmount)}</span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-slate-400 text-xs mb-1">Notes (optional)</label>
              <input className={inputCls} placeholder="Reason for return, condition of goods, etc."
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={submit}
                disabled={saving || !partyName.trim() || grossAmount === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Processing…' : 'Issue Credit Note'}
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

      {/* Delete confirm */}
      {deletingId != null && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-red-500/30 rounded-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Reverse Credit Note?</h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Stock will be deducted again, GL entries removed, and party balance restored.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={confirmDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                Confirm Reversal
              </button>
              <button onClick={() => setDeletingId(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
