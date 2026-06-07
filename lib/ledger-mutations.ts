import {
  salesCRUD,
  purchaseCRUD,
  expenseCRUD,
  glCRUD,
  inventoryCRUD,
  partyCRUD,
  postSaleToGL,
  postPurchaseToGL,
  postExpenseToGL,
  decrementStockAndPostCOGS,
  SaleRecord,
  PurchaseRecord,
  ExpenseRecord,
  GLEntry,
  InventoryItem,
} from './accounting-db';

// ── Internal helpers ──────────────────────────────────────────────────────────

async function findInvItem(description: string): Promise<(InventoryItem & { id: number }) | undefined> {
  const all = await inventoryCRUD.getAll();
  const q = description.toLowerCase().trim();
  const exact = all.find(i => i.description.toLowerCase().trim() === q);
  if (exact) return exact;
  return all.find(
    i => i.description.toLowerCase().includes(q) || q.includes(i.description.toLowerCase().trim()),
  );
}

// ── Sales cascade ─────────────────────────────────────────────────────────────

export async function deleteSaleWithCascade(saleId: number, partyId?: number): Promise<void> {
  const sale = await salesCRUD.getById(saleId);
  if (!sale) return;
  for (const item of sale.items) {
    const inv = await findInvItem(item.description);
    if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, item.qty);
  }
  if (partyId != null) await partyCRUD.updateBalance(partyId, -sale.netAmount);
  await glCRUD.deleteByRef(sale.invoiceNo);
  await salesCRUD.delete(saleId);
}

export async function editSaleWithCascade(
  saleId: number,
  newData: Omit<SaleRecord, 'id'>,
  oldPartyId?: number,
  newPartyId?: number,
): Promise<void> {
  const old = await salesCRUD.getById(saleId);
  if (!old) return;
  for (const item of old.items) {
    const inv = await findInvItem(item.description);
    if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, item.qty);
  }
  if (oldPartyId != null) await partyCRUD.updateBalance(oldPartyId, -old.netAmount);
  await glCRUD.deleteByRef(old.invoiceNo);
  const updated: SaleRecord & { id: number } = { ...newData, id: saleId, syncStatus: 'synced' };
  await salesCRUD.update(saleId, updated);
  await decrementStockAndPostCOGS(newData.items, updated.invoiceNo, new Date(updated.timestamp));
  await postSaleToGL(updated);
  if (newPartyId != null) await partyCRUD.updateBalance(newPartyId, updated.netAmount);
}

// ── Purchases cascade ─────────────────────────────────────────────────────────

export async function deletePurchaseWithCascade(purchaseId: number, partyId?: number): Promise<void> {
  const purchase = await purchaseCRUD.getById(purchaseId);
  if (!purchase) return;
  for (const item of purchase.items) {
    const inv = await findInvItem(item.description);
    if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, -item.qty);
  }
  if (partyId != null) await partyCRUD.updateBalance(partyId, purchase.netAmount);
  await glCRUD.deleteByRef(purchase.purchaseOrderNo);
  await purchaseCRUD.delete(purchaseId);
}

export async function editPurchaseWithCascade(
  purchaseId: number,
  newData: Omit<PurchaseRecord, 'id'>,
  oldPartyId?: number,
  newPartyId?: number,
): Promise<void> {
  const old = await purchaseCRUD.getById(purchaseId);
  if (!old) return;
  for (const item of old.items) {
    const inv = await findInvItem(item.description);
    if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, -item.qty);
  }
  if (oldPartyId != null) await partyCRUD.updateBalance(oldPartyId, old.netAmount);
  await glCRUD.deleteByRef(old.purchaseOrderNo);
  const updated: PurchaseRecord & { id: number } = { ...newData, id: purchaseId, syncStatus: 'synced' };
  await purchaseCRUD.update(purchaseId, updated);
  for (const item of newData.items) {
    const inv = await findInvItem(item.description);
    if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, item.qty);
  }
  await postPurchaseToGL(updated);
  if (newPartyId != null) await partyCRUD.updateBalance(newPartyId, -updated.netAmount);
}

// ── Expenses cascade ──────────────────────────────────────────────────────────

export async function deleteExpenseWithCascade(expenseId: number): Promise<void> {
  await glCRUD.deleteByRef(`EXP-${expenseId}`);
  await expenseCRUD.delete(expenseId);
}

export async function editExpenseWithCascade(
  expenseId: number,
  newData: Omit<ExpenseRecord, 'id'>,
): Promise<void> {
  await glCRUD.deleteByRef(`EXP-${expenseId}`);
  await expenseCRUD.update(expenseId, newData);
  const updated: ExpenseRecord & { id: number } = { ...newData, id: expenseId };
  await postExpenseToGL(updated);
}

// ── General Ledger direct admin overrides ─────────────────────────────────────

export async function editGLEntryById(glId: number, updates: Partial<Omit<GLEntry, 'id'>>): Promise<void> {
  await glCRUD.update(glId, updates);
}

export async function deleteGLEntryById(glId: number): Promise<void> {
  await glCRUD.delete(glId);
}
