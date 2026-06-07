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
  error?: string;
}

async function migrateTable<T extends { id?: number }>(
  tableName: string,
  getDexieRows: () => Promise<T[]>,
  getSupabaseCount: () => Promise<number>,
  insertOne: (row: Omit<T, 'id'>) => Promise<unknown>,
): Promise<MigrationStatus> {
  try {
    const dexieRows = await getDexieRows();
    if (dexieRows.length === 0) return { table: tableName, dexieCount: 0, migrated: 0, skipped: true };

    const supabaseCount = await getSupabaseCount();
    if (supabaseCount > 0) return { table: tableName, dexieCount: dexieRows.length, migrated: 0, skipped: true };

    let migrated = 0;
    for (const row of dexieRows) {
      try {
        const { id: _id, ...data } = row as T & { id?: number };
        await insertOne(data as Omit<T, 'id'>);
        migrated++;
      } catch {
        // skip duplicates or constraint errors
      }
    }
    return { table: tableName, dexieCount: dexieRows.length, migrated, skipped: false };
  } catch (err) {
    return { table: tableName, dexieCount: 0, migrated: 0, skipped: false, error: String(err) };
  }
}

export async function runFullMigration(
  onProgress?: (status: MigrationStatus) => void,
): Promise<MigrationStatus[]> {
  const results: MigrationStatus[] = [];

  const run = async (status: MigrationStatus) => {
    results.push(status);
    onProgress?.(status);
    return status;
  };

  // Purchases
  await run(await migrateTable(
    'purchases',
    () => db.purchases.toArray(),
    async () => { try { const r = await fetch('/api/accounting/purchases'); const d = await r.json(); return d.length; } catch { return 0; } },
    (row) => purchaseCRUD.create(row),
  ));

  // Parties
  await run(await migrateTable(
    'parties',
    () => db.parties.toArray(),
    async () => { try { const r = await fetch('/api/accounting/parties'); const d = await r.json(); return d.length; } catch { return 0; } },
    (row) => partyCRUD.create(row),
  ));

  // Inventory
  await run(await migrateTable(
    'inventory',
    () => db.inventory.toArray(),
    async () => { try { const r = await fetch('/api/accounting/inventory'); const d = await r.json(); return d.length; } catch { return 0; } },
    (row) => inventoryCRUD.create(row),
  ));

  // Expenses
  await run(await migrateTable(
    'expenses',
    () => db.expenses.toArray(),
    async () => { try { const r = await fetch('/api/accounting/expenses'); const d = await r.json(); return d.length; } catch { return 0; } },
    (row) => expenseCRUD.create(row),
  ));

  // Payments
  await run(await migrateTable(
    'payments',
    () => db.payments.toArray(),
    async () => { try { const r = await fetch('/api/accounting/payments'); const d = await r.json(); return d.length; } catch { return 0; } },
    (row) => paymentCRUD.create(row),
  ));

  // General Ledger (potentially large — migrate in chunks of 50)
  try {
    const dexieGL = await db.generalLedger.toArray();
    if (dexieGL.length > 0) {
      const supabaseGL = await fetch('/api/accounting/general-ledger').then(r => r.json()).catch(() => []);
      if (supabaseGL.length === 0) {
        let migrated = 0;
        const CHUNK = 50;
        for (let i = 0; i < dexieGL.length; i += CHUNK) {
          const chunk = dexieGL.slice(i, i + CHUNK).map(({ id: _id, ...rest }) => rest);
          try {
            await glCRUD.bulkAdd(chunk);
            migrated += chunk.length;
          } catch { /* skip bad chunks */ }
        }
        await run({ table: 'general_ledger', dexieCount: dexieGL.length, migrated, skipped: false });
      } else {
        await run({ table: 'general_ledger', dexieCount: dexieGL.length, migrated: 0, skipped: true });
      }
    } else {
      await run({ table: 'general_ledger', dexieCount: 0, migrated: 0, skipped: true });
    }
  } catch (err) {
    await run({ table: 'general_ledger', dexieCount: 0, migrated: 0, skipped: false, error: String(err) });
  }

  // Cash Book
  await run(await migrateTable(
    'cash_book',
    () => db.cashBook.toArray(),
    async () => { try { const r = await fetch('/api/accounting/cash-book'); const d = await r.json(); return d.length; } catch { return 0; } },
    (row) => cashBookCRUD.create(row),
  ));

  // Credit Notes
  await run(await migrateTable(
    'credit_notes',
    () => db.creditNotes.toArray(),
    async () => { try { const r = await fetch('/api/accounting/credit-notes'); const d = await r.json(); return d.length; } catch { return 0; } },
    (row) => creditNoteCRUD.create(row),
  ));

  // Debit Notes
  await run(await migrateTable(
    'debit_notes',
    () => db.debitNotes.toArray(),
    async () => { try { const r = await fetch('/api/accounting/debit-notes'); const d = await r.json(); return d.length; } catch { return 0; } },
    (row) => debitNoteCRUD.create(row),
  ));

  return results;
}
