'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  salesCRUD,
  SaleRecord,
  SaleItem,
  InventoryItem,
  UnitType,
  LOW_STOCK_THRESHOLD,
  autoDecrementStock,
  postSaleToGL,
} from '@/lib/accounting-db';
import { numberToWords } from '@/lib/number-to-words';
import { InvoicePrint } from './InvoicePrint';
import {
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Search,
  ChevronDown,
  Receipt,
  X,
} from 'lucide-react';

const UNITS: UnitType[] = ['EACH', 'PCS', 'KG', 'MTR', 'SET', 'BOX', 'LTR', 'NOS'];
const GST_RATE = 5;

interface CustomerForm {
  name: string;
  phone: string;
  address: string;
  tpn: string;
}

interface ItemForm {
  description: string;
  qty: string;
  unit: UnitType;
  rate: string;
}

const defaultCustomer: CustomerForm = { name: '', phone: '', address: '', tpn: '' };
const defaultItem: ItemForm = { description: '', qty: '1', unit: 'EACH', rate: '' };

export function POSCheckout() {
  const [customer, setCustomer] = useState<CustomerForm>(defaultCustomer);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [itemForm, setItemForm] = useState<ItemForm>(defaultItem);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [savedInvoice, setSavedInvoice] = useState<SaleRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [suggestions, setSuggestions] = useState<InventoryItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const inventory = useLiveQuery(() => db.inventory.toArray(), []);

  useEffect(() => {
    salesCRUD.getNextInvoiceNo().then(setInvoiceNo);
  }, []);

  useEffect(() => {
    if (itemForm.description.trim().length < 2 || !inventory) {
      setSuggestions([]);
      return;
    }
    const q = itemForm.description.toLowerCase();
    setSuggestions(inventory.filter(i => i.description.toLowerCase().includes(q)).slice(0, 6));
  }, [itemForm.description, inventory]);

  const grossAmount = items.reduce((s, i) => s + i.amount, 0);
  const gstAmount = Math.round(grossAmount * GST_RATE) / 100;
  const netAmount = grossAmount + gstAmount;

  function addItem() {
    const qty = parseFloat(itemForm.qty);
    const rate = parseFloat(itemForm.rate);
    if (!itemForm.description.trim()) return setError('Description is required');
    if (isNaN(qty) || qty <= 0) return setError('Enter valid quantity');
    if (isNaN(rate) || rate <= 0) return setError('Enter valid rate');
    setError('');
    setItems(prev => [
      ...prev,
      { description: itemForm.description.trim(), qty, unit: itemForm.unit, rate, amount: qty * rate },
    ]);
    setItemForm(prev => ({ ...prev, description: '', qty: '1', rate: '' }));
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function selectSuggestion(inv: InventoryItem) {
    setItemForm(prev => ({
      ...prev,
      description: inv.description,
      unit: inv.unit,
      rate: inv.baseRate.toString(),
    }));
    setSuggestions([]);
  }

  async function saveInvoice() {
    if (items.length === 0) return setError('Add at least one item');
    if (!invoiceNo) return;
    setIsSaving(true);
    setError('');
    try {
      const record: Omit<SaleRecord, 'id'> = {
        invoiceNo,
        timestamp: new Date(),
        customerName: customer.name,
        customerPhone: customer.phone || undefined,
        customerAddress: customer.address || undefined,
        customerTPN: customer.tpn || undefined,
        items,
        grossAmount,
        gstRate: GST_RATE,
        gstAmount,
        netAmount,
        syncStatus: 'pending',
      };
      const id = await salesCRUD.create(record) as number;
      const saved = { ...record, id };
      setSavedInvoice(saved);
      setShowModal(true);
      // Auto-decrement inventory and post double-entry GL
      await autoDecrementStock(items);
      await postSaleToGL(saved);
      const next = await salesCRUD.getNextInvoiceNo();
      setInvoiceNo(next);
    } finally {
      setIsSaving(false);
    }
  }

  function clearForm() {
    setCustomer(defaultCustomer);
    setItems([]);
    setItemForm(defaultItem);
    setError('');
    setSavedInvoice(null);
    setShowModal(false);
    salesCRUD.getNextInvoiceNo().then(setInvoiceNo);
  }

  const inputCls =
    'w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-400';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Invoice Header ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Receipt className="w-5 h-5 text-orange-400" />
            <h2 className="text-white font-semibold text-lg">New Invoice</h2>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs">Invoice No.</p>
            <p className="text-orange-400 font-bold text-xl font-mono">{invoiceNo || '——'}</p>
          </div>
        </div>

        {/* Customer fields */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2">
            <label className="block text-slate-400 text-xs mb-1">Customer Name</label>
            <input
              className={inputCls}
              placeholder="Customer / Party Name"
              value={customer.name}
              onChange={e => setCustomer(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">Phone</label>
            <input
              className={inputCls}
              placeholder="Phone number"
              value={customer.phone}
              onChange={e => setCustomer(p => ({ ...p, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">TPN (optional)</label>
            <input
              className={inputCls}
              placeholder="TPN number"
              value={customer.tpn}
              onChange={e => setCustomer(p => ({ ...p, tpn: e.target.value }))}
            />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <label className="block text-slate-400 text-xs mb-1">Address (optional)</label>
            <input
              className={inputCls}
              placeholder="Customer address"
              value={customer.address}
              onChange={e => setCustomer(p => ({ ...p, address: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* ── Item Entry ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">Add Items</h3>
        <div className="grid grid-cols-12 gap-2 items-end">
          {/* Description with autocomplete */}
          <div className="col-span-12 sm:col-span-5 relative">
            <label className="block text-slate-400 text-xs mb-1">
              <Search className="inline w-3 h-3 mr-1" />
              Description
            </label>
            <input
              className={inputCls}
              placeholder="Item description or search inventory…"
              value={itemForm.description}
              onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addItem()}
            />
            {suggestions.length > 0 && (
              <div className="absolute z-20 w-full bg-slate-700 border border-slate-500 rounded-lg mt-1 shadow-2xl max-h-52 overflow-y-auto">
                {suggestions.map(inv => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => selectSuggestion(inv)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-600 transition-colors text-sm border-b border-slate-600 last:border-0"
                  >
                    <span className="text-white">{inv.description}</span>
                    <span className="text-slate-400 ml-2 text-xs">
                      Nu.{inv.baseRate.toFixed(2)}/{inv.unit} · Stock:{inv.stockQty}
                    </span>
                    {inv.stockQty <= LOW_STOCK_THRESHOLD && inv.stockQty > 0 && (
                      <span className="ml-2 text-[10px] font-bold bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">LOW</span>
                    )}
                    {inv.stockQty === 0 && (
                      <span className="ml-2 text-[10px] font-bold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">OUT</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-4 sm:col-span-2">
            <label className="block text-slate-400 text-xs mb-1">Qty</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={inputCls}
              placeholder="1"
              value={itemForm.qty}
              onChange={e => setItemForm(p => ({ ...p, qty: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addItem()}
            />
          </div>

          <div className="col-span-4 sm:col-span-2">
            <label className="block text-slate-400 text-xs mb-1">Unit</label>
            <div className="relative">
              <select
                className={inputCls + ' appearance-none pr-8 cursor-pointer'}
                value={itemForm.unit}
                onChange={e => setItemForm(p => ({ ...p, unit: e.target.value as UnitType }))}
              >
                {UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="col-span-4 sm:col-span-2">
            <label className="block text-slate-400 text-xs mb-1">Rate (Nu.)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              placeholder="0.00"
              value={itemForm.rate}
              onChange={e => setItemForm(p => ({ ...p, rate: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addItem()}
            />
          </div>

          <div className="col-span-12 sm:col-span-1">
            <button
              onClick={addItem}
              className="w-full flex items-center justify-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

        {/* ── Items Table ── */}
        {items.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-700">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-400 font-medium w-8">SL</th>
                  <th className="text-left px-3 py-2 text-slate-400 font-medium">Description</th>
                  <th className="text-right px-3 py-2 text-slate-400 font-medium">Qty</th>
                  <th className="text-left px-3 py-2 text-slate-400 font-medium">Unit</th>
                  <th className="text-right px-3 py-2 text-slate-400 font-medium">Rate</th>
                  <th className="text-right px-3 py-2 text-slate-400 font-medium">Amount</th>
                  <th className="w-8 px-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/30">
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2 text-white">{item.description}</td>
                    <td className="px-3 py-2 text-right text-white">{item.qty.toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-400">{item.unit}</td>
                    <td className="px-3 py-2 text-right text-white">{item.rate.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-orange-400 font-medium">
                      {item.amount.toFixed(2)}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => removeItem(i)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Totals ── */}
        {items.length > 0 && (
          <div className="mt-4 ml-auto w-full sm:w-80 space-y-1.5">
            <div className="flex justify-between text-slate-300 text-sm">
              <span>Gross Amount</span>
              <span className="font-mono">Nu. {grossAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-300 text-sm">
              <span>GST @ {GST_RATE}.00%</span>
              <span className="font-mono">Nu. {gstAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white text-base font-bold border-t border-slate-600 pt-2 mt-2">
              <span>Net Amount</span>
              <span className="font-mono text-orange-400">Nu. {netAmount.toFixed(2)}</span>
            </div>
            <p className="text-slate-400 text-xs italic">{numberToWords(netAmount)}</p>
          </div>
        )}
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={saveInvoice}
          disabled={isSaving || items.length === 0}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving…' : 'Save & Print Invoice'}
        </button>
        <button
          onClick={clearForm}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          New Invoice
        </button>
        {savedInvoice && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 border border-orange-500 text-orange-400 hover:bg-orange-500/10 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Receipt className="w-4 h-4" />
            View Last Invoice
          </button>
        )}
      </div>

      {/* ── Invoice Modal ── */}
      {showModal && savedInvoice && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="no-print absolute top-3 right-3 z-10 bg-slate-100 hover:bg-slate-200 rounded-full p-1.5 transition-colors"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
            <InvoicePrint invoice={savedInvoice} onClose={() => setShowModal(false)} embedded />
          </div>
        </div>
      )}
    </div>
  );
}
