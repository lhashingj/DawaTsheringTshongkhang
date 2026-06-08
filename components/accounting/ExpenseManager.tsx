'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  expenseCRUD, postExpenseToGL,
  ExpenseRecord, ExpenseCategory,
} from '@/lib/accounting-db';
import { deleteExpenseWithCascade, editExpenseWithCascade } from '@/lib/ledger-mutations';
import { Plus, Trash2, Edit2, X, Search } from 'lucide-react';

const CATEGORIES: ExpenseCategory[] = [
  'Rent', 'Utilities', 'Salaries', 'Transport', 'Fuel',
  'Maintenance', 'Stationery', 'Communication', 'Other',
];

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Rent: 'bg-purple-500/20 text-purple-400',
  Utilities: 'bg-blue-500/20 text-blue-400',
  Salaries: 'bg-green-500/20 text-green-400',
  Transport: 'bg-yellow-500/20 text-yellow-400',
  Fuel: 'bg-orange-500/20 text-orange-400',
  Maintenance: 'bg-red-500/20 text-red-400',
  Stationery: 'bg-cyan-500/20 text-cyan-400',
  Communication: 'bg-indigo-500/20 text-indigo-400',
  Other: 'bg-slate-500/20 text-slate-400',
};

const inputCls = 'w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-400';

function fmt(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtNum(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const emptyForm = (): Omit<ExpenseRecord, 'id'> => ({
  date: new Date(),
  category: 'Other',
  description: '',
  amount: 0,
  inputTaxRate: 0,
  inputTaxAmount: 0,
  reference: '',
  notes: '',
});

type ModalMode = 'add' | 'edit' | null;

export function ExpenseManager() {
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<ExpenseRecord | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | ''>('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [expenses, setExpenses] = useState<(ExpenseRecord & { id: number })[] | null>(null);
  const loadExpenses = useCallback(() => expenseCRUD.getAll().then(setExpenses), []);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const filtered = (expenses || []).filter(e => {
    const matchSearch = !search || e.description.toLowerCase().includes(search.toLowerCase()) || e.reference?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCategory || e.category === filterCategory;
    const matchFrom = !filterFrom || new Date(e.date) >= new Date(filterFrom);
    const matchTo = !filterTo || new Date(e.date) <= new Date(filterTo + 'T23:59:59');
    return matchSearch && matchCat && matchFrom && matchTo;
  });

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);

  const byCategory = filtered.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  function openAdd() {
    setForm(emptyForm());
    setSelected(null);
    setModalMode('add');
  }

  function openEdit(e: ExpenseRecord) {
    setSelected(e);
    setForm({ ...e });
    setModalMode('edit');
  }

  async function saveForm() {
    if (!form.description.trim() || form.amount <= 0) return;
    setSaveError('');
    setIsSaving(true);
    try {
      if (modalMode === 'add') {
        const id = await expenseCRUD.create({ ...form, date: new Date(form.date) }) as number;
        await postExpenseToGL({ ...form, date: new Date(form.date), id });
      } else if (selected?.id) {
        await editExpenseWithCascade(selected.id, { ...form, date: new Date(form.date) });
      }
      setModalMode(null);
      await loadExpenses();
    } catch (err) {
      setSaveError((err as Error).message || 'Save failed — check Supabase tables are created');
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (deleteId == null) return;
    try {
      await deleteExpenseWithCascade(deleteId);
      setDeleteId(null);
      await loadExpenses();
    } catch (err) {
      alert((err as Error).message || 'Delete failed');
      setDeleteId(null);
    }
  }

  if (expenses === null) return <div className="text-slate-400 text-sm p-8 text-center">Loading expenses…</div>;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-44">
            <label className="block text-slate-400 text-xs mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input className={inputCls + ' pl-9'} placeholder="Description…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">Category</label>
            <select className={inputCls + ' w-auto'} value={filterCategory} onChange={e => setFilterCategory(e.target.value as ExpenseCategory | '')}>
              <option value="">All</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="block text-slate-400 text-xs mb-1">From</label><input type="date" className={inputCls + ' w-auto'} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} /></div>
          <div><label className="block text-slate-400 text-xs mb-1">To</label><input type="date" className={inputCls + ' w-auto'} value={filterTo} onChange={e => setFilterTo(e.target.value)} /></div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Log Expense
        </button>
      </div>

      {/* Summary bar */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-4 bg-slate-700/50 rounded-lg px-4 py-2.5 text-sm">
          <span className="text-slate-400">{filtered.length} records</span>
          <span className="text-slate-300">Total: <span className="text-orange-400 font-mono font-semibold">Nu. {fmtNum(totalFiltered)}</span></span>
          {Object.entries(byCategory).sort(([, a], [, b]) => b - a).slice(0, 3).map(([cat, amt]) => (
            <span key={cat} className={`text-xs px-2 py-0.5 rounded font-medium ${CATEGORY_COLORS[cat as ExpenseCategory] || 'bg-slate-600 text-slate-300'}`}>
              {cat}: Nu. {Math.round(amt).toLocaleString('en-IN')}
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Category</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Description</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Ref.</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Input Tax</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Amount (Nu.)</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">No expenses logged. Click &ldquo;Log Expense&rdquo; to add one.</td></tr>
            ) : filtered.map(e => (
              <tr key={e.id} className="border-t border-slate-700 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-slate-300 font-mono text-xs">{fmt(e.date)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${CATEGORY_COLORS[e.category] || 'bg-slate-600 text-slate-300'}`}>{e.category}</span>
                </td>
                <td className="px-4 py-3 text-white">{e.description}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{e.reference || '—'}</td>
                <td className="px-4 py-3 text-right text-teal-400 font-mono text-xs">
                  {(e.inputTaxAmount ?? 0) > 0 ? `Nu. ${fmtNum(e.inputTaxAmount!)}` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-orange-400 font-mono font-semibold">{fmtNum(e.amount)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => openEdit(e)} className="text-slate-400 hover:text-orange-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteId(e.id!)} className="text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setModalMode(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">{modalMode === 'add' ? 'Log Expense' : 'Edit Expense'}</h3>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Date *</label>
                  <input type="date" className={inputCls} value={new Date(form.date).toISOString().split('T')[0]} onChange={e => setForm(p => ({ ...p, date: new Date(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Category *</label>
                  <select className={inputCls} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as ExpenseCategory }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Description *</label>
                <input className={inputCls} placeholder="e.g. Shop electricity bill — May 2026" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Total Amount Paid (Nu.) *</label>
                  <input
                    type="number" min="0" step="0.01" className={inputCls} placeholder="0.00"
                    value={form.amount || ''}
                    onChange={e => {
                      const amt = parseFloat(e.target.value) || 0;
                      const rate = form.inputTaxRate ?? 0;
                      const inputTax = rate > 0 ? parseFloat((amt * rate / (100 + rate)).toFixed(2)) : 0;
                      setForm(p => ({ ...p, amount: amt, inputTaxAmount: inputTax }));
                    }}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Reference (optional)</label>
                  <input className={inputCls} placeholder="Receipt / voucher no." value={form.reference || ''} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} />
                </div>
              </div>

              {/* Deductible Input Tax */}
              <div className="border border-slate-600 rounded-lg p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={(form.inputTaxRate ?? 0) > 0}
                    onChange={e => {
                      const rate = e.target.checked ? 5 : 0;
                      const inputTax = rate > 0 ? parseFloat((form.amount * rate / (100 + rate)).toFixed(2)) : 0;
                      setForm(p => ({ ...p, inputTaxRate: rate, inputTaxAmount: inputTax }));
                    }}
                    className="w-4 h-4 accent-teal-500 rounded"
                  />
                  <span className="text-sm font-medium text-slate-300">Claim GST Input Tax Credit</span>
                  <span className="text-xs text-slate-500">(expense includes GST paid to supplier)</span>
                </label>
                {(form.inputTaxRate ?? 0) > 0 && (
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1">GST Rate (%)</label>
                      <input
                        type="number" min="0" max="100" step="0.01" className={inputCls}
                        value={form.inputTaxRate ?? 5}
                        onChange={e => {
                          const rate = parseFloat(e.target.value) || 0;
                          const inputTax = rate > 0 ? parseFloat((form.amount * rate / (100 + rate)).toFixed(2)) : 0;
                          setForm(p => ({ ...p, inputTaxRate: rate, inputTaxAmount: inputTax }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1">Input Tax Credit (Nu.)</label>
                      <input
                        type="number" min="0" step="0.01" className={inputCls}
                        value={form.inputTaxAmount ?? 0}
                        onChange={e => setForm(p => ({ ...p, inputTaxAmount: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1">Net Expense (Nu.)</label>
                      <input
                        readOnly
                        className={inputCls + ' opacity-60 cursor-default'}
                        value={fmtNum(form.amount - (form.inputTaxAmount ?? 0))}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Notes</label>
                <textarea className={inputCls} rows={2} value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            {saveError && (
              <p className="mt-3 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{saveError}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={saveForm}
                disabled={isSaving || !form.description.trim() || form.amount <= 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {isSaving ? 'Saving…' : modalMode === 'add' ? 'Save Expense' : 'Update'}
              </button>
              <button onClick={() => { setModalMode(null); setSaveError(''); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold mb-2">Delete Expense?</h3>
            <p className="text-slate-400 text-sm mb-5">This removes the record. The GL entry will remain for audit purposes.</p>
            <div className="flex gap-3">
              <button onClick={confirmDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium">Delete</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
