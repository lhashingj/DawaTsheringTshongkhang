'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, salesCRUD, SaleRecord, SaleItem, UnitType } from '@/lib/accounting-db';
import { InvoicePrint } from './InvoicePrint';
import { Eye, Trash2, Edit2, X, Plus, ChevronDown, Search } from 'lucide-react';

const UNITS: UnitType[] = ['EACH', 'PCS', 'KG', 'MTR', 'SET', 'BOX', 'LTR', 'NOS'];

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const inputCls = 'w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-400';

type ModalMode = 'view' | 'edit' | null;

export function SalesLedger() {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<SaleRecord | null>(null);
  const [search, setSearch] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [editItems, setEditItems] = useState<SaleItem[]>([]);
  const [editCustomer, setEditCustomer] = useState({ name: '', phone: '', address: '', tpn: '' });
  const [editNotes, setEditNotes] = useState('');
  const [newItem, setNewItem] = useState({ description: '', qty: '1', unit: 'EACH' as UnitType, rate: '' });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const sales = useLiveQuery(() => db.sales.orderBy('timestamp').reverse().toArray(), []);

  const filtered = (sales || []).filter(s => {
    const matchSearch =
      !search ||
      s.invoiceNo.includes(search) ||
      s.customerName?.toLowerCase().includes(search.toLowerCase());
    const matchFrom = !filterFrom || new Date(s.timestamp) >= new Date(filterFrom);
    const matchTo = !filterTo || new Date(s.timestamp) <= new Date(filterTo + 'T23:59:59');
    return matchSearch && matchFrom && matchTo;
  });

  const totalNet = filtered.reduce((s, r) => s + r.netAmount, 0);
  const totalGst = filtered.reduce((s, r) => s + r.gstAmount, 0);

  function openView(sale: SaleRecord) {
    setSelected(sale);
    setModalMode('view');
  }

  function openEdit(sale: SaleRecord) {
    setSelected(sale);
    setEditItems(sale.items.map(i => ({ ...i })));
    setEditCustomer({
      name: sale.customerName || '',
      phone: sale.customerPhone || '',
      address: sale.customerAddress || '',
      tpn: sale.customerTPN || '',
    });
    setEditNotes(sale.notes || '');
    setModalMode('edit');
  }

  function addEditItem() {
    const qty = parseFloat(newItem.qty);
    const rate = parseFloat(newItem.rate);
    if (!newItem.description.trim() || isNaN(qty) || isNaN(rate)) return;
    setEditItems(prev => [...prev, { description: newItem.description, qty, unit: newItem.unit, rate, amount: qty * rate }]);
    setNewItem({ description: '', qty: '1', unit: 'EACH', rate: '' });
  }

  async function saveEdit() {
    if (!selected?.id) return;
    setIsSaving(true);
    const gross = editItems.reduce((s, i) => s + i.amount, 0);
    const gst = Math.round(gross * selected.gstRate) / 100;
    await salesCRUD.update(selected.id, {
      customerName: editCustomer.name,
      customerPhone: editCustomer.phone || undefined,
      customerAddress: editCustomer.address || undefined,
      customerTPN: editCustomer.tpn || undefined,
      items: editItems,
      grossAmount: gross,
      gstAmount: gst,
      netAmount: gross + gst,
      notes: editNotes || undefined,
    });
    setIsSaving(false);
    setModalMode(null);
  }

  async function confirmDelete() {
    if (deleteId) {
      await salesCRUD.delete(deleteId);
      setDeleteId(null);
    }
  }

  if (!sales) {
    return <div className="text-slate-400 text-sm p-8 text-center">Loading sales records…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-slate-400 text-xs mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input className={inputCls + ' pl-9'} placeholder="Invoice no. or customer…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">From</label>
          <input type="date" className={inputCls + ' w-auto'} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">To</label>
          <input type="date" className={inputCls + ' w-auto'} value={filterTo} onChange={e => setFilterTo(e.target.value)} />
        </div>
      </div>

      {/* Summary bar */}
      {filtered.length > 0 && (
        <div className="flex gap-6 bg-slate-700/50 rounded-lg px-4 py-2 text-sm">
          <span className="text-slate-400">{filtered.length} records</span>
          <span className="text-slate-300">Net: <span className="text-orange-400 font-mono font-semibold">Nu. {totalNet.toFixed(2)}</span></span>
          <span className="text-slate-300">GST: <span className="text-yellow-400 font-mono">Nu. {totalGst.toFixed(2)}</span></span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Invoice No.</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Customer</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium">Items</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Gross</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">GST</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Net</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-500">
                  No sales records found.
                </td>
              </tr>
            ) : (
              filtered.map(sale => (
                <tr key={sale.id} className="border-t border-slate-700 hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 text-orange-400 font-mono font-medium">{sale.invoiceNo}</td>
                  <td className="px-4 py-3 text-slate-300">{fmtDate(sale.timestamp)}</td>
                  <td className="px-4 py-3 text-white">{sale.customerName || <span className="text-slate-500 italic">Cash sale</span>}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">{sale.items.length}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300 font-mono">{sale.grossAmount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-yellow-400 font-mono">{sale.gstAmount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-orange-400 font-mono font-semibold">{sale.netAmount.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openView(sale)} title="View Invoice" className="text-slate-400 hover:text-blue-400 transition-colors"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(sale)} title="Edit" className="text-slate-400 hover:text-orange-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(sale.id!)} title="Delete" className="text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* View Invoice Modal */}
      {modalMode === 'view' && selected && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setModalMode(null)}>
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
            <InvoicePrint invoice={selected} onClose={() => setModalMode(null)} embedded />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {modalMode === 'edit' && selected && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setModalMode(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold text-lg">Edit Invoice {selected.invoiceNo}</h3>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-400 text-xs mb-1">Customer Name</label><input className={inputCls} value={editCustomer.name} onChange={e => setEditCustomer(p => ({ ...p, name: e.target.value }))} /></div>
                <div><label className="block text-slate-400 text-xs mb-1">Phone</label><input className={inputCls} value={editCustomer.phone} onChange={e => setEditCustomer(p => ({ ...p, phone: e.target.value }))} /></div>
                <div><label className="block text-slate-400 text-xs mb-1">Address</label><input className={inputCls} value={editCustomer.address} onChange={e => setEditCustomer(p => ({ ...p, address: e.target.value }))} /></div>
                <div><label className="block text-slate-400 text-xs mb-1">TPN</label><input className={inputCls} value={editCustomer.tpn} onChange={e => setEditCustomer(p => ({ ...p, tpn: e.target.value }))} /></div>
              </div>

              <div className="border border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700"><tr>
                    <th className="text-left px-3 py-2 text-slate-400">Description</th>
                    <th className="text-right px-3 py-2 text-slate-400 w-16">Qty</th>
                    <th className="text-left px-3 py-2 text-slate-400 w-16">Unit</th>
                    <th className="text-right px-3 py-2 text-slate-400 w-20">Rate</th>
                    <th className="text-right px-3 py-2 text-slate-400 w-20">Amt</th>
                    <th className="w-8" />
                  </tr></thead>
                  <tbody>
                    {editItems.map((item, i) => (
                      <tr key={i} className="border-t border-slate-700">
                        <td className="px-3 py-2 text-white">{item.description}</td>
                        <td className="px-3 py-2 text-right text-slate-300">{item.qty}</td>
                        <td className="px-3 py-2 text-slate-400">{item.unit}</td>
                        <td className="px-3 py-2 text-right text-slate-300">{item.rate.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-orange-400">{item.amount.toFixed(2)}</td>
                        <td className="px-2 py-2"><button onClick={() => setEditItems(p => p.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button></td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-600 bg-slate-700/30">
                      <td className="px-2 py-1"><input className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-orange-500" placeholder="Description" value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} /></td>
                      <td className="px-2 py-1"><input type="number" className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-orange-500" value={newItem.qty} onChange={e => setNewItem(p => ({ ...p, qty: e.target.value }))} /></td>
                      <td className="px-2 py-1">
                        <div className="relative">
                          <select className="w-full bg-slate-700 border border-slate-600 text-white rounded px-1 py-1 text-xs focus:outline-none appearance-none cursor-pointer" value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value as UnitType }))}>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-2 py-1"><input type="number" className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-orange-500" placeholder="Rate" value={newItem.rate} onChange={e => setNewItem(p => ({ ...p, rate: e.target.value }))} /></td>
                      <td className="px-2 py-1 text-right text-slate-400 text-xs">{newItem.qty && newItem.rate ? (parseFloat(newItem.qty) * parseFloat(newItem.rate)).toFixed(2) : '—'}</td>
                      <td className="px-2 py-1"><button onClick={addEditItem} className="text-orange-400 hover:text-orange-300"><Plus className="w-4 h-4" /></button></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div><label className="block text-slate-400 text-xs mb-1">Notes</label><textarea className={inputCls} rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)} /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveEdit} disabled={isSaving} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">{isSaving ? 'Saving…' : 'Save Changes'}</button>
              <button onClick={() => setModalMode(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold mb-2">Delete Invoice?</h3>
            <p className="text-slate-400 text-sm mb-5">This action cannot be undone. The invoice will be permanently deleted.</p>
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
