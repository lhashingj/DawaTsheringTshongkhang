/**
 * Cloud sync helpers — backup local Dexie data to Supabase, or restore from Supabase to Dexie.
 * All accounting data is stored locally first; cloud is a manual backup/restore target.
 */
import { db } from './accounting-db';

export interface SyncResult {
  success: boolean;
  counts: Record<string, number>;
  error?: string;
}

// ── Backup: Dexie → Supabase ──────────────────────────────────────────────────

export async function backupToCloud(): Promise<SyncResult> {
  const [
    sales, purchases, parties, inventory, expenses,
    payments, generalLedger, cashBook, creditNotes, debitNotes,
  ] = await Promise.all([
    db.sales.toArray(),
    db.purchases.toArray(),
    db.parties.toArray(),
    db.inventory.toArray(),
    db.expenses.toArray(),
    db.payments.toArray(),
    db.generalLedger.toArray(),
    db.cashBook.toArray(),
    db.creditNotes.toArray(),
    db.debitNotes.toArray(),
  ]);

  const res = await fetch('/api/accounting/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sales, purchases, parties, inventory, expenses, payments, generalLedger, cashBook, creditNotes, debitNotes }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    return { success: false, counts: {}, error: (json.errors || [json.error]).join('; ') || 'Backup failed' };
  }

  return {
    success: true,
    counts: {
      sales: sales.length,
      purchases: purchases.length,
      parties: parties.length,
      inventory: inventory.length,
      expenses: expenses.length,
      payments: payments.length,
      generalLedger: generalLedger.length,
      cashBook: cashBook.length,
      creditNotes: creditNotes.length,
      debitNotes: debitNotes.length,
    },
  };
}

// ── Restore: Supabase → Dexie ─────────────────────────────────────────────────

export async function restoreFromCloud(): Promise<SyncResult> {
  const res = await fetch('/api/accounting/sync');
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    return { success: false, counts: {}, error: json.error || 'Restore failed — could not reach cloud' };
  }

  const data = await res.json();

  // Clear all local tables then bulk insert cloud data
  await Promise.all([
    db.sales.clear(),
    db.purchases.clear(),
    db.parties.clear(),
    db.inventory.clear(),
    db.expenses.clear(),
    db.payments.clear(),
    db.generalLedger.clear(),
    db.cashBook.clear(),
    db.creditNotes.clear(),
    db.debitNotes.clear(),
  ]);

  await Promise.all([
    data.sales?.length        && db.sales.bulkAdd(data.sales),
    data.purchases?.length    && db.purchases.bulkAdd(data.purchases),
    data.parties?.length      && db.parties.bulkAdd(data.parties),
    data.inventory?.length    && db.inventory.bulkAdd(data.inventory),
    data.expenses?.length     && db.expenses.bulkAdd(data.expenses),
    data.payments?.length     && db.payments.bulkAdd(data.payments),
    data.generalLedger?.length && db.generalLedger.bulkAdd(data.generalLedger),
    data.cashBook?.length     && db.cashBook.bulkAdd(data.cashBook),
    data.creditNotes?.length  && db.creditNotes.bulkAdd(data.creditNotes),
    data.debitNotes?.length   && db.debitNotes.bulkAdd(data.debitNotes),
  ]);

  return {
    success: true,
    counts: {
      sales: data.sales?.length ?? 0,
      purchases: data.purchases?.length ?? 0,
      parties: data.parties?.length ?? 0,
      inventory: data.inventory?.length ?? 0,
      expenses: data.expenses?.length ?? 0,
      payments: data.payments?.length ?? 0,
      generalLedger: data.generalLedger?.length ?? 0,
      cashBook: data.cashBook?.length ?? 0,
      creditNotes: data.creditNotes?.length ?? 0,
      debitNotes: data.debitNotes?.length ?? 0,
    },
  };
}
