'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  salesCRUD,
  partyCRUD,
  inventoryCRUD,
  SaleRecord,
  SaleItem,
  InventoryItem,
  PartyRecord,
  UnitType,
  LOW_STOCK_THRESHOLD,
  decrementStockAndPostCOGS,
  postSaleToGL,
  getUnitRates,
} from '@/lib/accounting-db';
import { numberToWords } from '@/lib/number-to-words';
import { InvoicePrint } from './InvoicePrint';
import {
  Plus,
  Trash2,
  Save,
  Search,
  ChevronDown,
  Receipt,
  X,
  User,
  Building2,
  Settings,
  Check,
} from 'lucide-react';

const UNITS: UnitType[] = ['EACH', 'PCS', 'KG', 'MTR', 'SET', 'BOX', 'LTR', 'NOS', 'PAIR'];
const GST_RATE = 5;
// Quick-pick tags saved to the invoice Notes field; the accounting dashboard
// groups sales by this value. Free text is still allowed alongside these.
// The list is user-editable and persisted in localStorage.
const PAYMENT_TAGS_KEY = 'dtt-payment-tags';
const DEFAULT_PAYMENT_TAGS = ['CASH', 'OD ACCOUNT', 'LHASHING ACCOUNT', 'ZAMIN ACCOUNT'];

function loadPaymentTags(): string[] {
  try {
    const raw = localStorage.getItem(PAYMENT_TAGS_KEY);
    if (!raw) return DEFAULT_PAYMENT_TAGS;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter(t => typeof t === 'string');
    return DEFAULT_PAYMENT_TAGS;
  } catch { return DEFAULT_PAYMENT_TAGS; }
}
function savePaymentTags(tags: string[]) {
  try { localStorage.setItem(PAYMENT_TAGS_KEY, JSON.stringify(tags)); } catch { /* ignore */ }
}

function fmtNum(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

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

type CustomerMode = 'cash' | 'party';

export function POSCheckout() {
  const [customerMode, setCustomerMode] = useState<CustomerMode>('cash');
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const [customer, setCustomer] = useState<CustomerForm>(defaultCustomer);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [itemForm, setItemForm] = useState<ItemForm>(defaultItem);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [savedInvoice, setSavedInvoice] = useState<SaleRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [suggestions, setSuggestions] = useState<InventoryItem[]>([]);
  const [applyGST, setApplyGST] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentTags, setPaymentTags] = useState<string[]>(DEFAULT_PAYMENT_TAGS);
  const [manageTags, setManageTags] = useState(false);
  const [newTag, setNewTag] = useState('');

  // Load the saved account list and default the note to the first account
  useEffect(() => {
    const tags = loadPaymentTags();
    setPaymentTags(tags);
    setNotes(tags[0] ?? '');
  }, []);

  function persistTags(next: string[]) {
    setPaymentTags(next);
    savePaymentTags(next);
  }
  function addTag() {
    const t = newTag.trim();
    if (!t) return;
    if (paymentTags.some(x => x.toUpperCase() === t.toUpperCase())) { setNewTag(''); return; }
    persistTags([...paymentTags, t]);
    setNewTag('');
  }
  function renameTag(idx: number, value: string) {
    persistTags(paymentTags.map((t, i) => (i === idx ? value : t)));
  }
  function removeTag(tag: string) {
    persistTags(paymentTags.filter(t => t !== tag));
  }

  const [inventory, setInventory] = useState<(InventoryItem & { id: number })[] | null>(null);
  const [customerParties, setCustomerParties] = useState<(PartyRecord & { id: number })[] | null>(null);

  const loadInventory = useCallback(() => inventoryCRUD.getAll().then(setInventory), []);
  const loadParties   = useCallback(() =>
    partyCRUD.getAll().then(all => setCustomerParties(all.filter(p => p.partyType === 'customer' || p.partyType === 'both'))),
    []);

  useEffect(() => { loadInventory(); }, [loadInventory]);
  useEffect(() => { loadParties(); },   [loadParties]);

  function switchMode(mode: CustomerMode) {
    setCustomerMode(mode);
    setSelectedPartyId(null);
    setCustomer(defaultCustomer);
  }

  function selectParty(partyId: number) {
    const party = (customerParties || []).find(p => p.id === partyId);
    if (!party) return;
    setSelectedPartyId(partyId);
    setCustomer({
      name: party.name,
      phone: party.phone || '',
      address: party.address || '',
      tpn: party.tpn || '',
    });
  }

  useEffect(() => {
    salesCRUD.getNextInvoiceNo().then(setInvoiceNo);
  }, []);

  useEffect(() => {
    if (itemForm.description.trim().length < 2 || inventory === null) {
      setSuggestions([]);
      return;
    }
    const q = itemForm.description.toLowerCase();
    setSuggestions(inventory.filter(i => i.description.toLowerCase().includes(q)).slice(0, 6));
  }, [itemForm.description, inventory]);

  const grossAmount = items.reduce((s, i) => s + i.amount, 0);
  const gstAmount = applyGST ? Math.round(grossAmount * GST_RATE) / 100 : 0;
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

  // For multi-unit items (e.g. trimmer liner sold per meter or per roll),
  // switching the unit auto-fills the listed rate for that unit.
  function changeUnit(unit: UnitType) {
    setItemForm(prev => {
      const listed = getUnitRates(prev.description)?.[unit];
      return { ...prev, unit, rate: listed != null ? String(listed) : prev.rate };
    });
  }

  async function saveInvoice() {
    if (items.length === 0) return setError('Add at least one item');
    if (customerMode === 'party' && !selectedPartyId) return setError('Select a registered party or switch to Cash Customer');
    if (!invoiceNo) return;
    setIsSaving(true);
    setError('');
    try {
      const resolvedName = customer.name.trim() || (customerMode === 'cash' ? 'Cash Customer' : '');
      const record: Omit<SaleRecord, 'id'> = {
        invoiceNo,
        timestamp: new Date(),
        customerName: resolvedName,
        customerPhone: customer.phone || undefined,
        customerAddress: customer.address || undefined,
        customerTPN: customer.tpn || undefined,
        items,
        grossAmount,
        gstRate: applyGST ? GST_RATE : 0,
        gstAmount,
        netAmount,
        notes: notes.trim() || undefined,
        syncStatus: 'pending',
      };
      const id = await salesCRUD.create(record) as number;
      const saved = { ...record, id };
      setSavedInvoice(saved);
      setShowModal(true);
      // Reset the form immediately so the next invoice is ready while the print modal is open
      setCustomerMode('cash');
      setSelectedPartyId(null);
      setCustomer(defaultCustomer);
      setItems([]);
      setItemForm(defaultItem);
      setError('');
      setNotes(paymentTags[0] ?? '');
      // Post-save: GL entries + stock + balance — best-effort; invoice already stored
      try {
        await decrementStockAndPostCOGS(items, saved.invoiceNo, new Date(saved.timestamp));
        await postSaleToGL(saved);
        if (customerMode === 'party' && selectedPartyId) {
          await partyCRUD.updateBalance(selectedPartyId, netAmount);
        }
      } catch { /* GL/stock update failed — invoice is saved, user can backup/restore */ }
      const next = await salesCRUD.getNextInvoiceNo();
      setInvoiceNo(next);
      loadInventory();
    } catch (err) {
      setError((err as Error).message || 'Failed to save invoice. Please try again.');
    } finally {
      setIsSaving(false);
    }
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

        {/* Customer type toggle */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => switchMode('cash')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              customerMode === 'cash'
                ? 'bg-orange-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <User className="w-4 h-4" />
            Cash Customer
          </button>
          <button
            type="button"
            onClick={() => switchMode('party')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              customerMode === 'party'
                ? 'bg-orange-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Registered Party
          </button>
        </div>

        {/* Party dropdown (registered mode only) */}
        {customerMode === 'party' && (
          <div className="mb-3">
            <label className="block text-slate-400 text-xs mb-1">Select Party from Directory</label>
            <div className="relative">
              <select
                className={inputCls + ' appearance-none pr-8'}
                value={selectedPartyId ?? ''}
                onChange={e => {
                  const id = parseInt(e.target.value);
                  if (!isNaN(id)) selectParty(id);
                  else { setSelectedPartyId(null); setCustomer(defaultCustomer); }
                }}
              >
                <option value="">— Select a registered customer / company —</option>
                {(customerParties || []).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.phone ? ` · ${p.phone}` : ''}{p.tpn ? ` · TPN: ${p.tpn}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {selectedPartyId && (
              <p className="text-green-400 text-xs mt-1">
                Invoice will be registered in this party&apos;s ledger and their balance updated.
              </p>
            )}
          </div>
        )}

        {/* Customer fields */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2">
            <label className="block text-slate-400 text-xs mb-1">
              {customerMode === 'cash' ? 'Customer Name (optional)' : 'Party Name'}
            </label>
            <input
              className={inputCls}
              placeholder={customerMode === 'cash' ? 'Leave blank for "Cash Customer"' : 'Auto-filled from party'}
              value={customer.name}
              readOnly={customerMode === 'party' && !!selectedPartyId}
              onChange={e => customerMode === 'cash' && setCustomer(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">Phone</label>
            <input
              className={inputCls}
              placeholder="Phone number"
              value={customer.phone}
              readOnly={customerMode === 'party' && !!selectedPartyId}
              onChange={e => customerMode === 'cash' && setCustomer(p => ({ ...p, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">TPN (optional)</label>
            <input
              className={inputCls}
              placeholder="TPN number"
              value={customer.tpn}
              readOnly={customerMode === 'party' && !!selectedPartyId}
              onChange={e => customerMode === 'cash' && setCustomer(p => ({ ...p, tpn: e.target.value }))}
            />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <label className="block text-slate-400 text-xs mb-1">Address (optional)</label>
            <input
              className={inputCls}
              placeholder="Customer address"
              value={customer.address}
              readOnly={customerMode === 'party' && !!selectedPartyId}
              onChange={e => customerMode === 'cash' && setCustomer(p => ({ ...p, address: e.target.value }))}
            />
          </div>

          {/* Payment mode / account — drives the dashboard's sales breakdown */}
          <div className="col-span-2 sm:col-span-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-slate-400 text-xs">Payment Mode / Account</label>
              <button
                type="button"
                onClick={() => setManageTags(v => !v)}
                className="flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
              >
                {manageTags ? <><Check className="w-3.5 h-3.5" /> Done</> : <><Settings className="w-3.5 h-3.5" /> Manage</>}
              </button>
            </div>

            {manageTags ? (
              <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-3 space-y-2">
                {paymentTags.length === 0 && (
                  <p className="text-slate-500 text-xs">No accounts yet — add one below.</p>
                )}
                {paymentTags.map((tag, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      value={tag}
                      onChange={e => renameTag(idx, e.target.value)}
                      className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      title="Delete account"
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-700/60">
                  <input
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="New account name…"
                    className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  These are quick-pick buttons for tagging invoices. Renaming or deleting one here does not change invoices already saved with that tag.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {paymentTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setNotes(tag)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        notes.trim().toUpperCase() === tag.trim().toUpperCase()
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-orange-500 hover:text-orange-400'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <input
                  className={inputCls}
                  placeholder="Or type another account name…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </>
            )}
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
                      {(() => {
                        const rates = getUnitRates(inv.description);
                        const listed = rates
                          ? Object.entries(rates).map(([u, r]) => `Nu.${fmtNum(r as number)}/${u}`).join(' · ')
                          : `Nu.${fmtNum(inv.baseRate)}/${inv.unit}`;
                        return `${listed} · Stock:${inv.stockQty}`;
                      })()}
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
              min="1"
              step="1"
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
                onChange={e => changeUnit(e.target.value as UnitType)}
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
                    <td className="px-3 py-2 text-right text-white">{fmtNum(item.rate)}</td>
                    <td className="px-3 py-2 text-right text-orange-400 font-medium">
                      {fmtNum(item.amount)}
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
              <span className="font-mono">Nu. {fmtNum(grossAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300 text-sm">
              <span className="flex items-center gap-2">
                GST @ {GST_RATE}.00%
                <button
                  type="button"
                  onClick={() => setApplyGST(v => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${applyGST ? 'bg-orange-500' : 'bg-slate-600'}`}
                  title={applyGST ? 'GST applied — click to remove' : 'GST off — click to apply'}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${applyGST ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </span>
              <span className={`font-mono ${applyGST ? '' : 'line-through text-slate-500'}`}>Nu. {fmtNum(applyGST ? gstAmount : Math.round(grossAmount * GST_RATE) / 100)}</span>
            </div>
            <div className="flex justify-between text-white text-base font-bold border-t border-slate-600 pt-2 mt-2">
              <span>Net Amount</span>
              <span className="font-mono text-orange-400">Nu. {fmtNum(netAmount)}</span>
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
