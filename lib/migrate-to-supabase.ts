/**
 * One-time migration from local Dexie IndexedDB → Supabase.
 * Runs on the accounting dashboard first load.
 * Each table is only migrated if Supabase is empty AND Dexie has data.
 */
import {
  db,
  purchaseCRUD,
  partyCRUD,
  inventoryCRUD,
  expenseCRUD,
  paymentCRUD,
  glCRUD,
  cashBookCRUD,
  creditNoteCRUD,
  debitNoteCRUD,
} from './accounting-db';

export interface MigrationStatus {
  table: string;
  dexieCount: number;
  migrated: number;
  skipped: boolean;
  failed: number;
  error?: string;
}

async function migrateTable<T extends { id?: number }>(
  tableName: string,
  getDexieRows: () => Promise<T[]>,
  getSupabaseCount: () => Promise<number>,
  insertOne: (row: Omit<T, 'id'>) => Promise<unknown>,
  force = false,
): Promise<MigrationStatus> {
  try {
    const dexieRows = await getDexieRows();
    if (dexieRows.length === 0) return { table: tableName, dexieCount: 0, migrated: 0, skipped: true, failed: 0 };

    if (!force) {
      const supabaseCount = await getSupabaseCount();
      if (supabaseCount > 0) return { table: tableName, dexieCount: dexieRows.length, migrated: 0, skipped: true, failed: 0 };
    }

    let migrated = 0;
    let failed = 0;
    const firstError: string[] = [];
    for (const row of dexieRows) {
      try {
        const { id: _id, ...data } = row as T & { id?: number };
        await insertOne(data as Omit<T, 'id'>);
        migrated++;
      } catch (err) {
        failed++;
        if (firstError.length === 0) firstError.push(String(err));
      }
    }
    return {
      table: tableName,
      dexieCount: dexieRows.length,
      migrated,
      skipped: false,
      failed,
      error: firstError[0],
    };
  } catch (err) {
    return { table: tableName, dexieCount: 0, migrated: 0, skipped: false, failed: 0, error: String(err) };
  }
}

export async function runFullMigration(
  onProgress?: (status: MigrationStatus) => void,
  force = false,
): Promise<MigrationStatus[]> {
  const results: MigrationStatus[] = [];

  const run = async (status: MigrationStatus) => {
    results.push(status);
    onProgress?.(status);
    return status;
  };

  const count = async (url: string) => {
    try { const r = await fetch(url); const d = await r.json(); return Array.isArray(d) ? d.length : 0; } catch { return 0; }
  };

  await run(await migrateTable('purchases', () => db.purchases.toArray(), () => count('/api/accounting/purchases'), r => purchaseCRUD.create(r), force));
  await run(await migrateTable('parties',   () => db.parties.toArray(),   () => count('/api/accounting/parties'),   r => partyCRUD.create(r),   force));
  await run(await migrateTable('inventory', () => db.inventory.toArray(), () => count('/api/accounting/inventory'), r => inventoryCRUD.create(r), force));
  await run(await migrateTable('expenses',  () => db.expenses.toArray(),  () => count('/api/accounting/expenses'),  r => expenseCRUD.create(r),  force));
  await run(await migrateTable('payments',  () => db.payments.toArray(),  () => count('/api/accounting/payments'),  r => paymentCRUD.create(r),  force));

  // General Ledger — migrate in chunks of 50
  try {
    const dexieGL = await db.generalLedger.toArray();
    if (dexieGL.length === 0) {
      await run({ table: 'general_ledger', dexieCount: 0, migrated: 0, skipped: true, failed: 0 });
    } else {
      const existing = force ? 0 : await count('/api/accounting/general-ledger');
      if (existing > 0) {
        await run({ table: 'general_ledger', dexieCount: dexieGL.length, migrated: 0, skipped: true, failed: 0 });
      } else {
        let migrated = 0; let failed = 0; let firstErr = '';
        const CHUNK = 50;
        for (let i = 0; i < dexieGL.length; i += CHUNK) {
          const chunk = dexieGL.slice(i, i + CHUNK).map(({ id: _id, ...rest }) => rest);
          try { await glCRUD.bulkAdd(chunk); migrated += chunk.length; }
          catch (err) { failed += chunk.length; if (!firstErr) firstErr = String(err); }
        }
        await run({ table: 'general_ledger', dexieCount: dexieGL.length, migrated, skipped: false, failed, error: firstErr || undefined });
      }
    }
  } catch (err) {
    await run({ table: 'general_ledger', dexieCount: 0, migrated: 0, skipped: false, failed: 0, error: String(err) });
  }

  await run(await migrateTable('cash_book',    () => db.cashBook.toArray(),    () => count('/api/accounting/cash-book'),    r => cashBookCRUD.create(r),    force));
  await run(await migrateTable('credit_notes', () => db.creditNotes.toArray(), () => count('/api/accounting/credit-notes'), r => creditNoteCRUD.create(r), force));
  await run(await migrateTable('debit_notes',  () => db.debitNotes.toArray(),  () => count('/api/accounting/debit-notes'),  r => debitNoteCRUD.create(r),  force));

  return results;
}
