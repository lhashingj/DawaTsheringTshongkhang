import {
  db,
  SaleRecord,
  PurchaseRecord,
  ExpenseRecord,
  GLEntry,
  InventoryItem,
  inventoryCRUD,
  partyCRUD,
  postSaleToGL,
  postPurchaseToGL,
  postExpenseToGL,
  decrementStockAndPostCOGS,
} from './accounting-db';

// ── Internal helpers ──────────────────────────────────────────────────────────

async function findInvItem(description: string): Promise<InventoryItem | undefined> {
  const q = description.toLowerCase().trim();
  const exact = await db.inventory
    .filter(i => i.description.toLowerCase().trim() === q)
    .first();
  if (exact) return exact;
  return db.inventory
    .filter(
      i =>
        i.description.toLowerCase().includes(q) ||
        q.includes(i.description.toLowerCase().trim()),
    )
    .first();
}

/** Delete every GL row whose transactionRef matches the given reference string. */
async function clearGLFor(transactionRef: string): Promise<void> {
  await db.generalLedger.where('transactionRef').equals(transactionRef).delete();
}

// ── Sales cascade ─────────────────────────────────────────────────────────────

/**
 * Fully removes a sale and reverses all side-effects:
 *  1. Restores inventory stock for every sold item.
 *  2. Reverses the linked party's outstanding balance (optional — pass partyId only
 *     when the original sale was recorded against a registered party).
 *  3. Deletes every GL entry tied to this invoice (revenue + COGS).
 *  4. Deletes the sale record and marks syncStatus = 'pending'.
 */
export async function deleteSaleWithCascade(
  saleId: number,
  partyId?: number,
): Promise<void> {
  const sale = await db.sales.get(saleId);
  if (!sale) return;

  for (const item of sale.items) {
    const inv = await findInvItem(item.description);
    if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, item.qty);
  }

  if (partyId != null) await partyCRUD.updateBalance(partyId, -sale.netAmount);

  await clearGLFor(sale.invoiceNo);
  await db.sales.delete(saleId);
}

/**
 * Edits a sale and recalculates all dependent state:
 *  1. Restores old inventory quantities.
 *  2. Reverses old party balance (if oldPartyId supplied).
 *  3. Deletes old GL entries for the invoice.
 *  4. Persists the updated sale record (syncStatus forced to 'pending').
 *  5. Re-decrements inventory and posts fresh COGS GL entries.
 *  6. Re-posts revenue GL entries.
 *  7. Applies new party balance delta (if newPartyId supplied).
 */
export async function editSaleWithCascade(
  saleId: number,
  newData: Omit<SaleRecord, 'id'>,
  oldPartyId?: number,
  newPartyId?: number,
): Promise<void> {
  const old = await db.sales.get(saleId);
  if (!old) return;

  // Restore old inventory
  for (const item of old.items) {
    const inv = await findInvItem(item.description);
    if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, item.qty);
  }

  if (oldPartyId != null) await partyCRUD.updateBalance(oldPartyId, -old.netAmount);

  await clearGLFor(old.invoiceNo);

  const updated: SaleRecord & { id: number } = {
    ...newData,
    id: saleId,
    syncStatus: 'pending',
  };
  await db.sales.put(updated);

  await decrementStockAndPostCOGS(
    newData.items,
    updated.invoiceNo,
    new Date(updated.timestamp),
  );
  await postSaleToGL(updated);

  if (newPartyId != null) await partyCRUD.updateBalance(newPartyId, updated.netAmount);
}

// ── Purchases cascade ─────────────────────────────────────────────────────────

/**
 * Fully removes a purchase and reverses all side-effects:
 *  1. Subtracts inventory quantities that the purchase originally added.
 *  2. Reverses the linked party's balance (optional).
 *  3. Deletes GL entries for this PO.
 *  4. Deletes the purchase record.
 */
export async function deletePurchaseWithCascade(
  purchaseId: number,
  partyId?: number,
): Promise<void> {
  const purchase = await db.purchases.get(purchaseId);
  if (!purchase) return;

  for (const item of purchase.items) {
    const inv = await findInvItem(item.description);
    if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, -item.qty);
  }

  // Purchasing adds a liability (we owe supplier), so reversal is +netAmount
  if (partyId != null) await partyCRUD.updateBalance(partyId, purchase.netAmount);

  await clearGLFor(purchase.purchaseOrderNo);
  await db.purchases.delete(purchaseId);
}

/**
 * Edits a purchase and recalculates all dependent state:
 *  1. Reverses old inventory quantities.
 *  2. Reverses old party balance.
 *  3. Deletes old GL entries.
 *  4. Persists updated record (syncStatus = 'pending').
 *  5. Adds new inventory quantities.
 *  6. Re-posts purchase GL entries.
 *  7. Applies new party balance.
 */
export async function editPurchaseWithCascade(
  purchaseId: number,
  newData: Omit<PurchaseRecord, 'id'>,
  oldPartyId?: number,
  newPartyId?: number,
): Promise<void> {
  const old = await db.purchases.get(purchaseId);
  if (!old) return;

  for (const item of old.items) {
    const inv = await findInvItem(item.description);
    if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, -item.qty);
  }

  if (oldPartyId != null) await partyCRUD.updateBalance(oldPartyId, old.netAmount);

  await clearGLFor(old.purchaseOrderNo);

  const updated: PurchaseRecord & { id: number } = {
    ...newData,
    id: purchaseId,
    syncStatus: 'pending',
  };
  await db.purchases.put(updated);

  for (const item of newData.items) {
    const inv = await findInvItem(item.description);
    if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, item.qty);
  }

  await postPurchaseToGL(updated);

  if (newPartyId != null) await partyCRUD.updateBalance(newPartyId, -updated.netAmount);
}

// ── Expenses cascade ──────────────────────────────────────────────────────────

/**
 * Deletes an expense and removes its GL entries (expense + GST input credit).
 */
export async function deleteExpenseWithCascade(expenseId: number): Promise<void> {
  await clearGLFor(`EXP-${expenseId}`);
  await db.expenses.delete(expenseId);
}

/**
 * Edits an expense: wipes old GL entries, saves new record, re-posts GL.
 */
export async function editExpenseWithCascade(
  expenseId: number,
  newData: Omit<ExpenseRecord, 'id'>,
): Promise<void> {
  await clearGLFor(`EXP-${expenseId}`);
  const updated: ExpenseRecord & { id: number } = { ...newData, id: expenseId };
  await db.expenses.put(updated);
  await postExpenseToGL(updated);
}

// ── General Ledger direct admin overrides ─────────────────────────────────────

/** Admin override: update any fields on a single GL row. */
export async function editGLEntryById(
  glId: number,
  updates: Partial<Omit<GLEntry, 'id'>>,
): Promise<void> {
  await db.generalLedger.update(glId, updates);
}

/** Admin override: permanently delete a single GL row. */
export async function deleteGLEntryById(glId: number): Promise<void> {
  await db.generalLedger.delete(glId);
}
