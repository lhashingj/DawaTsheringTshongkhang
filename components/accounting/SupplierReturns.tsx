'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DebitNote,
  ReturnItem,
  UnitType,
  InventoryItem,
  PartyRecord,
  debitNoteCRUD,
  inventoryCRUD,
  partyCRUD,
  glCRUD,
  postDebitNoteToGL,
} from '@/lib/accounting-db';
import {
  Plus, Trash2, Search, RefreshCw, X, Save, AlertTriangle,
  ChevronLeft, ChevronRight, PackageX,
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

export function SupplierReturns() {
  const [showModal, setShowModal]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Filters
  const [search, setSearch]     = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [page, setPage]         = useState(0);

  // Form state
  const [partyId, setPartyId]       = useState('');
  const [partyName, setPartyName]   = useState('');
  const [originalPONo, setOrigPO]   = useState('');
  const [notes, setNotes]           = useState('');
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems]           = useState<ItemRow[]>([blankItem()]);

  const [debitNotes, setDebitNotes] = useState<(DebitNote & { id: number })[] | null>(null);
  const [parties, setParties]       = useState<(PartyRecord & { id: number })[] | null>(null);
  const [inventory, setInventory]   = useState<(InventoryItem & { id: number })[] | null>(null);

  const loadDebitNotes = useCallback(() => debitNoteCRUD.getAll().then(setDebitNotes), []);
  const loadParties    = useCallback(() =>
    partyCRUD.getAll().then(all => setParties(all.filter(p => p.partyType === 'supplier' || p.partyType === 'both'))),
    []);
  const loadInventory  = useCallback(() => inventoryCRUD.getAll().then(setInventory), []);

  useEffect(() => { loadDebitNotes(); }, [loadDebitNotes]);
  useEffect(() => { loadParties(); },   [loadParties]);
  useEffect(() => { loadInventory(); }, [loadInventory]);

  // ── Computed totals ────────────────────────────────────────────────────────
  const computedItems: ReturnItem[] = useMemo(() => items.map(i => ({
    description: i.description,
    qty:   parseFloat(i.qty)  || 0,
    unit:  i.unit,
    rate:  parseFloat(i.rate) || 0,
    amount: Math.round((parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0) * 100) / 100,
  })), [items]);

  const grossAmount = computedItems.reduce((s, i) => s + i.amount, 0);
  const gstAmount   = Math.round(grossAmount * GST_RATE) / 100;
  const netAmount   = Math.round((grossAmount + gstAmount) * 100) / 100;

  // ── Filters ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (debitNotes === null) return [];
    return debitNotes.filter(dn => {
      const matchSearch =
        !search ||
        dn.partyName.toLowerCase().includes(search.toLowerCase()) ||
        dn.debitNoteNo.toLowerCase().includes(search.toLowerCase()) ||
        (dn.originalPONo || '').toLowerCase().includes(search.toLowerCase());
      const matchFrom = !fromDate || new Date(dn.timestamp) >= new Date(fromDate);
      const matchTo   = !toDate   || new Date(dn.timestamp) <= new Date(toDate + 'T23:59:59');
      return matchSearch && matchFrom && matchTo;
    });
  }, [debitNotes, search, fromDate, toDate]);

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

  // ── Submit debit note ──────────────────────────────────────────────────────
  async function submit() {
    const validItems = computedItems.filter(i => i.description && i.qty > 0 && i.rate > 0);
    if (!partyName.trim() || validItems.length === 0) return;

    setSaving(true);
    const debitNoteNo = await debitNoteCRUD.getNextDNNo();
    const ts = new Date(date + 'T' + new Date().toTimeString().slice(0, 5));

    const dn: Omit<DebitNote, 'id'> = {
      debitNoteNo,
      timestamp: ts,
      originalPONo: originalPONo.trim() || undefined,
      partyId: partyId ? parseInt(partyId) : undefined,
      partyName: partyName.trim(),
      items: validItems,
      grossAmount,
      gstRate: GST_RATE,
      gstAmount,
      netAmount,
      notes: notes.trim() || undefined,
      syncStatus: 'pending',
    };

    const id = await debitNoteCRUD.create(dn) as number;
    await postDebitNoteToGL({ ...dn, id });

    // Remove stock from inventory (goods physically returned to supplier)
    for (const item of validItems) {
      const inv = (inventory || []).find(
        i => i.description.toLowerCase().trim() === item.description.toLowerCase().trim()
      );
      if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, -item.qty);
    }

    // Reduce our AP to supplier: we're returning goods worth netAmount,
    // so supplier owes us that credit → increase their balance (less negative = less we owe)
    if (dn.partyId) {
      await partyCRUD.updateBalance(dn.partyId, dn.netAmount);
    }

    setSaving(false);
    resetForm();
    setShowModal(false);
    loadDebitNotes();
    loadInventory();
  }

  function resetForm() {
    setPartyId('');
    setPartyName('');
    setOrigPO('');
    setNotes('');
    setDate(new Date().toISOString().slice(0, 10));
    setItems([blankItem()]);
  }

  // ── Delete debit note with cascade ─────────────────────────────────────────
  async function confirmDelete() {
    if (deletingId == null) return;
    const dn = await debitNoteCRUD.getById(deletingId);
    if (dn) {
      // Reverse inventory (add stock back) — load all, filter client-side
      const allInv = await inventoryCRUD.getAll();
      for (const item of dn.items) {
        const inv = allInv.find(i => i.description.toLowerCase().trim() === item.description.toLowerCase().trim());
        if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, item.qty);
      }
      // Reverse party balance (we owe them again)
      if (dn.partyId) await partyCRUD.updateBalance(dn.partyId, -dn.netAmount);
      // Clear GL
      await glCRUD.deleteByRef(dn.debitNoteNo);
      await debitNoteCRUD.delete(deletingId);
    }
    setDeletingId(null);
    loadDebitNotes();
    loadInventory();
  }

  if (debitNotes === null || parties === null) {
    return <div className="text-slate-400 text-sm p-8 text-center animate-pulse">Loading…</div>;
  }

  return (
    <div className="space-y-4">

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3">
        <PackageX className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <p className="text-purple-300 text-xs leading-relaxed">
          <span className="font-semibold">Supplier Returns (Debit Notes)</span> — When we return faulty or
          excess stock to a supplier, a debit note reduces our Accounts Payable, removes the stock from
          inventory, and reverses the GST input credit we originally claimed.
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
              placeholder="Supplier, DN#, PO#…"
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
          <Plus className="w-4 h-4" /> New Debit Note
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-xs">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">Date</th>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">DN #</th>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">Supplier</th>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">Orig. PO</th>
              <th className="text-right px-3 py-3 text-slate-400 font-medium">Gross</th>
              <th className="text-right px-3 py-3 text-slate-400 font-medium">GST (5%)</th>
              <th className="text-right px-3 py-3 text-slate-400 font-medium">Net AP Reduction</th>
              <th className="text-left px-3 py-3 text-slate-400 font-medium">Items</th>
              <th className="text-center px-3 py-3 text-slate-400 font-medium w-12">Del</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-500">
                  No debit notes yet.
                </td>
              </tr>
            ) : pageRows.map(dn => (
              <tr key={dn.id} className="border-t border-slate-700/60 hover:bg-slate-700/20 transition-colors">
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{fmtDate(dn.timestamp)}</td>
                <td className="px-3 py-2.5 text-orange-400 font-mono whitespace-nowrap">{dn.debitNoteNo}</td>
                <td className="px-3 py-2.5 text-white font-medium">{dn.partyName}</td>
                <td className="px-3 py-2.5 text-slate-400 font-mono">{dn.originalPONo || '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-300">{fmt(dn.grossAmount)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-400">{fmt(dn.gstAmount)}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-orange-400">{fmt(dn.netAmount)}</td>
                <td className="px-3 py-2.5 text-slate-400">
                  <span className="bg-slate-700 text-slate-300 text-[10px] px-1.5 py-0.5 rounded">
                    {dn.items.length} line{dn.items.length !== 1 ? 's' : ''}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <button
                    onClick={() => setDeletingId(dn.id!)}
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
          NEW DEBIT NOTE MODAL
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
                  <PackageX className="w-4 h-4 text-orange-400" />
                  New Debit Note — Supplier Return
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Reduces AP, removes inventory, and reverses GST input credit.
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
                <label className="block text-slate-400 text-xs mb-1">Original PO # (optional)</label>
                <input className={inputCls} placeholder="e.g. PO-0042"
                  value={originalPONo} onChange={e => setOrigPO(e.target.value)} />
              </div>

              {/* Supplier party */}
              <div>
                <label className="block text-slate-400 text-xs mb-1">Supplier (select)</label>
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
                  <option value="">— Select supplier —</option>
                  {(parties || []).map(p => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Supplier Name *</label>
                <input className={inputCls} placeholder="Supplier name"
                  value={partyName} onChange={e => setPartyName(e.target.value)} />
              </div>
            </div>

            {/* Items grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-slate-400 text-xs font-medium">Items Being Returned</label>
                <button
                  onClick={() => setItems(i => [...i, blankItem()])}
                  className="flex items-center gap-1 text-orange-400 hover:text-orange-300 text-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-1">
                  {['Description', 'Qty', 'Unit', 'Rate', 'Amount', ''].map((h, i) => (
                    <div key={h + i} className={`text-[9px] text-slate-500 uppercase tracking-wide font-semibold ${
                      i === 0 ? 'col-span-4' : i === 4 ? 'col-span-2 text-right' : i === 5 ? 'col-span-1' : 'col-span-2'
                    }`}>{h}</div>
                  ))}
                </div>

                {items.map((item, idx) => {
                  const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
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
                  <span className="text-slate-400">Gross Return Value</span>
                  <span className="text-white font-mono">Nu. {fmt(grossAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">GST 5% (input credit reversed)</span>
                  <span className="text-purple-400 font-mono">− Nu. {fmt(gstAmount)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-600 pt-1.5 mt-1">
                  <span className="text-white font-semibold">Net AP Reduction</span>
                  <span className="text-orange-400 font-mono font-bold">Nu. {fmt(netAmount)}</span>
                </div>
                <p className="text-slate-500 text-[10px] pt-0.5">
                  Accounts Payable will be reduced by Nu. {fmt(netAmount)}.
                  Physical stock for all {computedItems.filter(i => i.qty > 0).length} item(s) will be decremented.
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-slate-400 text-xs mb-1">Notes (optional)</label>
              <input className={inputCls} placeholder="Reason for return, batch/lot numbers, condition, etc."
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={submit}
                disabled={saving || !partyName.trim() || grossAmount === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Processing…' : 'Issue Debit Note'}
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
                <h3 className="text-white font-semibold">Reverse Debit Note?</h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Stock will be restored, GL entries removed, and AP balance reversed.
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
