'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/accounting-db';
import {
  Plus, Trash2, Edit2, X, Search, AlertTriangle,
  ChevronDown, ChevronUp, ChevronsUpDown, Minus, RefreshCw,
} from 'lucide-react';
import type { Product, ProductCategory } from '@/types';

const UNITS = ['EACH', 'PCS', 'KG', 'MTR', 'SET', 'BOX', 'LTR', 'NOS', 'PAIR'] as const;
type UnitDisplay = typeof UNITS[number];

const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Power Tools', 'Agricultural Machinery', 'Hand Tools', 'Safety Equipment',
  'Irrigation & Water', 'Spare Parts', 'Garden & Landscaping', 'Welding Equipment', 'Measuring Tools',
];

function unitToApi(u: UnitDisplay): string {
  switch (u) {
    case 'KG':   return 'kg';
    case 'MTR':  return 'metre';
    case 'SET':  return 'set';
    case 'BOX':  return 'box';
    case 'LTR':  return 'litre';
    case 'PAIR': return 'pair';
    case 'NOS':  return 'nos';
    case 'PCS':  return 'pcs';
    default:     return 'piece';
  }
}

function unitFromApi(u: string): UnitDisplay {
  switch ((u ?? '').toLowerCase()) {
    case 'kg': case 'kilogram': return 'KG';
    case 'metre': case 'meter': return 'MTR';
    case 'set':  return 'SET';
    case 'box':  return 'BOX';
    case 'litre': case 'liter': return 'LTR';
    case 'pair': return 'PAIR';
    case 'nos':  return 'NOS';
    case 'pcs':  return 'PCS';
    default:     return 'EACH';
  }
}

function getReorder(sku: string): number {
  try { return Number(localStorage.getItem(`dtt-inv-reorder-${sku}`)) || 5; } catch { return 5; }
}
function saveReorder(sku: string, level: number): void {
  try { localStorage.setItem(`dtt-inv-reorder-${sku}`, String(level)); } catch {}
}

function fmtNum(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const inputCls = 'w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-400';

type InvProduct = Product & { reorderLevel: number };

type FormState = {
  sku: string; name: string; category: ProductCategory;
  unit: UnitDisplay; price: number; stock: number; reorderLevel: number; notes: string;
};

const emptyForm = (): FormState => ({
  sku: '', name: '', category: 'Spare Parts',
  unit: 'EACH', price: 0, stock: 0, reorderLevel: 5, notes: '',
});

// Background-sync Supabase products → Dexie so POS search stays fresh
async function syncToDexie(products: Product[]): Promise<void> {
  for (const p of products) {
    try {
      // Try to find existing Dexie record by SKU
      const bySku = await db.inventory.where('itemCode').equals(p.sku).first();
      if (bySku?.id) {
        await db.inventory.update(bySku.id, {
          description: p.name, baseRate: p.price,
          stockQty: p.stock, unit: unitFromApi(p.unit), lastUpdated: new Date(),
        });
        continue;
      }
      // Fallback: match by description (items imported before SKUs were tracked)
      const byDesc = await db.inventory
        .filter(i => i.description.toLowerCase().trim() === p.name.toLowerCase().trim())
        .first();
      if (byDesc?.id) {
        await db.inventory.update(byDesc.id, {
          itemCode: p.sku, baseRate: p.price,
          stockQty: p.stock, lastUpdated: new Date(),
        });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.inventory.add({
          itemCode: p.sku, description: p.name, unit: unitFromApi(p.unit),
          baseRate: p.price, stockQty: p.stock, reorderLevel: 5,
          lastUpdated: new Date(), notes: p.category,
        } as any);
      }
    } catch { /* ignore individual errors */ }
  }
}

export function InventoryManager() {
  const [products,    setProducts]    = useState<InvProduct[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [lowStockOnly,setLowStockOnly]= useState(false);
  const [sortDir,     setSortDir]     = useState<'asc' | 'desc' | null>(null);
  const [modalMode,   setModalMode]   = useState<'add' | 'edit' | null>(null);
  const [editTarget,  setEditTarget]  = useState<InvProduct | null>(null);
  const [form,        setForm]        = useState<FormState>(emptyForm());
  const [isSaving,    setIsSaving]    = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [adjusting,   setAdjusting]   = useState<{ id: string; name: string; stock: number; delta: string } | null>(null);
  const [statusMsg,   setStatusMsg]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to load');
      const data: Product[] = await res.json();
      setProducts(data.map(p => ({ ...p, reorderLevel: getReorder(p.sku) })));
      // Keep Dexie in sync for POS search (non-blocking)
      syncToDexie(data).catch(() => {});
    } catch {
      setStatusMsg('Failed to load products. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !search || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
    const matchLow = !lowStockOnly || p.stock <= p.reorderLevel;
    return matchSearch && matchLow;
  }).sort((a, b) => {
    if (!sortDir) return 0;
    return sortDir === 'asc'
      ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      : b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
  });

  const lowStockCount = products.filter(p => p.stock <= p.reorderLevel).length;
  const totalValue    = filtered.reduce((s, p) => s + p.stock * p.price, 0);

  function stockStatus(p: InvProduct) {
    if (p.stock === 0)               return { label: 'Out of Stock', cls: 'text-red-400' };
    if (p.stock <= p.reorderLevel)   return { label: 'Low Stock',    cls: 'text-yellow-400' };
    return                                  { label: 'In Stock',     cls: 'text-green-400' };
  }

  function openEdit(p: InvProduct) {
    setEditTarget(p);
    setForm({
      sku: p.sku || '', name: p.name, category: p.category,
      unit: unitFromApi(p.unit), price: p.price, stock: p.stock,
      reorderLevel: p.reorderLevel, notes: p.description || '',
    });
    setModalMode('edit');
  }

  async function saveForm() {
    setSaveError('');
    setIsSaving(true);
    try {
      const sku = form.sku.trim() || form.name.trim().replace(/\s+/g, '-').toUpperCase().slice(0, 20);
      const payload = {
        name: form.name.trim(), category: form.category,
        price: form.price, stock: form.stock,
        unit: unitToApi(form.unit), sku,
        description: form.notes.trim(), featured: false,
      };
      if (modalMode === 'add') {
        const res = await fetch('/api/products', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      } else if (editTarget) {
        const res = await fetch(`/api/products/${editTarget.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      }
      saveReorder(sku, form.reorderLevel);
      await load();
      setModalMode(null);
    } catch (err) {
      setSaveError((err as Error).message || 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  }

  async function applyAdjust() {
    if (!adjusting) return;
    const delta = parseFloat(adjusting.delta);
    if (isNaN(delta)) return;
    const newStock = Math.max(0, adjusting.stock + delta);
    try {
      await fetch(`/api/products/${adjusting.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock }),
      });
      // Also update Dexie so POS reflects the change
      const p = products.find(x => x.id === adjusting.id);
      if (p?.sku) {
        const inv = await db.inventory.where('itemCode').equals(p.sku).first();
        if (inv?.id) await db.inventory.update(inv.id, { stockQty: newStock, lastUpdated: new Date() });
      }
    } catch {}
    await load();
    setAdjusting(null);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await fetch(`/api/products/${deleteId}`, { method: 'DELETE' });
      const p = products.find(x => x.id === deleteId);
      if (p?.sku) {
        const inv = await db.inventory.where('itemCode').equals(p.sku).first();
        if (inv?.id) await db.inventory.delete(inv.id);
        try { localStorage.removeItem(`dtt-inv-reorder-${p.sku}`); } catch {}
      }
    } catch {}
    await load();
    setDeleteId(null);
  }

  if (loading) return <div className="text-slate-400 text-sm p-8 text-center">Loading inventory…</div>;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-48">
            <label className="block text-slate-400 text-xs mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input className={inputCls + ' pl-9'} placeholder="Description or code…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm pb-2">
            <div
              onClick={() => setLowStockOnly(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative ${lowStockOnly ? 'bg-orange-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${lowStockOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-slate-300">Low stock only</span>
            {lowStockCount > 0 && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{lowStockCount}</span>}
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            title="Reload from Product Dashboard"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => { setForm(emptyForm()); setEditTarget(null); setModalMode('add'); }}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="flex items-center justify-between bg-slate-700 border border-slate-600 text-slate-300 rounded-lg px-4 py-2.5 text-sm">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg('')} className="text-slate-400 hover:text-white ml-4"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="flex gap-6 bg-slate-700/50 rounded-lg px-4 py-2 text-sm flex-wrap">
          <span className="text-slate-400">{filtered.length} items</span>
          <span className="text-slate-300">Stock Value: <span className="text-orange-400 font-mono font-semibold">Nu. {fmtNum(totalValue)}</span></span>
          {lowStockCount > 0 && <span className="text-yellow-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{lowStockCount} low stock</span>}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Code</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">
                <button
                  onClick={() => setSortDir(d => d === null ? 'asc' : d === 'asc' ? 'desc' : null)}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  Description
                  {sortDir === 'asc'  ? <ChevronUp   className="w-3.5 h-3.5 text-orange-400" />
                   : sortDir === 'desc' ? <ChevronDown className="w-3.5 h-3.5 text-orange-400" />
                   : <ChevronsUpDown className="w-3.5 h-3.5" />}
                </button>
              </th>
              <th className="text-left  px-4 py-3 text-slate-400 font-medium">Unit</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Base Rate</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Stock</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Reorder</th>
              <th className="text-left  px-4 py-3 text-slate-400 font-medium">Status</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-500">
                  {lowStockOnly ? 'No low-stock items.' : 'No products found.'}
                </td>
              </tr>
            ) : filtered.map(p => {
              const status = stockStatus(p);
              return (
                <tr
                  key={p.id}
                  className={`border-t border-slate-700 hover:bg-slate-700/30 transition-colors ${p.stock === 0 ? 'bg-red-500/5' : p.stock <= p.reorderLevel ? 'bg-yellow-500/5' : ''}`}
                >
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{p.sku || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3 text-white">{p.name}</td>
                  <td className="px-4 py-3 text-slate-400">{unitFromApi(p.unit)}</td>
                  <td className="px-4 py-3 text-right text-slate-300 font-mono">{fmtNum(p.price)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    <span className={p.stock === 0 ? 'text-red-400' : p.stock <= p.reorderLevel ? 'text-yellow-400' : 'text-white'}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 font-mono">{p.reorderLevel}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${status.cls}`}>
                      {p.stock <= p.reorderLevel && p.stock > 0 && <AlertTriangle className="inline w-3 h-3 mr-1" />}
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setAdjusting({ id: p.id, name: p.name, stock: p.stock, delta: '' })}
                        title="Adjust Stock"
                        className="text-slate-400 hover:text-blue-400 transition-colors text-xs font-medium"
                      >±Qty</button>
                      <button onClick={() => openEdit(p)} title="Edit" className="text-slate-400 hover:text-orange-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(p.id)} title="Delete" className="text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setModalMode(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">{modalMode === 'add' ? 'Add Product' : 'Edit Product'}</h3>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Item Code / SKU (optional)</label>
                  <input className={inputCls} placeholder="e.g. BLD-001" value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Unit</label>
                  <div className="relative">
                    <select className={inputCls + ' appearance-none pr-8 cursor-pointer'} value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value as UnitDisplay }))}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Name / Description *</label>
                <input className={inputCls} placeholder="e.g. HEDGE TRIMMER CORDLESS" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Category *</label>
                <div className="relative">
                  <select className={inputCls + ' appearance-none pr-8 cursor-pointer'} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as ProductCategory }))}>
                    {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Base Rate (Nu.)</label>
                  <input type="number" min="0" step="0.01" className={inputCls} value={form.price} onChange={e => setForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Stock Qty</label>
                  <input type="number" min="0" step="1" className={inputCls} value={form.stock} onChange={e => setForm(p => ({ ...p, stock: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Reorder Level</label>
                  <input type="number" min="0" step="1" className={inputCls} value={form.reorderLevel} onChange={e => setForm(p => ({ ...p, reorderLevel: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Notes</label>
                <textarea className={inputCls} rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            {saveError && (
              <p className="mt-3 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{saveError}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={saveForm}
                disabled={isSaving || !form.name.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {isSaving ? 'Saving…' : 'Save Item'}
              </button>
              <button
                onClick={() => { setModalMode(null); setSaveError(''); }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjusting && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold mb-1">Adjust Stock</h3>
            <p className="text-slate-400 text-sm mb-1 truncate">{adjusting.name}</p>
            <p className="text-slate-400 text-xs mb-4">Current qty: <span className="text-white font-semibold">{adjusting.stock}</span></p>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setAdjusting(a => a ? { ...a, delta: String((parseFloat(a.delta) || 0) - 1) } : null)}
                className="bg-slate-700 hover:bg-slate-600 text-white w-9 h-9 rounded-lg flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number" step="1"
                className={inputCls + ' text-center flex-1'}
                placeholder="Enter +/- quantity"
                value={adjusting.delta}
                onChange={e => setAdjusting(a => a ? { ...a, delta: e.target.value } : null)}
              />
              <button
                onClick={() => setAdjusting(a => a ? { ...a, delta: String((parseFloat(a.delta) || 0) + 1) } : null)}
                className="bg-slate-700 hover:bg-slate-600 text-white w-9 h-9 rounded-lg flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {adjusting.delta && !isNaN(parseFloat(adjusting.delta)) && (
              <p className="text-xs text-slate-400 mb-3 text-center">
                New qty: <span className="text-orange-400 font-semibold">{Math.max(0, adjusting.stock + parseFloat(adjusting.delta))}</span>
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={applyAdjust} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">Apply</button>
              <button onClick={() => setAdjusting(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold mb-2">Delete Product?</h3>
            <p className="text-slate-400 text-sm mb-5">Removes from the store catalog and accounting inventory. Historical sale/purchase records are unaffected.</p>
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
