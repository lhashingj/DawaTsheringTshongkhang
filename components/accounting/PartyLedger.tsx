'use client';

import { useState, useEffect, useCallback } from 'react';
import { partyCRUD, PartyRecord, PartyType } from '@/lib/accounting-db';
import { Plus, Trash2, Edit2, X, Search, ChevronDown, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const inputCls = 'w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-400';
function fmtNum(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const emptyForm = (): Omit<PartyRecord, 'id'> => ({
  partyType: 'customer',
  name: '',
  phone: '',
  address: '',
  email: '',
  tpn: '',
  licenseNo: '',
  gstNo: '',
  procurementOfficer: '',
  outstandingBalance: 0,
  notes: '',
  createdAt: new Date(),
  updatedAt: new Date(),
});

type ModalMode = 'add' | 'edit' | null;

const BADGE: Record<PartyType, string> = {
  customer: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  supplier: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  both: 'bg-green-500/20 text-green-400 border border-green-500/30',
};

export function PartyLedger() {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<PartyRecord | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<PartyType | 'all'>('all');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [balanceAdj, setBalanceAdj] = useState<{ id: number; amount: string } | null>(null);

  const [parties, setParties] = useState<(PartyRecord & { id: number })[] | null>(null);
  const loadParties = useCallback(() => partyCRUD.getAll().then(setParties), []);
  useEffect(() => { loadParties(); }, [loadParties]);

  const filtered = (parties || []).filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search) || p.tpn?.includes(search);
    const matchType = typeFilter === 'all' || p.partyType === typeFilter;
    return matchSearch && matchType;
  });

  const totalReceivable = filtered.filter(p => p.outstandingBalance > 0).reduce((s, p) => s + p.outstandingBalance, 0);
  const totalPayable = filtered.filter(p => p.outstandingBalance < 0).reduce((s, p) => s + Math.abs(p.outstandingBalance), 0);

  function openAdd() {
    setForm(emptyForm());
    setSelected(null);
    setModalMode('add');
  }

  function openEdit(p: PartyRecord) {
    setSelected(p);
    setForm({ ...p });
    setModalMode('edit');
  }

  async function saveForm() {
    setIsSaving(true);
    if (modalMode === 'add') {
      await partyCRUD.create({
        ...form,
        openingBalance: form.outstandingBalance,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (selected?.id) {
      await partyCRUD.update(selected.id, { ...form, updatedAt: new Date() });
    }
    setIsSaving(false);
    setModalMode(null);
    loadParties();
  }

  async function applyBalanceAdj() {
    if (!balanceAdj) return;
    const delta = parseFloat(balanceAdj.amount);
    if (isNaN(delta)) return;
    await partyCRUD.updateBalance(balanceAdj.id, delta);
    setBalanceAdj(null);
    loadParties();
  }

  async function confirmDelete() {
    if (deleteId) {
      await partyCRUD.delete(deleteId);
      setDeleteId(null);
      loadParties();
    }
  }

  if (parties === null) return <div className="text-slate-400 text-sm p-8 text-center">Loading party records…</div>;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-48">
            <label className="block text-slate-400 text-xs mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input className={inputCls + ' pl-9'} placeholder="Name, phone, TPN…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">Type</label>
            <div className="relative">
              <select className={inputCls + ' appearance-none pr-8 cursor-pointer w-auto'} value={typeFilter} onChange={e => setTypeFilter(e.target.value as PartyType | 'all')}>
                <option value="all">All Types</option>
                <option value="customer">Customer</option>
                <option value="supplier">Supplier</option>
                <option value="both">Both</option>
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Party
        </button>
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="flex gap-6 bg-slate-700/50 rounded-lg px-4 py-2 text-sm flex-wrap">
          <span className="text-slate-400">{filtered.length} parties</span>
          <span className="text-slate-300">Receivable: <span className="text-green-400 font-mono font-semibold">Nu. {fmtNum(totalReceivable)}</span></span>
          <span className="text-slate-300">Payable: <span className="text-red-400 font-mono font-semibold">Nu. {fmtNum(totalPayable)}</span></span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Phone</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">TPN / License</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Balance</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">No parties found. Add customers and suppliers.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="border-t border-slate-700 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE[p.partyType]}`}>
                    {p.partyType.charAt(0).toUpperCase() + p.partyType.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-white font-medium">{p.name}</div>
                  {p.address && <div className="text-slate-500 text-xs">{p.address}</div>}
                </td>
                <td className="px-4 py-3 text-slate-300">{p.phone || <span className="text-slate-600">—</span>}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {p.tpn && <div>TPN: {p.tpn}</div>}
                  {p.licenseNo && <div>Lic: {p.licenseNo}</div>}
                  {!p.tpn && !p.licenseNo && <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className={`font-mono font-semibold ${p.outstandingBalance > 0 ? 'text-green-400' : p.outstandingBalance < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    {p.outstandingBalance > 0 ? '+' : ''}{fmtNum(p.outstandingBalance)}
                  </div>
                  <div className="text-xs text-slate-500">{p.outstandingBalance > 0 ? 'Receivable' : p.outstandingBalance < 0 ? 'Payable' : 'Settled'}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <Link href={`/admin/parties/${p.id}`} title="View Profile" className="text-slate-400 hover:text-blue-400 transition-colors"><ExternalLink className="w-4 h-4" /></Link>
                    <button onClick={() => setBalanceAdj({ id: p.id!, amount: '' })} title="Adjust Balance" className="text-slate-400 hover:text-green-400 transition-colors text-xs font-medium">±Bal</button>
                    <button onClick={() => openEdit(p)} title="Edit" className="text-slate-400 hover:text-orange-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteId(p.id!)} title="Delete" className="text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setModalMode(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">{modalMode === 'add' ? 'Add Party' : `Edit — ${selected?.name}`}</h3>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Party Type</label>
                <div className="relative">
                  <select className={inputCls + ' appearance-none pr-8 cursor-pointer'} value={form.partyType} onChange={e => setForm(p => ({ ...p, partyType: e.target.value as PartyType }))}>
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                    <option value="both">Both (Customer & Supplier)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div><label className="block text-slate-400 text-xs mb-1">Full Name *</label><input className={inputCls} placeholder="Company or person name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-400 text-xs mb-1">Phone</label><input className={inputCls} value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
                <div><label className="block text-slate-400 text-xs mb-1">Email</label><input type="email" className={inputCls} value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              </div>
              <div><label className="block text-slate-400 text-xs mb-1">Address</label><input className={inputCls} value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-slate-400 text-xs mb-1">TPN</label><input className={inputCls} value={form.tpn || ''} onChange={e => setForm(p => ({ ...p, tpn: e.target.value }))} /></div>
                <div><label className="block text-slate-400 text-xs mb-1">License No.</label><input className={inputCls} value={form.licenseNo || ''} onChange={e => setForm(p => ({ ...p, licenseNo: e.target.value }))} /></div>
                <div><label className="block text-slate-400 text-xs mb-1">GST No.</label><input className={inputCls} value={form.gstNo || ''} onChange={e => setForm(p => ({ ...p, gstNo: e.target.value }))} /></div>
              </div>
              <div><label className="block text-slate-400 text-xs mb-1">Procurement Officer</label><input className={inputCls} placeholder="Contact person for orders" value={form.procurementOfficer || ''} onChange={e => setForm(p => ({ ...p, procurementOfficer: e.target.value }))} /></div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Opening Balance (+ = they owe us / Dr)</label>
                <input type="number" step="0.01" className={inputCls} value={form.outstandingBalance} onChange={e => setForm(p => ({ ...p, outstandingBalance: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div><label className="block text-slate-400 text-xs mb-1">Notes</label><textarea className={inputCls} rows={2} value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveForm} disabled={isSaving || !form.name.trim()} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">{isSaving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setModalMode(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Adjustment Modal */}
      {balanceAdj && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold mb-2">Adjust Balance</h3>
            <p className="text-slate-400 text-xs mb-4">Enter positive amount to add receivable, negative to add payable.</p>
            <input type="number" step="0.01" className={inputCls + ' mb-4'} placeholder="e.g. 500 or -200" value={balanceAdj.amount} onChange={e => setBalanceAdj(p => p ? { ...p, amount: e.target.value } : null)} />
            <div className="flex gap-3">
              <button onClick={applyBalanceAdj} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">Apply</button>
              <button onClick={() => setBalanceAdj(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold mb-2">Remove Party?</h3>
            <p className="text-slate-400 text-sm mb-5">This will remove the party directory entry. Transaction history is unaffected.</p>
            <div className="flex gap-3">
              <button onClick={confirmDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">Remove</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
