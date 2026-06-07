'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  purchaseCRUD, partyCRUD, inventoryCRUD,
  PurchaseRecord, PurchaseItem, InventoryItem, UnitType, PartyRecord,
  autoIncrementStock, postPurchaseToGL,
} from '@/lib/accounting-db';
import { deletePurchaseWithCascade, editPurchaseWithCascade } from '@/lib/ledger-mutations';
import { Eye, Trash2, Edit2, X, Plus, Search, ChevronDown } from 'lucide-react';

const UNITS: UnitType[] = ['EACH', 'PCS', 'KG', 'MTR', 'SET', 'BOX', 'LTR', 'NOS'];
const inputCls = 'w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-400';

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtNum(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

type ModalMode = 'view' | 'edit' | 'add' | null;

const emptyForm = (): Omit<PurchaseRecord, 'id'> => ({
  purchaseOrderNo: '',
  timestamp: new Date(),
  supplierName: '',
  supplierPhone: '',
  supplierAddress: '',
  supplierTPN: '',
  items: [],
  grossAmount: 0,
  gstRate: 5,
  gstAmount: 0,
  netAmount: 0,
  syncStatus: 'pending',
});

export function PurchaseLedger() {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<PurchaseRecord | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [formItems, setFormItems] = useState<PurchaseItem[]>([]);
  const [newItem, setNewItem] = useState({ description: '', qty: '1', unit: 'EACH' as UnitType, rate: '' });
  const [search, setSearch] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);

  // Inventory autocomplete
  const [invSuggestions, setInvSuggestions] = useState<InventoryItem[]>([]);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const descRef = useRef<HTMLInputElement>(null);

  const [purchases, setPurchases] = useState<(PurchaseRecord & { id: number })[] | null>(null);
  const [supplierParties, setSupplierParties] = useState<(PartyRecord & { id: number })[] | null>(null);
  const [inventory, setInventory] = useState<(InventoryItem & { id: number })[] | null>(null);

  const loadPurchases = useCallback(() => purchaseCRUD.getAll().then(setPurchases), []);
  const loadParties = useCallback(() =>
    partyCRUD.getAll().then(all =>
      setSupplierParties(all.filter(p => p.partyType === 'supplier' || p.partyType === 'both'))
    ), []);
  const loadInventory = useCallback(() => inventoryCRUD.getAll().then(setInventory), []);

  useEffect(() => { loadPurchases(); }, [loadPurchases]);
  useEffect(() => { loadParties(); }, [loadParties]);
  useEffect(() => { loadInventory(); }, [loadInventory]);

  // Compute suggestions when description changes
  useEffect(() => {
    const q = newItem.description.trim().toLowerCase();
    if (q.length < 2 || !inventory) {
      setInvSuggestions([]);
      return;
    }
    setInvSuggestions(inventory.filter(i => i.description.toLowerCase().includes(q)).slice(0, 7));
  }, [newItem.description, inventory]);

  // Update dropdown position whenever suggestions change
  useEffect(() => {
    if (invSuggestions.length > 0 && descRef.current) {
      const r = descRef.current.getBoundingClientRect();
      setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width });
    } else {
      setDropdownPos(null);
    }
  }, [invSuggestions]);

  function selectInvSuggestion(inv: InventoryItem) {
    setNewItem(p => ({ ...p, description: inv.description, unit: inv.unit }));
    setInvSuggestions([]);
  }

  const filtered = (purchases || []).filter(p => {
    const matchSearch = !search || p.purchaseOrderNo.includes(search) || p.supplierName?.toLowerCase().includes(search.toLowerCase());
    const matchFrom = !filterFrom || new Date(p.timestamp) >= new Date(filterFrom);
    const matchTo = !filterTo || new Date(p.timestamp) <= new Date(filterTo + 'T23:59:59');
    return matchSearch && matchFrom && matchTo;
  });

  const totalNet = filtered.reduce((s, r) => s + r.netAmount, 0);
  const totalGst = filtered.reduce((s, r) => s + r.gstAmount, 0);

  function selectSupplier(partyId: number) {
    const party = (supplierParties || []).find(p => p.id === partyId);
    if (!party) return;
    setSelectedPartyId(partyId);
    setForm(f => ({
      ...f,
      supplierName: party.name,
      supplierPhone: party.phone || '',
      supplierAddress: party.address || '',
      supplierTPN: party.tpn || '',
    }));
  }

  function addFormItem() {
    const qty = parseFloat(newItem.qty);
    const rate = parseFloat(newItem.rate);
    if (!newItem.description.trim() || isNaN(qty) || qty <= 0 || isNaN(rate) || rate <= 0) return;
    setFormItems(prev => [...prev, { description: newItem.description.trim(), qty, unit: newItem.unit, rate, amount: qty * rate }]);
    setNewItem({ description: '', qty: '1', unit: 'EACH', rate: '' });
    setInvSuggestions([]);
  }

  function computeTotals(items: PurchaseItem[], gstRate: number) {
    const gross = items.reduce((s, i) => s + i.amount, 0);
    const gst = Math.round(gross * gstRate) / 100;
    return { grossAmount: gross, gstAmount: gst, netAmount: gross + gst };
  }

  async function openAdd() {
    const poNo = await purchaseCRUD.getNextPONo();
    setForm({ ...emptyForm(), purchaseOrderNo: poNo });
    setFormItems([]);
    setSelectedPartyId(null);
    setNewItem({ description: '', qty: '1', unit: 'EACH', rate: '' });
    setModalMode('add');
  }

  function openEdit(p: PurchaseRecord) {
    setSelected(p);
    setForm({ ...p });
    setFormItems(p.items.map(i => ({ ...i })));
    const match = (supplierParties || []).find(sp => sp.name.toLowerCase() === p.supplierName?.toLowerCase());
    setSelectedPartyId(match?.id ?? null);
    setNewItem({ description: '', qty: '1', unit: 'EACH', rate: '' });
    setModalMode('edit');
  }

  async function saveForm() {
    setIsSaving(true);
    const totals = computeTotals(formItems, form.gstRate);
    const record = { ...form, ...totals, items: formItems };
    if (modalMode === 'add') {
      const id = await purchaseCRUD.create(record) as number;
      await autoIncrementStock(formItems);
      await postPurchaseToGL({ ...record, id });
      if (selectedPartyId) {
        await partyCRUD.updateBalance(selectedPartyId, -totals.netAmount);
      }
    } else if (selected?.id) {
      // Determine old/new party IDs for balance cascade
      const oldPartyId = (supplierParties || []).find(
        p => p.name.toLowerCase() === (selected.supplierName || '').toLowerCase(),
      )?.id;
      const newPartyId = selectedPartyId ?? undefined;
      await editPurchaseWithCascade(selected.id, record, oldPartyId, newPartyId);
    }
    setIsSaving(false);
    setModalMode(null);
    loadPurchases();
  }

  async function confirmDelete() {
    if (deleteId == null) return;
    const purchase = (purchases || []).find(p => p.id === deleteId);
    const partyId = purchase
      ? (supplierParties || []).find(
          p => p.name.toLowerCase() === (purchase.supplierName || '').toLowerCase(),
        )?.id
      : undefined;
    await deletePurchaseWithCascade(deleteId, partyId);
    setDeleteId(null);
    loadPurchases();
  }

  if (purchases === null) return <div className="text-slate-400 text-sm p-8 text-center">Loading purchase records…</div>;

  const newItemAmount = newItem.qty && newItem.rate
    ? parseFloat(newItem.qty) * parseFloat(newItem.rate)
    : NaN;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-48">
            <label className="block text-slate-400 text-xs mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input className={inputCls + ' pl-9'} placeholder="PO no. or supplier…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div><label className="block text-slate-400 text-xs mb-1">From</label><input type="date" className={inputCls + ' w-auto'} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} /></div>
          <div><label className="block text-slate-400 text-xs mb-1">To</label><input type="date" className={inputCls + ' w-auto'} value={filterTo} onChange={e => setFilterTo(e.target.value)} /></div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Purchase
        </button>
      </div>

      {filtered.length > 0 && (
        <div className="flex gap-6 bg-slate-700/50 rounded-lg px-4 py-2 text-sm">
          <span className="text-slate-400">{filtered.length} records</span>
          <span className="text-slate-300">Net: <span className="text-orange-400 font-mono font-semibold">Nu. {fmtNum(totalNet)}</span></span>
          <span className="text-slate-300">GST: <span className="text-yellow-400 font-mono">Nu. {fmtNum(totalGst)}</span></span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">PO No.</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Supplier</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium">Items</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Gross</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">GST</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Net</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-500">No purchase records found.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="border-t border-slate-700 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-blue-400 font-mono font-medium">{p.purchaseOrderNo}</td>
                <td className="px-4 py-3 text-slate-300">{fmtDate(p.timestamp)}</td>
                <td className="px-4 py-3 text-white">{p.supplierName}</td>
                <td className="px-4 py-3 text-center"><span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">{p.items.length}</span></td>
                <td className="px-4 py-3 text-right text-slate-300 font-mono">{fmtNum(p.grossAmount)}</td>
                <td className="px-4 py-3 text-right text-yellow-400 font-mono">{fmtNum(p.gstAmount)}</td>
                <td className="px-4 py-3 text-right text-orange-400 font-mono font-semibold">{fmtNum(p.netAmount)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => { setSelected(p); setModalMode('view'); }} title="View" className="text-slate-400 hover:text-blue-400 transition-colors"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(p)} title="Edit" className="text-slate-400 hover:text-orange-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteId(p.id!)} title="Delete" className="text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {modalMode === 'view' && selected && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setModalMode(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Purchase Order — {selected.purchaseOrderNo}</h3>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div><span className="text-slate-400">Supplier:</span> <span className="text-white">{selected.supplierName}</span></div>
              <div><span className="text-slate-400">Date:</span> <span className="text-white">{fmtDate(selected.timestamp)}</span></div>
              {selected.supplierPhone && <div><span className="text-slate-400">Phone:</span> <span className="text-white">{selected.supplierPhone}</span></div>}
              {selected.supplierTPN && <div><span className="text-slate-400">TPN:</span> <span className="text-white">{selected.supplierTPN}</span></div>}
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-700"><tr>
                  <th className="text-left px-3 py-2 text-slate-400">Description</th>
                  <th className="text-right px-3 py-2 text-slate-400">Qty</th>
                  <th className="text-left px-3 py-2 text-slate-400">Unit</th>
                  <th className="text-right px-3 py-2 text-slate-400">Rate</th>
                  <th className="text-right px-3 py-2 text-slate-400">Amount</th>
                </tr></thead>
                <tbody>{selected.items.map((item, i) => (
                  <tr key={i} className="border-t border-slate-700">
                    <td className="px-3 py-2 text-white">{item.description}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{item.qty}</td>
                    <td className="px-3 py-2 text-slate-400">{item.unit}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{fmtNum(item.rate)}</td>
                    <td className="px-3 py-2 text-right text-orange-400">{fmtNum(item.amount)}</td>
                  </tr>
                ))}</tbody>
                <tfoot className="border-t-2 border-slate-600">
                  <tr><td colSpan={4} className="px-3 py-2 text-right text-slate-400">Gross</td><td className="px-3 py-2 text-right text-slate-300">{fmtNum(selected.grossAmount)}</td></tr>
                  <tr><td colSpan={4} className="px-3 py-2 text-right text-slate-400">GST {selected.gstRate}%</td><td className="px-3 py-2 text-right text-yellow-400">{fmtNum(selected.gstAmount)}</td></tr>
                  <tr><td colSpan={4} className="px-3 py-2 text-right text-white font-bold">Net Amount</td><td className="px-3 py-2 text-right text-orange-400 font-bold">{fmtNum(selected.netAmount)}</td></tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setModalMode(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
              <h3 className="text-white font-semibold">{modalMode === 'add' ? 'New Purchase Order' : `Edit ${form.purchaseOrderNo}`}</h3>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              {/* Party selector */}
              <div>
                <label className="block text-slate-400 text-xs mb-1">Select Supplier from Party Directory</label>
                <div className="relative">
                  <select
                    className={inputCls + ' appearance-none pr-8'}
                    value={selectedPartyId ?? ''}
                    onChange={e => {
                      const id = parseInt(e.target.value);
                      if (!isNaN(id)) selectSupplier(id);
                      else setSelectedPartyId(null);
                    }}
                  >
                    <option value="">— Select a registered supplier —</option>
                    {(supplierParties || []).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.phone ? ` · ${p.phone}` : ''}{p.tpn ? ` · TPN: ${p.tpn}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {(supplierParties || []).length === 0 && (
                  <p className="text-slate-500 text-xs mt-1">No suppliers in party directory yet — type name manually below.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">PO Number</label>
                  <input className={inputCls} value={form.purchaseOrderNo} onChange={e => setForm(p => ({ ...p, purchaseOrderNo: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Date</label>
                  <input type="date" className={inputCls} value={new Date(form.timestamp).toISOString().split('T')[0]} onChange={e => setForm(p => ({ ...p, timestamp: new Date(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Supplier Name *</label>
                  <input className={inputCls} placeholder="Auto-filled from selection above" value={form.supplierName} onChange={e => setForm(p => ({ ...p, supplierName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Phone</label>
                  <input className={inputCls} value={form.supplierPhone || ''} onChange={e => setForm(p => ({ ...p, supplierPhone: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Address</label>
                  <input className={inputCls} value={form.supplierAddress || ''} onChange={e => setForm(p => ({ ...p, supplierAddress: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">TPN</label>
                  <input className={inputCls} value={form.supplierTPN || ''} onChange={e => setForm(p => ({ ...p, supplierTPN: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">GST Rate %</label>
                  <input type="number" className={inputCls} value={form.gstRate} onChange={e => setForm(p => ({ ...p, gstRate: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>

              {/* ── Item Entry ── */}
              <div>
                <label className="block text-slate-400 text-xs mb-2 font-medium">Add Items</label>
                <div className="grid grid-cols-12 gap-2 items-end">

                  {/* Description with inventory autocomplete */}
                  <div className="col-span-12 sm:col-span-5">
                    <label className="block text-slate-400 text-xs mb-1 flex items-center gap-1">
                      <Search className="w-3 h-3" /> Description
                    </label>
                    <input
                      ref={descRef}
                      className={inputCls}
                      placeholder="Type to search inventory…"
                      value={newItem.description}
                      onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addFormItem()}
                      onBlur={() => setTimeout(() => setInvSuggestions([]), 180)}
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-slate-400 text-xs mb-1">Qty</label>
                    <input
                      type="number" min="1" step="1"
                      className={inputCls}
                      placeholder="1"
                      value={newItem.qty}
                      onChange={e => setNewItem(p => ({ ...p, qty: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addFormItem()}
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-slate-400 text-xs mb-1">Unit</label>
                    <div className="relative">
                      <select
                        className={inputCls + ' appearance-none pr-8'}
                        value={newItem.unit}
                        onChange={e => setNewItem(p => ({ ...p, unit: e.target.value as UnitType }))}
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-slate-400 text-xs mb-1">Rate (Nu.)</label>
                    <input
                      type="number" min="0" step="0.01"
                      className={inputCls}
                      placeholder="0.00"
                      value={newItem.rate}
                      onChange={e => setNewItem(p => ({ ...p, rate: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addFormItem()}
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-1 flex flex-col justify-end">
                    <button
                      onClick={addFormItem}
                      className="w-full flex items-center justify-center gap-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="sm:hidden">Add Item</span>
                    </button>
                  </div>
                </div>

                {!isNaN(newItemAmount) && newItemAmount > 0 && (
                  <p className="text-slate-400 text-xs mt-1.5 text-right">
                    Line total: <span className="text-orange-400 font-mono font-medium">Nu. {fmtNum(newItemAmount)}</span>
                  </p>
                )}
              </div>

              {/* Items list */}
              {formItems.length > 0 ? (
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-700/80">
                      <tr>
                        <th className="text-left px-3 py-2 text-slate-400 font-medium">Description</th>
                        <th className="text-right px-3 py-2 text-slate-400 font-medium w-16">Qty</th>
                        <th className="text-left px-3 py-2 text-slate-400 font-medium w-16">Unit</th>
                        <th className="text-right px-3 py-2 text-slate-400 font-medium w-24">Rate</th>
                        <th className="text-right px-3 py-2 text-slate-400 font-medium w-24">Amount</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {formItems.map((item, i) => (
                        <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/30">
                          <td className="px-3 py-2 text-white">{item.description}</td>
                          <td className="px-3 py-2 text-right text-slate-300">{item.qty}</td>
                          <td className="px-3 py-2 text-slate-400">{item.unit}</td>
                          <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmtNum(item.rate)}</td>
                          <td className="px-3 py-2 text-right text-orange-400 font-mono">{fmtNum(item.amount)}</td>
                          <td className="px-2 py-2">
                            <button onClick={() => setFormItems(p => p.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-600 bg-slate-700/30">
                      {(() => {
                        const t = computeTotals(formItems, form.gstRate);
                        return (
                          <>
                            <tr>
                              <td colSpan={4} className="px-3 py-1.5 text-right text-slate-400 text-xs">Gross Amount</td>
                              <td className="px-3 py-1.5 text-right text-slate-300 font-mono text-xs">Nu. {fmtNum(t.grossAmount)}</td>
                              <td />
                            </tr>
                            <tr>
                              <td colSpan={4} className="px-3 py-1.5 text-right text-slate-400 text-xs">GST {form.gstRate}%</td>
                              <td className="px-3 py-1.5 text-right text-yellow-400 font-mono text-xs">Nu. {fmtNum(t.gstAmount)}</td>
                              <td />
                            </tr>
                            <tr>
                              <td colSpan={4} className="px-3 py-2 text-right text-white font-semibold text-sm">Net Total</td>
                              <td className="px-3 py-2 text-right text-orange-400 font-mono font-bold">Nu. {fmtNum(t.netAmount)}</td>
                              <td />
                            </tr>
                          </>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="border border-dashed border-slate-600 rounded-lg py-6 text-center">
                  <p className="text-slate-500 text-sm">No items added yet.</p>
                  <p className="text-slate-600 text-xs mt-0.5">Search inventory above, or type a description and click Add.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-700 shrink-0 flex gap-3">
              <button
                onClick={saveForm}
                disabled={isSaving || !form.supplierName || formItems.length === 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {isSaving ? 'Saving…' : modalMode === 'add' ? 'Save Purchase Order' : 'Save Changes'}
              </button>
              <button onClick={() => setModalMode(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory suggestions dropdown — fixed position to escape modal overflow */}
      {invSuggestions.length > 0 && dropdownPos && (
        <div
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
          className="bg-slate-800 border border-slate-500 rounded-xl shadow-2xl overflow-hidden"
        >
          <div className="px-3 py-1.5 border-b border-slate-700 flex items-center gap-1.5">
            <Search className="w-3 h-3 text-slate-500" />
            <span className="text-slate-500 text-xs">Inventory matches — click to select</span>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {invSuggestions.map(inv => (
              <button
                key={inv.id}
                type="button"
                onMouseDown={() => selectInvSuggestion(inv)}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-700 transition-colors border-b border-slate-700/60 last:border-0 flex items-center justify-between gap-3"
              >
                <span className="text-white text-sm font-medium truncate">{inv.description}</span>
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <span className="text-slate-400">{inv.unit}</span>
                  <span className={`font-semibold px-1.5 py-0.5 rounded ${
                    inv.stockQty === 0
                      ? 'bg-red-500/20 text-red-400'
                      : inv.stockQty <= inv.reorderLevel
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}>
                    {inv.stockQty === 0 ? 'OUT' : `${inv.stockQty} in stock`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold mb-2">Delete Purchase Record?</h3>
            <p className="text-slate-400 text-sm mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={confirmDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">Delete</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
