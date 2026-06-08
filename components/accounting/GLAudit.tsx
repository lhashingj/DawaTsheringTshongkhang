'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  glCRUD,
  partyCRUD,
  GLEntry,
  GLAccountType,
  GLTransactionType,
  PartyRecord,
} from '@/lib/accounting-db';
import { editGLEntryById, deleteGLEntryById } from '@/lib/ledger-mutations';
import {
  Pencil, Trash2, AlertTriangle, X, Save, Search,
  ChevronLeft, ChevronRight, Database, Users, RefreshCw,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

const GL_ACCOUNT_TYPES: GLAccountType[] = [
  'asset', 'liability', 'equity', 'revenue', 'expense',
];
const GL_TX_TYPES: GLTransactionType[] = [
  'sale', 'purchase', 'expense', 'adjustment', 'payment',
];

const inputCls =
  'w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:border-orange-500 placeholder-slate-400';

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

type AuditTab = 'gl' | 'parties';

// ─────────────────────────────────────────────────────────────────────────────
// GL Entry edit form state
// ─────────────────────────────────────────────────────────────────────────────
interface GLForm {
  timestamp: string;
  transactionRef: string;
  transactionType: GLTransactionType;
  account: string;
  accountType: GLAccountType;
  debit: string;
  credit: string;
  description: string;
}

function glToForm(e: GLEntry): GLForm {
  return {
    timestamp: new Date(e.timestamp).toISOString().slice(0, 16),
    transactionRef: e.transactionRef,
    transactionType: e.transactionType,
    account: e.account,
    accountType: e.accountType,
    debit: e.debit.toFixed(2),
    credit: e.credit.toFixed(2),
    description: e.description,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkbox helper
// ─────────────────────────────────────────────────────────────────────────────
function Checkbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={el => { if (el) el.indeterminate = !!indeterminate; }}
      onChange={onChange}
      className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 accent-orange-500 cursor-pointer"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function GLAudit() {
  const [tab, setTab] = useState<AuditTab>('gl');

  // ── GL tab state ────────────────────────────────────────────────────────────
  const [glSearch, setGlSearch]           = useState('');
  const [glTxType, setGlTxType]           = useState<GLTransactionType | ''>('');
  const [glFromDate, setGlFromDate]       = useState('');
  const [glToDate, setGlToDate]           = useState('');
  const [glPage, setGlPage]               = useState(0);
  const [editingGL, setEditingGL]         = useState<GLEntry | null>(null);
  const [glForm, setGlForm]               = useState<GLForm | null>(null);
  const [deletingGLId, setDeletingGLId]   = useState<number | null>(null);
  const [glSaving, setGlSaving]           = useState(false);

  // GL bulk selection
  const [glSelectedIds, setGlSelectedIds]     = useState<Set<number>>(new Set());
  const [glBulkConfirm, setGlBulkConfirm]     = useState(false);
  const [glBulkDeleting, setGlBulkDeleting]   = useState(false);

  // ── Party tab state ─────────────────────────────────────────────────────────
  const [partySearch, setPartySearch]               = useState('');
  const [editingParty, setEditingParty]             = useState<PartyRecord | null>(null);
  const [partyBalanceInput, setPartyBalanceInput]   = useState('');
  const [partyNotes, setPartyNotes]                 = useState('');
  const [partySaving, setPartySaving]               = useState(false);
  const [deletingPartyId, setDeletingPartyId]       = useState<number | null>(null);

  // Party bulk selection
  const [partySelectedIds, setPartySelectedIds]     = useState<Set<number>>(new Set());
  const [partyBulkConfirm, setPartyBulkConfirm]     = useState(false);
  const [partyBulkDeleting, setPartyBulkDeleting]   = useState(false);

  // ── Live data ───────────────────────────────────────────────────────────────
  const [glEntries, setGlEntries] = useState<(GLEntry & { id: number })[] | undefined>(undefined);
  const [parties, setParties]     = useState<(PartyRecord & { id: number })[] | undefined>(undefined);

  const loadGL      = useCallback(() => glCRUD.getAll().then(d => setGlEntries(d.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))), []);
  const loadParties = useCallback(() => partyCRUD.getAll().then(setParties), []);

  useEffect(() => { loadGL(); loadParties(); }, [loadGL, loadParties]);

  // ── GL filtered + paginated ─────────────────────────────────────────────────
  const filteredGL = useMemo(() => {
    if (!glEntries) return [];
    return glEntries.filter(e => {
      const matchSearch =
        !glSearch ||
        e.account.toLowerCase().includes(glSearch.toLowerCase()) ||
        e.transactionRef.toLowerCase().includes(glSearch.toLowerCase()) ||
        e.description.toLowerCase().includes(glSearch.toLowerCase());
      const matchType   = !glTxType || e.transactionType === glTxType;
      const matchFrom   = !glFromDate || new Date(e.timestamp) >= new Date(glFromDate);
      const matchTo     = !glToDate || new Date(e.timestamp) <= new Date(glToDate + 'T23:59:59');
      return matchSearch && matchType && matchFrom && matchTo;
    });
  }, [glEntries, glSearch, glTxType, glFromDate, glToDate]);

  const totalPages = Math.ceil(filteredGL.length / PAGE_SIZE);
  const pageGL     = filteredGL.slice(glPage * PAGE_SIZE, (glPage + 1) * PAGE_SIZE);
  const totalDr    = filteredGL.reduce((s, e) => s + e.debit, 0);
  const totalCr    = filteredGL.reduce((s, e) => s + e.credit, 0);
  const glDiff     = Math.abs(totalDr - totalCr);
  const glBalanced = glDiff < 0.02;

  // ── GL bulk selection helpers ───────────────────────────────────────────────
  const pageGLIds       = pageGL.map(e => e.id!).filter(Boolean);
  const allPageSelected = pageGLIds.length > 0 && pageGLIds.every(id => glSelectedIds.has(id));
  const somePageSelected = !allPageSelected && pageGLIds.some(id => glSelectedIds.has(id));

  function toggleAllPageGL() {
    setGlSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageGLIds.forEach(id => next.delete(id));
      } else {
        pageGLIds.forEach(id => next.add(id));
      }
      return next;
    });
  }

  function toggleGLRow(id: number) {
    setGlSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Party bulk selection helpers ────────────────────────────────────────────
  const filteredParties = useMemo(() => {
    if (!parties) return [];
    return parties.filter(
      p =>
        !partySearch ||
        p.name.toLowerCase().includes(partySearch.toLowerCase()) ||
        (p.phone || '').includes(partySearch),
    );
  }, [parties, partySearch]);

  const filteredPartyIds      = filteredParties.map(p => p.id!).filter(Boolean);
  const allPartiesSelected    = filteredPartyIds.length > 0 && filteredPartyIds.every(id => partySelectedIds.has(id));
  const somePartiesSelected   = !allPartiesSelected && filteredPartyIds.some(id => partySelectedIds.has(id));

  function toggleAllParties() {
    setPartySelectedIds(prev => {
      const next = new Set(prev);
      if (allPartiesSelected) {
        filteredPartyIds.forEach(id => next.delete(id));
      } else {
        filteredPartyIds.forEach(id => next.add(id));
      }
      return next;
    });
  }

  function togglePartyRow(id: number) {
    setPartySelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── GL edit/delete handlers ─────────────────────────────────────────────────
  function openGLEdit(entry: GLEntry) {
    setEditingGL(entry);
    setGlForm(glToForm(entry));
  }

  async function saveGLEdit() {
    if (!editingGL?.id || !glForm) return;
    setGlSaving(true);
    await editGLEntryById(editingGL.id, {
      timestamp:       new Date(glForm.timestamp),
      transactionRef:  glForm.transactionRef,
      transactionType: glForm.transactionType,
      account:         glForm.account,
      accountType:     glForm.accountType,
      debit:           parseFloat(glForm.debit)  || 0,
      credit:          parseFloat(glForm.credit) || 0,
      description:     glForm.description,
    });
    setGlSaving(false);
    setEditingGL(null);
    setGlForm(null);
    await loadGL();
  }

  async function confirmDeleteGL() {
    if (deletingGLId == null) return;
    await deleteGLEntryById(deletingGLId);
    setDeletingGLId(null);
    await loadGL();
  }

  async function executeBulkDeleteGL() {
    setGlBulkDeleting(true);
    await glCRUD.bulkDelete([...glSelectedIds]);
    setGlSelectedIds(new Set());
    setGlBulkConfirm(false);
    setGlBulkDeleting(false);
    await loadGL();
  }

  // ── Party handlers ──────────────────────────────────────────────────────────
  function openPartyEdit(p: PartyRecord) {
    setEditingParty(p);
    setPartyBalanceInput(p.outstandingBalance.toFixed(2));
    setPartyNotes('');
  }

  async function savePartyBalance() {
    if (!editingParty?.id) return;
    setPartySaving(true);
    const newBalance = parseFloat(partyBalanceInput);
    if (!isNaN(newBalance)) {
      await partyCRUD.update(editingParty.id, { outstandingBalance: newBalance, updatedAt: new Date() });
    }
    setPartySaving(false);
    setEditingParty(null);
    await loadParties();
  }

  async function confirmDeleteParty() {
    if (deletingPartyId == null) return;
    await partyCRUD.delete(deletingPartyId);
    setDeletingPartyId(null);
    await loadParties();
  }

  async function executeBulkDeleteParties() {
    setPartyBulkDeleting(true);
    await Promise.all([...partySelectedIds].map(id => partyCRUD.delete(id)));
    setPartySelectedIds(new Set());
    setPartyBulkConfirm(false);
    setPartyBulkDeleting(false);
    await loadParties();
  }

  if (!glEntries || !parties) {
    return (
      <div className="text-slate-400 text-sm p-8 text-center animate-pulse">
        Loading audit data…
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Sub-tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 w-fit">
        {([
          { id: 'gl'      as AuditTab, label: 'General Ledger',   icon: Database },
          { id: 'parties' as AuditTab, label: 'Party Balances',   icon: Users    },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-orange-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          GENERAL LEDGER TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'gl' && (
        <div className="space-y-4">

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex-1 min-w-44">
              <label className="block text-slate-400 text-xs mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  className={inputCls + ' pl-9'}
                  placeholder="Account, ref, or description…"
                  value={glSearch}
                  onChange={e => { setGlSearch(e.target.value); setGlPage(0); }}
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Tx Type</label>
              <select
                className={inputCls + ' w-auto'}
                value={glTxType}
                onChange={e => { setGlTxType(e.target.value as GLTransactionType | ''); setGlPage(0); }}
              >
                <option value="">All types</option>
                {GL_TX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">From</label>
              <input type="date" className={inputCls + ' w-auto'} value={glFromDate} onChange={e => { setGlFromDate(e.target.value); setGlPage(0); }} />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">To</label>
              <input type="date" className={inputCls + ' w-auto'} value={glToDate} onChange={e => { setGlToDate(e.target.value); setGlPage(0); }} />
            </div>
            <button
              onClick={() => { setGlSearch(''); setGlTxType(''); setGlFromDate(''); setGlToDate(''); setGlPage(0); }}
              className="flex items-center gap-1.5 border border-slate-600 hover:border-orange-500 text-slate-400 hover:text-orange-400 px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Clear
            </button>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap gap-4 bg-slate-700/50 rounded-lg px-4 py-2.5 text-sm">
            <span className="text-slate-400">{filteredGL.length} entries</span>
            <span className="text-slate-300">Total Dr: <span className="text-blue-400 font-mono font-semibold">Nu. {fmt(totalDr)}</span></span>
            <span className="text-slate-300">Total Cr: <span className="text-green-400 font-mono font-semibold">Nu. {fmt(totalCr)}</span></span>
            <span className={`font-semibold text-xs px-2 py-0.5 rounded ${glBalanced ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {glBalanced ? '✓ Balanced' : `⚠ Diff: Nu. ${fmt(glDiff)}`}
            </span>
          </div>

          {/* Bulk action bar */}
          {glSelectedIds.size > 0 && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5">
              <span className="text-red-300 text-sm font-medium">
                {glSelectedIds.size} entr{glSelectedIds.size === 1 ? 'y' : 'ies'} selected
              </span>
              <button
                onClick={() => setGlBulkConfirm(true)}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected ({glSelectedIds.size})
              </button>
              <button
                onClick={() => setGlSelectedIds(new Set())}
                className="text-slate-400 hover:text-white text-sm transition-colors"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* GL Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <Checkbox
                      checked={allPageSelected}
                      indeterminate={somePageSelected}
                      onChange={toggleAllPageGL}
                    />
                  </th>
                  <th className="text-left px-3 py-3 text-slate-400 font-medium">Date/Time</th>
                  <th className="text-left px-3 py-3 text-slate-400 font-medium">Ref</th>
                  <th className="text-left px-3 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-3 py-3 text-slate-400 font-medium">Account</th>
                  <th className="text-left px-3 py-3 text-slate-400 font-medium">Acct Type</th>
                  <th className="text-right px-3 py-3 text-slate-400 font-medium">Debit</th>
                  <th className="text-right px-3 py-3 text-slate-400 font-medium">Credit</th>
                  <th className="text-left px-3 py-3 text-slate-400 font-medium max-w-40">Description</th>
                  <th className="text-center px-3 py-3 text-slate-400 font-medium w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageGL.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-slate-500">
                      No GL entries match your filter.
                    </td>
                  </tr>
                ) : pageGL.map(entry => (
                  <tr
                    key={entry.id}
                    className={`border-t border-slate-700/60 transition-colors ${
                      glSelectedIds.has(entry.id!)
                        ? 'bg-red-500/8'
                        : 'hover:bg-slate-700/30'
                    }`}
                  >
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={glSelectedIds.has(entry.id!)}
                        onChange={() => toggleGLRow(entry.id!)}
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtDateTime(entry.timestamp)}</td>
                    <td className="px-3 py-2 text-orange-400 font-mono whitespace-nowrap">{entry.transactionRef}</td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-600/60 text-slate-300">{entry.transactionType}</span>
                    </td>
                    <td className="px-3 py-2 text-white font-medium">{entry.account}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        entry.accountType === 'asset'     ? 'bg-blue-500/20 text-blue-400'   :
                        entry.accountType === 'liability' ? 'bg-red-500/20 text-red-400'     :
                        entry.accountType === 'revenue'   ? 'bg-green-500/20 text-green-400' :
                        entry.accountType === 'expense'   ? 'bg-orange-500/20 text-orange-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>{entry.accountType}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-blue-300">
                      {entry.debit > 0 ? fmt(entry.debit) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-green-300">
                      {entry.credit > 0 ? fmt(entry.credit) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-400 max-w-40 truncate">{entry.description}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openGLEdit(entry)}
                          title="Edit entry"
                          className="text-slate-500 hover:text-orange-400 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingGLId(entry.id!)}
                          title="Delete entry"
                          className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                Page {glPage + 1} of {totalPages} &nbsp;·&nbsp; {filteredGL.length} entries
              </span>
              <div className="flex gap-1">
                <button
                  disabled={glPage === 0}
                  onClick={() => setGlPage(p => p - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 transition-colors text-xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  disabled={glPage >= totalPages - 1}
                  onClick={() => setGlPage(p => p + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 transition-colors text-xs"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PARTY BALANCES TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'parties' && (
        <div className="space-y-4">

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              className={inputCls + ' pl-9'}
              placeholder="Name or phone…"
              value={partySearch}
              onChange={e => { setPartySearch(e.target.value); }}
            />
          </div>

          {/* Bulk action bar */}
          {partySelectedIds.size > 0 && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5">
              <span className="text-red-300 text-sm font-medium">
                {partySelectedIds.size} part{partySelectedIds.size === 1 ? 'y' : 'ies'} selected
              </span>
              <button
                onClick={() => setPartyBulkConfirm(true)}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected ({partySelectedIds.size})
              </button>
              <button
                onClick={() => setPartySelectedIds(new Set())}
                className="text-slate-400 hover:text-white text-sm transition-colors"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* Party Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <Checkbox
                      checked={allPartiesSelected}
                      indeterminate={somePartiesSelected}
                      onChange={toggleAllParties}
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Phone</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">TPN</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Outstanding Balance</th>
                  <th className="text-center px-4 py-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredParties.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500">No parties found.</td>
                  </tr>
                ) : filteredParties.map(p => (
                  <tr
                    key={p.id}
                    className={`border-t border-slate-700 transition-colors ${
                      partySelectedIds.has(p.id!)
                        ? 'bg-red-500/8'
                        : 'hover:bg-slate-700/30'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={partySelectedIds.has(p.id!)}
                        onChange={() => togglePartyRow(p.id!)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        p.partyType === 'customer' ? 'bg-orange-500/20 text-orange-400' :
                        p.partyType === 'supplier' ? 'bg-blue-500/20 text-blue-400'    :
                        'bg-purple-500/20 text-purple-400'
                      }`}>{p.partyType}</span>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-slate-400">{p.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{p.tpn || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono font-semibold ${
                        p.outstandingBalance > 0 ? 'text-orange-400' :
                        p.outstandingBalance < 0 ? 'text-red-400' :
                        'text-slate-500'
                      }`}>
                        {p.outstandingBalance !== 0 ? `Nu. ${fmt(Math.abs(p.outstandingBalance))}` : '—'}
                      </span>
                      {p.outstandingBalance !== 0 && (
                        <span className={`ml-2 text-[10px] font-medium ${p.outstandingBalance > 0 ? 'text-orange-500' : 'text-red-500'}`}>
                          {p.outstandingBalance > 0 ? '(they owe you)' : '(you owe them)'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openPartyEdit(p)}
                          title="Override balance"
                          className="text-slate-500 hover:text-orange-400 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingPartyId(p.id!)}
                          title="Delete party"
                          className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════════════════ */}

      {/* GL Edit Modal */}
      {editingGL && glForm && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setEditingGL(null)}
        >
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Edit GL Entry #{editingGL.id}</h3>
              <button onClick={() => setEditingGL(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-slate-400 text-xs mb-1">Timestamp</label>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={glForm.timestamp}
                  onChange={e => setGlForm(f => f ? { ...f, timestamp: e.target.value } : f)}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Transaction Ref</label>
                <input
                  className={inputCls}
                  value={glForm.transactionRef}
                  onChange={e => setGlForm(f => f ? { ...f, transactionRef: e.target.value } : f)}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Transaction Type</label>
                <select
                  className={inputCls}
                  value={glForm.transactionType}
                  onChange={e => setGlForm(f => f ? { ...f, transactionType: e.target.value as GLTransactionType } : f)}
                >
                  {GL_TX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Account Name</label>
                <input
                  className={inputCls}
                  value={glForm.account}
                  onChange={e => setGlForm(f => f ? { ...f, account: e.target.value } : f)}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Account Type</label>
                <select
                  className={inputCls}
                  value={glForm.accountType}
                  onChange={e => setGlForm(f => f ? { ...f, accountType: e.target.value as GLAccountType } : f)}
                >
                  {GL_ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Debit (Nu.)</label>
                <input
                  type="number" min="0" step="0.01"
                  className={inputCls}
                  value={glForm.debit}
                  onChange={e => setGlForm(f => f ? { ...f, debit: e.target.value } : f)}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Credit (Nu.)</label>
                <input
                  type="number" min="0" step="0.01"
                  className={inputCls}
                  value={glForm.credit}
                  onChange={e => setGlForm(f => f ? { ...f, credit: e.target.value } : f)}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-slate-400 text-xs mb-1">Description</label>
                <input
                  className={inputCls}
                  value={glForm.description}
                  onChange={e => setGlForm(f => f ? { ...f, description: e.target.value } : f)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={saveGLEdit}
                disabled={glSaving}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {glSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditingGL(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GL Single Delete Confirm */}
      {deletingGLId != null && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-red-500/30 rounded-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Delete GL Entry?</h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  This will remove a single journal line. The Trial Balance may become
                  unbalanced if the corresponding entry is not also removed.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmDeleteGL}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeletingGLId(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GL Bulk Delete Confirm */}
      {glBulkConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-red-500/40 rounded-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">
                  Delete {glSelectedIds.size} GL {glSelectedIds.size === 1 ? 'Entry' : 'Entries'}?
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  This is permanent and cannot be undone.
                </p>
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-lg px-3 py-2.5 text-xs text-slate-300 space-y-1">
              <p>· All {glSelectedIds.size} selected journal lines will be permanently removed.</p>
              <p>· Trial Balance, P&amp;L, and Balance Sheet will recalculate automatically.</p>
              <p>· Inventory stock and party balances are <span className="text-amber-400 font-medium">not</span> reversed by this action — use the Sales/Purchase Ledger delete for full cascade.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={executeBulkDeleteGL}
                disabled={glBulkDeleting}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {glBulkDeleting ? 'Deleting…' : `Delete ${glSelectedIds.size} Entries`}
              </button>
              <button
                onClick={() => setGlBulkConfirm(false)}
                disabled={glBulkDeleting}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Party Balance Override Modal */}
      {editingParty && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setEditingParty(null)}
        >
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Override Balance — {editingParty.name}</h3>
              <button onClick={() => setEditingParty(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-700/50 rounded-lg px-4 py-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Party Type</span>
                <span className="text-white capitalize">{editingParty.partyType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Balance</span>
                <span className={`font-mono font-semibold ${editingParty.outstandingBalance > 0 ? 'text-orange-400' : editingParty.outstandingBalance < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  Nu. {fmt(editingParty.outstandingBalance)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs mb-1">
                New Balance (Nu.) &nbsp;
                <span className="text-slate-500">· Positive = they owe you &nbsp;· Negative = you owe them</span>
              </label>
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={partyBalanceInput}
                onChange={e => setPartyBalanceInput(e.target.value)}
              />
            </div>

            {partyBalanceInput !== '' && !isNaN(parseFloat(partyBalanceInput)) && (
              <div className="text-xs text-slate-400 bg-slate-700/40 rounded-lg px-3 py-2">
                Delta: <span className="font-mono font-semibold text-white">
                  {(parseFloat(partyBalanceInput) - editingParty.outstandingBalance) >= 0 ? '+' : ''}
                  Nu. {fmt(parseFloat(partyBalanceInput) - editingParty.outstandingBalance)}
                </span>
              </div>
            )}

            <div>
              <label className="block text-slate-400 text-xs mb-1">Reason / Notes (optional)</label>
              <input
                className={inputCls}
                placeholder="e.g. Manual correction — test data removal"
                value={partyNotes}
                onChange={e => setPartyNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={savePartyBalance}
                disabled={partySaving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {partySaving ? 'Saving…' : 'Set Balance'}
              </button>
              <button
                onClick={() => { setPartyBalanceInput('0'); setPartyNotes('Zero balance correction'); }}
                className="px-3 py-2.5 border border-slate-600 hover:border-red-500 text-slate-400 hover:text-red-400 rounded-lg text-sm transition-colors"
                title="Zero out this balance"
              >
                Zero
              </button>
              <button
                onClick={() => setEditingParty(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Party Single Delete Confirm */}
      {deletingPartyId != null && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-white font-semibold">Delete Party?</h3>
            <p className="text-slate-400 text-sm">
              This removes the party record only. Historical transactions referencing this party
              will not be affected, but party balance tracking will stop.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDeleteParty}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeletingPartyId(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Party Bulk Delete Confirm */}
      {partyBulkConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-red-500/40 rounded-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">
                  Delete {partySelectedIds.size} {partySelectedIds.size === 1 ? 'Party' : 'Parties'}?
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  This is permanent and cannot be undone.
                </p>
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-lg px-3 py-2.5 text-xs text-slate-300 space-y-1">
              <p>· {partySelectedIds.size} party record{partySelectedIds.size !== 1 ? 's' : ''} will be permanently removed.</p>
              <p>· Historical transactions linked to these parties are not affected.</p>
              <p>· Outstanding balance tracking will stop for deleted parties.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={executeBulkDeleteParties}
                disabled={partyBulkDeleting}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {partyBulkDeleting ? 'Deleting…' : `Delete ${partySelectedIds.size} ${partySelectedIds.size === 1 ? 'Party' : 'Parties'}`}
              </button>
              <button
                onClick={() => setPartyBulkConfirm(false)}
                disabled={partyBulkDeleting}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
