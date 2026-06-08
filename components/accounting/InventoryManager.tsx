'use client';

import { useState, useEffect, useCallback } from 'react';
import { inventoryCRUD, InventoryItem, UnitType } from '@/lib/accounting-db';
import { Plus, Trash2, Edit2, X, Search, Package, AlertTriangle, ChevronDown, Minus, Download } from 'lucide-react';
import { seedInventoryFromProducts } from '@/lib/seed-inventory';
import type { ProductCategory } from '@/types';

const UNITS: UnitType[] = ['EACH', 'PCS', 'KG', 'MTR', 'SET', 'BOX', 'LTR', 'NOS', 'PAIR'];

const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Power Tools', 'Agricultural Machinery', 'Hand Tools', 'Safety Equipment',
  'Irrigation & Water', 'Spare Parts', 'Garden & Landscaping', 'Welding Equipment', 'Measuring Tools',
];

function unitTypeToStr(u: UnitType): string {
  switch (u) {
    case 'MTR': return 'metre';
    case 'KG': return 'kg';
    case 'LTR': return 'litre';
    case 'SET': return 'set';
    case 'BOX': return 'box';
    case 'PAIR': return 'pair';
    default: return 'piece';
  }
}
const inputCls = 'w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-400';
function fmtNum(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const emptyForm = (): Omit<InventoryItem, 'id'> => ({
  itemCode: '',
  description: '',
  unit: 'EACH',
  baseRate: 0,
  stockQty: 0,
  reorderLevel: 10,
  lastUpdated: new Date(),
  notes: '',
});

type ModalMode = 'add' | 'edit' | null;

export function InventoryManager() {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [adjusting, setAdjusting] = useState<{ id: number; name: string; qty: number; delta: string } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  const [inventory, setInventory] = useState<(InventoryItem & { id: number })[] | null>(null);
  const loadInventory = useCallback(() => inventoryCRUD.getAll().then(setInventory), []);
  useEffect(() => { loadInventory(); }, [loadInventory]);

  const filtered = (inventory || []).filter(item => {
    const matchSearch = !search || item.description.toLowerCase().includes(search.toLowerCase()) || item.itemCode?.toLowerCase().includes(search.toLowerCase());
    const matchLow = !lowStockOnly || item.stockQty <= item.reorderLevel;
    return matchSearch && matchLow;
  });

  const lowStockCount = (inventory || []).filter(i => i.stockQty <= i.reorderLevel).length;
  const totalValue = filtered.reduce((s, i) => s + i.stockQty * i.baseRate, 0);

  function stockStatus(item: InventoryItem): { label: string; cls: string } {
    if (item.stockQty === 0) return { label: 'Out of Stock', cls: 'text-red-400' };
    if (item.stockQty <= item.reorderLevel) return { label: 'Low Stock', cls: 'text-yellow-400' };
    return { label: 'In Stock', cls: 'text-green-400' };
  }

  function openAdd() {
    setForm(emptyForm());
    setSelected(null);
    setModalMode('add');
  }

  function openEdit(item: InventoryItem) {
    setSelected(item);
    setForm({ ...item });
    setModalMode('edit');
  }

  async function saveForm() {
    setSaveError('');
    setIsSaving(true);
    const data = { ...form, lastUpdated: new Date() };
    try {
    if (modalMode === 'add') {
      await inventoryCRUD.create(data);
      try {
        const category = PRODUCT_CATEGORIES.find(c => c === form.notes) ?? 'Spare Parts';
        const sku = form.itemCode || form.description.replace(/\s+/g, '-').toUpperCase().slice(0, 20);
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.description,
            category,
            price: form.baseRate,
            stock: form.stockQty,
            unit: unitTypeToStr(form.unit),
            sku,
            description: form.notes || '',
            featured: false,
            image: null,
          }),
        });
      } catch { /* best-effort */ }
    } else if (selected?.id) {
      await inventoryCRUD.update(selected.id, data);
      if (selected.itemCode) {
        try {
          const res = await fetch('/api/products');
          if (res.ok) {
            const allProducts: Array<{ id: string; sku: string }> = await res.json();
            const match = allProducts.find(p => p.sku === selected.itemCode);
            if (match) {
              await fetch(`/api/products/${match.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: form.description,
                  price: form.baseRate,
                  stock: form.stockQty,
                  unit: unitTypeToStr(form.unit),
                }),
              });
            }
          }
        } catch { /* best-effort */ }
      }
    }
      setModalMode(null);
      await loadInventory();
    } catch (err) {
      setSaveError((err as Error).message || 'Save failed — check Supabase tables are created');
    } finally {
      setIsSaving(false);
    }
  }

  async function applyAdjust() {
    if (!adjusting) return;
    const delta = parseFloat(adjusting.delta);
    if (isNaN(delta)) return;
    await inventoryCRUD.adjustStock(adjusting.id, delta);
    const item = (inventory || []).find(i => i.id === adjusting.id);
    if (item?.itemCode) {
      try {
        const newStock = Math.max(0, adjusting.qty + delta);
        const res = await fetch('/api/products');
        if (res.ok) {
          const allProducts: Array<{ id: string; sku: string }> = await res.json();
          const match = allProducts.find(p => p.sku === item.itemCode);
          if (match) {
            await fetch(`/api/products/${match.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stock: newStock }),
            });
          }
        }
      } catch { /* best-effort */ }
    }
    setAdjusting(null);
    loadInventory();
  }

  async function handleSeedProducts() {
    setIsSeeding(true);
    setSeedMsg('');
    try {
      const { added, skipped } = await seedInventoryFromProducts();
      setSeedMsg(skipped > 0
        ? `Done! Added ${added} products (${skipped} already existed).`
        : `Done! Added ${added} products to inventory.`
      );
      loadInventory();
    } catch {
      setSeedMsg('Import failed. Please try again.');
    } finally {
      setIsSeeding(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const item = (inventory || []).find(i => i.id === deleteId);
    await inventoryCRUD.delete(deleteId);
    if (item?.itemCode) {
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const allProducts: Array<{ id: string; sku: string }> = await res.json();
          const match = allProducts.find(p => p.sku === item.itemCode);
          if (match) await fetch(`/api/products/${match.id}`, { method: 'DELETE' });
        }
      } catch { /* best-effort */ }
    }
    setDeleteId(null);
    loadInventory();
  }

  if (inventory === null) return <div className="text-slate-400 text-sm p-8 text-center">Loading inventory…</div>;

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
              onClick={() => setLowStockOnly(p => !p)}
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
            onClick={handleSeedProducts}
            disabled={isSeeding}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            title="Import all products from the store catalog into inventory"
          >
            <Download className="w-4 h-4" />
            {isSeeding ? 'Importing…' : 'Import Store Products'}
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {seedMsg && (
        <div className="flex items-center justify-between bg-green-900/40 border border-green-700 text-green-300 rounded-lg px-4 py-2.5 text-sm">
          <span>{seedMsg}</span>
          <button onClick={() => setSeedMsg('')} className="text-green-500 hover:text-green-300 ml-4"><X className="w-4 h-4" /></button>
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
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Description</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Unit</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Base Rate</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Stock</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Reorder</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-500">
                {lowStockOnly ? 'No low-stock items.' : 'No inventory items. Add your first product.'}
              </td></tr>
            ) : filtered.map(item => {
              const status = stockStatus(item);
              return (
                <tr key={item.id} className={`border-t border-slate-700 hover:bg-slate-700/30 transition-colors ${item.stockQty === 0 ? 'bg-red-500/5' : item.stockQty <= item.reorderLevel ? 'bg-yellow-500/5' : ''}`}>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{item.itemCode || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3 text-white">{item.description}</td>
                  <td className="px-4 py-3 text-slate-400">{item.unit}</td>
                  <td className="px-4 py-3 text-right text-slate-300 font-mono">{fmtNum(item.baseRate)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    <span className={item.stockQty === 0 ? 'text-red-400' : item.stockQty <= item.reorderLevel ? 'text-yellow-400' : 'text-white'}>{item.stockQty}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 font-mono">{item.reorderLevel}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${status.cls}`}>
                      {item.stockQty <= item.reorderLevel && item.stockQty > 0 && <AlertTriangle className="inline w-3 h-3 mr-1" />}
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setAdjusting({ id: item.id!, name: item.description, qty: item.stockQty, delta: '' })}
                        title="Adjust Stock"
                        className="text-slate-400 hover:text-blue-400 transition-colors text-xs font-medium"
                      >±Qty</button>
                      <button onClick={() => openEdit(item)} title="Edit" className="text-slate-400 hover:text-orange-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(item.id!)} title="Delete" className="text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
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
              <h3 className="text-white font-semibold">{modalMode === 'add' ? 'Add Inventory Item' : 'Edit Item'}</h3>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-400 text-xs mb-1">Item Code (optional)</label><input className={inputCls} placeholder="e.g. BLD-001" value={form.itemCode || ''} onChange={e => setForm(p => ({ ...p, itemCode: e.target.value }))} /></div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Unit</label>
                  <div className="relative">
                    <select className={inputCls + ' appearance-none pr-8 cursor-pointer'} value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value as UnitType }))}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div><label className="block text-slate-400 text-xs mb-1">Description *</label><input className={inputCls} placeholder="e.g. BLADE 12″×3.5×2.5 MM" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-slate-400 text-xs mb-1">Base Rate (Nu.)</label><input type="number" min="0" step="0.01" className={inputCls} value={form.baseRate} onChange={e => setForm(p => ({ ...p, baseRate: parseFloat(e.target.value) || 0 }))} /></div>
                <div><label className="block text-slate-400 text-xs mb-1">Stock Qty</label><input type="number" min="0" step="1" className={inputCls} value={form.stockQty} onChange={e => setForm(p => ({ ...p, stockQty: parseFloat(e.target.value) || 0 }))} /></div>
                <div><label className="block text-slate-400 text-xs mb-1">Reorder Level</label><input type="number" min="0" step="1" className={inputCls} value={form.reorderLevel} onChange={e => setForm(p => ({ ...p, reorderLevel: parseFloat(e.target.value) || 0 }))} /></div>
              </div>
              <div><label className="block text-slate-400 text-xs mb-1">Notes</label><textarea className={inputCls} rows={2} value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            {saveError && (
              <p className="mt-3 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{saveError}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={saveForm} disabled={isSaving || !form.description.trim()} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">{isSaving ? 'Saving…' : 'Save Item'}</button>
              <button onClick={() => { setModalMode(null); setSaveError(''); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancel</button>
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
            <p className="text-slate-400 text-xs mb-4">Current qty: <span className="text-white font-semibold">{adjusting.qty}</span></p>
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setAdjusting(p => p ? { ...p, delta: String((parseFloat(p.delta) || 0) - 1) } : null)} className="bg-slate-700 hover:bg-slate-600 text-white w-9 h-9 rounded-lg flex items-center justify-center"><Minus className="w-4 h-4" /></button>
              <input type="number" step="1" className={inputCls + ' text-center flex-1'} placeholder="Enter +/- quantity" value={adjusting.delta} onChange={e => setAdjusting(p => p ? { ...p, delta: e.target.value } : null)} />
              <button onClick={() => setAdjusting(p => p ? { ...p, delta: String((parseFloat(p.delta) || 0) + 1) } : null)} className="bg-slate-700 hover:bg-slate-600 text-white w-9 h-9 rounded-lg flex items-center justify-center"><Plus className="w-4 h-4" /></button>
            </div>
            {adjusting.delta && !isNaN(parseFloat(adjusting.delta)) && (
              <p className="text-xs text-slate-400 mb-3 text-center">
                New qty: <span className="text-orange-400 font-semibold">{Math.max(0, adjusting.qty + parseFloat(adjusting.delta))}</span>
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
            <h3 className="text-white font-semibold mb-2">Delete Item?</h3>
            <p className="text-slate-400 text-sm mb-5">This removes the item from inventory. Historical records are unaffected.</p>
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
