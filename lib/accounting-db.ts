import Dexie, { Table } from 'dexie';

export type UnitType = 'EACH' | 'PCS' | 'KG' | 'MTR' | 'SET' | 'BOX' | 'LTR' | 'NOS' | 'PAIR';
export type PartyType = 'customer' | 'supplier' | 'both';
export type SyncStatus = 'pending' | 'synced' | 'error';
export type ExpenseCategory =
  | 'Rent' | 'Utilities' | 'Salaries' | 'Transport' | 'Fuel'
  | 'Maintenance' | 'Stationery' | 'Communication' | 'Other';
export type GLAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type GLTransactionType = 'sale' | 'purchase' | 'expense' | 'adjustment' | 'payment';
export type PaymentMode = 'Cash' | 'Bank Transfer' | 'Cheque' | 'Online';
export type PaymentDirection = 'in' | 'out';
export type CashBookType = 'received' | 'payment';
export type ReturnSettlement = 'cash' | 'ledger';

// ── Record interfaces ─────────────────────────────────────────────────────────

export interface SaleItem {
  description: string;
  qty: number;
  unit: UnitType;
  rate: number;
  amount: number;
}

export interface SaleRecord {
  id?: number;
  invoiceNo: string;
  timestamp: Date;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerTPN?: string;
  items: SaleItem[];
  grossAmount: number;
  gstRate: number;
  gstAmount: number;
  netAmount: number;
  syncStatus: SyncStatus;
  notes?: string;
}

export interface PurchaseItem {
  description: string;
  qty: number;
  unit: UnitType;
  rate: number;
  amount: number;
}

export interface PurchaseRecord {
  id?: number;
  purchaseOrderNo: string;
  timestamp: Date;
  supplierName: string;
  supplierPhone?: string;
  supplierAddress?: string;
  supplierTPN?: string;
  items: PurchaseItem[];
  grossAmount: number;
  gstRate: number;
  gstAmount: number;
  netAmount: number;
  syncStatus: SyncStatus;
  notes?: string;
}

export interface PartyRecord {
  id?: number;
  partyType: PartyType;
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  tpn?: string;
  licenseNo?: string;
  gstNo?: string;
  procurementOfficer?: string;
  openingBalance?: number;
  outstandingBalance: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItem {
  id?: number;
  itemCode?: string;
  description: string;
  unit: UnitType;
  baseRate: number;
  stockQty: number;
  reorderLevel: number;
  lastUpdated: Date;
  notes?: string;
}

export interface ExpenseRecord {
  id?: number;
  date: Date;
  category: ExpenseCategory;
  description: string;
  amount: number;
  inputTaxRate?: number;
  inputTaxAmount?: number;
  reference?: string;
  notes?: string;
}

export interface PaymentRecord {
  id?: number;
  partyId: number;
  timestamp: Date;
  amount: number;
  direction: PaymentDirection;
  mode: PaymentMode;
  reference?: string;
  notes?: string;
}

export interface GLEntry {
  id?: number;
  timestamp: Date;
  transactionRef: string;
  transactionType: GLTransactionType;
  account: string;
  accountType: GLAccountType;
  debit: number;
  credit: number;
  description: string;
}

export interface CashBookEntry {
  id?: number;
  voucherNo: string;
  timestamp: Date;
  type: CashBookType;
  partyId?: number;
  partyName: string;
  amount: number;
  description: string;
  reference?: string;
  syncStatus: SyncStatus;
}

export interface ReturnItem {
  description: string;
  qty: number;
  unit: UnitType;
  rate: number;
  amount: number;
}

export interface CreditNote {
  id?: number;
  creditNoteNo: string;
  timestamp: Date;
  originalInvoiceNo?: string;
  partyId?: number;
  partyName: string;
  items: ReturnItem[];
  grossAmount: number;
  gstRate: number;
  gstAmount: number;
  netAmount: number;
  settlementType: ReturnSettlement;
  notes?: string;
  syncStatus: SyncStatus;
}

export interface DebitNote {
  id?: number;
  debitNoteNo: string;
  timestamp: Date;
  originalPONo?: string;
  partyId?: number;
  partyName: string;
  items: ReturnItem[];
  grossAmount: number;
  gstRate: number;
  gstAmount: number;
  netAmount: number;
  notes?: string;
  syncStatus: SyncStatus;
}

export const LOW_STOCK_THRESHOLD = 5;

// ── Dexie (kept only for one-time local migration reads) ──────────────────────

class AccountingDatabase extends Dexie {
  sales!: Table<SaleRecord, number>;
  purchases!: Table<PurchaseRecord, number>;
  parties!: Table<PartyRecord, number>;
  inventory!: Table<InventoryItem, number>;
  expenses!: Table<ExpenseRecord, number>;
  generalLedger!: Table<GLEntry, number>;
  payments!: Table<PaymentRecord, number>;
  cashBook!: Table<CashBookEntry, number>;
  creditNotes!: Table<CreditNote, number>;
  debitNotes!: Table<DebitNote, number>;

  constructor() {
    super('DTTAccountingDB');
    this.version(1).stores({
      sales: '++id, invoiceNo, timestamp, customerName, syncStatus',
      purchases: '++id, purchaseOrderNo, timestamp, supplierName, syncStatus',
      parties: '++id, partyType, name, tpn',
      inventory: '++id, itemCode, description, unit',
    });
    this.version(2).stores({
      expenses: '++id, date, category',
      generalLedger: '++id, timestamp, transactionRef, transactionType, account',
    });
    this.version(3).stores({
      payments: '++id, partyId, timestamp, direction',
    });
    this.version(4).stores({
      cashBook: '++id, voucherNo, timestamp, type, partyId',
      creditNotes: '++id, creditNoteNo, timestamp, partyId',
      debitNotes: '++id, debitNoteNo, timestamp, partyId',
    });
  }
}

export const db = new AccountingDatabase();

// ── Helper ────────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

// ── Sales (Supabase) ──────────────────────────────────────────────────────────

export const salesCRUD = {
  async getNextInvoiceNo(): Promise<string> {
    const { invoiceNo } = await apiFetch<{ invoiceNo: string }>('/api/accounting/sales?next=1');
    return invoiceNo;
  },
  async create(data: Omit<SaleRecord, 'id'>): Promise<number> {
    const saved = await apiFetch<{ id: number }>('/api/accounting/sales', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return saved.id;
  },
  getAll: () => apiFetch<(SaleRecord & { id: number })[]>('/api/accounting/sales'),
  async getById(id: number): Promise<(SaleRecord & { id: number }) | undefined> {
    try { return await apiFetch<SaleRecord & { id: number }>(`/api/accounting/sales/${id}`); }
    catch { return undefined; }
  },
  update: (id: number, data: Partial<SaleRecord>) =>
    apiFetch<void>(`/api/accounting/sales/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }),
  delete: (id: number) => apiFetch<void>(`/api/accounting/sales/${id}`, { method: 'DELETE' }),
  async getByDateRange(from: Date, to: Date): Promise<(SaleRecord & { id: number })[]> {
    const all = await this.getAll();
    return all.filter(s => { const t = new Date(s.timestamp); return t >= from && t <= to; });
  },
};

// ── Purchases (Supabase) ──────────────────────────────────────────────────────

export const purchaseCRUD = {
  async getNextPONo(): Promise<string> {
    const { purchaseOrderNo } = await apiFetch<{ purchaseOrderNo: string }>('/api/accounting/purchases?next=1');
    return purchaseOrderNo;
  },
  async create(data: Omit<PurchaseRecord, 'id'>): Promise<number> {
    const saved = await apiFetch<{ id: number }>('/api/accounting/purchases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return saved.id;
  },
  getAll: () => apiFetch<(PurchaseRecord & { id: number })[]>('/api/accounting/purchases'),
  async getById(id: number): Promise<(PurchaseRecord & { id: number }) | undefined> {
    try { return await apiFetch<PurchaseRecord & { id: number }>(`/api/accounting/purchases/${id}`); }
    catch { return undefined; }
  },
  update: (id: number, data: Partial<PurchaseRecord>) =>
    apiFetch<void>(`/api/accounting/purchases/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }),
  delete: (id: number) => apiFetch<void>(`/api/accounting/purchases/${id}`, { method: 'DELETE' }),
  async getByDateRange(from: Date, to: Date): Promise<(PurchaseRecord & { id: number })[]> {
    const all = await this.getAll();
    return all.filter(p => { const t = new Date(p.timestamp); return t >= from && t <= to; });
  },
};

// ── Parties (Supabase) ────────────────────────────────────────────────────────

export const partyCRUD = {
  async create(data: Omit<PartyRecord, 'id'>): Promise<number> {
    const saved = await apiFetch<{ id: number }>('/api/accounting/parties', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return saved.id;
  },
  getAll: () => apiFetch<(PartyRecord & { id: number })[]>('/api/accounting/parties'),
  async getById(id: number): Promise<(PartyRecord & { id: number }) | undefined> {
    try { return await apiFetch<PartyRecord & { id: number }>(`/api/accounting/parties/${id}`); }
    catch { return undefined; }
  },
  update: (id: number, data: Partial<PartyRecord>) =>
    apiFetch<void>(`/api/accounting/parties/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }),
  delete: (id: number) => apiFetch<void>(`/api/accounting/parties/${id}`, { method: 'DELETE' }),
  updateBalance: (id: number, delta: number) =>
    apiFetch<void>(`/api/accounting/parties/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outstandingBalanceDelta: delta }),
    }),
};

// ── Inventory (Supabase) ──────────────────────────────────────────────────────

export const inventoryCRUD = {
  async create(data: Omit<InventoryItem, 'id'>): Promise<number> {
    const saved = await apiFetch<{ id: number }>('/api/accounting/inventory', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return saved.id;
  },
  getAll: () => apiFetch<(InventoryItem & { id: number })[]>('/api/accounting/inventory'),
  async getById(id: number): Promise<(InventoryItem & { id: number }) | undefined> {
    try { return await apiFetch<InventoryItem & { id: number }>(`/api/accounting/inventory/${id}`); }
    catch { return undefined; }
  },
  update: (id: number, data: Partial<InventoryItem>) =>
    apiFetch<void>(`/api/accounting/inventory/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }),
  delete: (id: number) => apiFetch<void>(`/api/accounting/inventory/${id}`, { method: 'DELETE' }),
  adjustStock: (id: number, delta: number) =>
    apiFetch<void>(`/api/accounting/inventory/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stockDelta: delta }),
    }),
};

// ── Expenses (Supabase) ───────────────────────────────────────────────────────

export const expenseCRUD = {
  async create(data: Omit<ExpenseRecord, 'id'>): Promise<number> {
    const saved = await apiFetch<{ id: number }>('/api/accounting/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return saved.id;
  },
  getAll: () => apiFetch<(ExpenseRecord & { id: number })[]>('/api/accounting/expenses'),
  async getById(id: number): Promise<(ExpenseRecord & { id: number }) | undefined> {
    try { return await apiFetch<ExpenseRecord & { id: number }>(`/api/accounting/expenses/${id}`); }
    catch { return undefined; }
  },
  update: (id: number, data: Partial<ExpenseRecord>) =>
    apiFetch<void>(`/api/accounting/expenses/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }),
  delete: (id: number) => apiFetch<void>(`/api/accounting/expenses/${id}`, { method: 'DELETE' }),
  async getByDateRange(from: Date, to: Date): Promise<(ExpenseRecord & { id: number })[]> {
    const all = await this.getAll();
    return all.filter(e => { const t = new Date(e.date); return t >= from && t <= to; });
  },
};

// ── Payments (Supabase) ───────────────────────────────────────────────────────

export const paymentCRUD = {
  async create(data: Omit<PaymentRecord, 'id'>): Promise<number> {
    const saved = await apiFetch<{ id: number }>('/api/accounting/payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return saved.id;
  },
  getAll: () => apiFetch<(PaymentRecord & { id: number })[]>('/api/accounting/payments'),
  async getById(id: number): Promise<(PaymentRecord & { id: number }) | undefined> {
    try { return await apiFetch<PaymentRecord & { id: number }>(`/api/accounting/payments/${id}`); }
    catch { return undefined; }
  },
  update: (id: number, data: Partial<PaymentRecord>) =>
    apiFetch<void>(`/api/accounting/payments/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }),
  delete: (id: number) => apiFetch<void>(`/api/accounting/payments/${id}`, { method: 'DELETE' }),
  getByParty: (partyId: number) =>
    apiFetch<(PaymentRecord & { id: number })[]>(`/api/accounting/payments?partyId=${partyId}`),
};

// ── General Ledger (Supabase) ─────────────────────────────────────────────────

export const glCRUD = {
  getAll: () => apiFetch<(GLEntry & { id: number })[]>('/api/accounting/general-ledger'),
  async bulkAdd(entries: Omit<GLEntry, 'id'>[]): Promise<void> {
    await apiFetch<void>('/api/accounting/general-ledger', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entries),
    });
  },
  async deleteByRef(transactionRef: string): Promise<void> {
    await apiFetch<void>(`/api/accounting/general-ledger?ref=${encodeURIComponent(transactionRef)}`, { method: 'DELETE' });
  },
  async bulkDelete(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await apiFetch<void>(`/api/accounting/general-ledger?ids=${ids.join(',')}`, { method: 'DELETE' });
  },
  update: (id: number, data: Partial<GLEntry>) =>
    apiFetch<void>(`/api/accounting/general-ledger/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }),
  delete: (id: number) => apiFetch<void>(`/api/accounting/general-ledger/${id}`, { method: 'DELETE' }),
};

// ── Cash Book (Supabase) ──────────────────────────────────────────────────────

export const cashBookCRUD = {
  async getNextVoucherNo(): Promise<string> {
    const { voucherNo } = await apiFetch<{ voucherNo: string }>('/api/accounting/cash-book?next=1');
    return voucherNo;
  },
  async create(data: Omit<CashBookEntry, 'id'>): Promise<number> {
    const saved = await apiFetch<{ id: number }>('/api/accounting/cash-book', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return saved.id;
  },
  getAll: () => apiFetch<(CashBookEntry & { id: number })[]>('/api/accounting/cash-book'),
  async getById(id: number): Promise<(CashBookEntry & { id: number }) | undefined> {
    try { return await apiFetch<CashBookEntry & { id: number }>(`/api/accounting/cash-book/${id}`); }
    catch { return undefined; }
  },
  update: (id: number, data: Partial<CashBookEntry>) =>
    apiFetch<void>(`/api/accounting/cash-book/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }),
  delete: (id: number) => apiFetch<void>(`/api/accounting/cash-book/${id}`, { method: 'DELETE' }),
};

// ── Credit Notes (Supabase) ───────────────────────────────────────────────────

export const creditNoteCRUD = {
  async getNextCNNo(): Promise<string> {
    const { creditNoteNo } = await apiFetch<{ creditNoteNo: string }>('/api/accounting/credit-notes?next=1');
    return creditNoteNo;
  },
  async create(data: Omit<CreditNote, 'id'>): Promise<number> {
    const saved = await apiFetch<{ id: number }>('/api/accounting/credit-notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return saved.id;
  },
  getAll: () => apiFetch<(CreditNote & { id: number })[]>('/api/accounting/credit-notes'),
  async getById(id: number): Promise<(CreditNote & { id: number }) | undefined> {
    try { return await apiFetch<CreditNote & { id: number }>(`/api/accounting/credit-notes/${id}`); }
    catch { return undefined; }
  },
  delete: (id: number) => apiFetch<void>(`/api/accounting/credit-notes/${id}`, { method: 'DELETE' }),
};

// ── Debit Notes (Supabase) ────────────────────────────────────────────────────

export const debitNoteCRUD = {
  async getNextDNNo(): Promise<string> {
    const { debitNoteNo } = await apiFetch<{ debitNoteNo: string }>('/api/accounting/debit-notes?next=1');
    return debitNoteNo;
  },
  async create(data: Omit<DebitNote, 'id'>): Promise<number> {
    const saved = await apiFetch<{ id: number }>('/api/accounting/debit-notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return saved.id;
  },
  getAll: () => apiFetch<(DebitNote & { id: number })[]>('/api/accounting/debit-notes'),
  async getById(id: number): Promise<(DebitNote & { id: number }) | undefined> {
    try { return await apiFetch<DebitNote & { id: number }>(`/api/accounting/debit-notes/${id}`); }
    catch { return undefined; }
  },
  delete: (id: number) => apiFetch<void>(`/api/accounting/debit-notes/${id}`, { method: 'DELETE' }),
};

// ── Inventory fuzzy search (client-side, loads all from API) ──────────────────

async function findInventoryItem(description: string): Promise<(InventoryItem & { id: number }) | undefined> {
  const all = await inventoryCRUD.getAll();
  const q = description.toLowerCase().trim();
  const exact = all.find(i => i.description.toLowerCase().trim() === q);
  if (exact) return exact;
  return all.find(
    i => i.description.toLowerCase().includes(q) || q.includes(i.description.toLowerCase().trim()),
  );
}

export async function autoDecrementStock(items: SaleItem[]): Promise<void> {
  for (const item of items) {
    const inv = await findInventoryItem(item.description);
    if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, -item.qty);
  }
}

export async function autoIncrementStock(items: PurchaseItem[]): Promise<void> {
  for (const item of items) {
    const inv = await findInventoryItem(item.description);
    if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, item.qty);
  }
}

export async function decrementStockAndPostCOGS(
  items: SaleItem[],
  invoiceNo: string,
  timestamp: Date,
): Promise<void> {
  const cogsEntries: Omit<GLEntry, 'id'>[] = [];

  for (const item of items) {
    const inv = await findInventoryItem(item.description);
    if (inv?.id != null) await inventoryCRUD.adjustStock(inv.id, -item.qty);

    let unitCost = inv?.baseRate ?? 0;
    if (unitCost <= 0) unitCost = item.rate * 0.60;

    const cogsCost = Math.round(unitCost * item.qty * 100) / 100;
    if (cogsCost > 0) {
      cogsEntries.push(
        {
          timestamp, transactionRef: invoiceNo, transactionType: 'sale',
          account: 'Cost of Goods Sold', accountType: 'expense',
          debit: cogsCost, credit: 0,
          description: `COGS — ${item.description} (${item.qty} × Nu.${unitCost.toFixed(2)})`,
        },
        {
          timestamp, transactionRef: invoiceNo, transactionType: 'sale',
          account: 'Inventory / COGS', accountType: 'asset',
          debit: 0, credit: cogsCost,
          description: `Stock sold — ${item.description} (${item.qty} × Nu.${unitCost.toFixed(2)})`,
        },
      );
    }
  }

  if (cogsEntries.length > 0) await glCRUD.bulkAdd(cogsEntries);
}

// ── General Ledger posting ────────────────────────────────────────────────────

export async function postSaleToGL(sale: SaleRecord & { id: number }): Promise<void> {
  const ts = new Date(sale.timestamp);
  const label = `${sale.customerName || 'Cash Customer'} — Inv #${sale.invoiceNo}`;
  await glCRUD.bulkAdd([
    { timestamp: ts, transactionRef: sale.invoiceNo, transactionType: 'sale', account: 'Cash / Bank', accountType: 'asset', debit: sale.netAmount, credit: 0, description: `Cash received — ${label}` },
    { timestamp: ts, transactionRef: sale.invoiceNo, transactionType: 'sale', account: 'Sales Revenue', accountType: 'revenue', debit: 0, credit: sale.grossAmount, description: `Gross revenue — ${label}` },
    { timestamp: ts, transactionRef: sale.invoiceNo, transactionType: 'sale', account: 'GST Collected (5%)', accountType: 'liability', debit: 0, credit: sale.gstAmount, description: `GST 5% collected — ${label}` },
  ]);
}

export async function postPurchaseToGL(purchase: PurchaseRecord & { id: number }): Promise<void> {
  const ts = new Date(purchase.timestamp);
  const label = `${purchase.supplierName} — ${purchase.purchaseOrderNo}`;
  await glCRUD.bulkAdd([
    { timestamp: ts, transactionRef: purchase.purchaseOrderNo, transactionType: 'purchase', account: 'Inventory / COGS', accountType: 'asset', debit: purchase.grossAmount, credit: 0, description: `Stock purchased — ${label}` },
    { timestamp: ts, transactionRef: purchase.purchaseOrderNo, transactionType: 'purchase', account: 'GST Input Credit', accountType: 'asset', debit: purchase.gstAmount, credit: 0, description: `GST input credit — ${label}` },
    { timestamp: ts, transactionRef: purchase.purchaseOrderNo, transactionType: 'purchase', account: 'Cash / Bank', accountType: 'asset', debit: 0, credit: purchase.netAmount, description: `Cash paid — ${label}` },
  ]);
}

export async function postExpenseToGL(expense: ExpenseRecord & { id: number }): Promise<void> {
  const ts = new Date(expense.date);
  const ref = `EXP-${expense.id}`;
  const inputTax = expense.inputTaxAmount ?? 0;
  const netExpense = expense.amount - inputTax;

  const entries: Omit<GLEntry, 'id'>[] = [
    { timestamp: ts, transactionRef: ref, transactionType: 'expense', account: expense.category, accountType: 'expense', debit: netExpense, credit: 0, description: expense.description },
    { timestamp: ts, transactionRef: ref, transactionType: 'expense', account: 'Cash / Bank', accountType: 'asset', debit: 0, credit: expense.amount, description: `Expense paid — ${expense.description}` },
  ];
  if (inputTax > 0) {
    entries.push({ timestamp: ts, transactionRef: ref, transactionType: 'expense', account: 'GST Input Credit', accountType: 'asset', debit: inputTax, credit: 0, description: `GST input credit on expense — ${expense.description}` });
  }
  await glCRUD.bulkAdd(entries);
}

export async function postPaymentToGL(payment: PaymentRecord & { id: number }, partyName: string): Promise<void> {
  const ts = new Date(payment.timestamp);
  const ref = `PAY-${payment.id}`;
  if (payment.direction === 'in') {
    await glCRUD.bulkAdd([
      { timestamp: ts, transactionRef: ref, transactionType: 'payment', account: 'Cash / Bank', accountType: 'asset', debit: payment.amount, credit: 0, description: `Payment received from ${partyName} (${payment.mode})` },
      { timestamp: ts, transactionRef: ref, transactionType: 'payment', account: 'Accounts Receivable', accountType: 'asset', debit: 0, credit: payment.amount, description: `Payment received from ${partyName} (${payment.mode})` },
    ]);
  } else {
    await glCRUD.bulkAdd([
      { timestamp: ts, transactionRef: ref, transactionType: 'payment', account: 'Accounts Payable', accountType: 'liability', debit: payment.amount, credit: 0, description: `Payment made to ${partyName} (${payment.mode})` },
      { timestamp: ts, transactionRef: ref, transactionType: 'payment', account: 'Cash / Bank', accountType: 'asset', debit: 0, credit: payment.amount, description: `Payment made to ${partyName} (${payment.mode})` },
    ]);
  }
}

export async function postCashBookToGL(entry: CashBookEntry & { id: number }): Promise<void> {
  const ts = new Date(entry.timestamp);
  const ref = entry.voucherNo;
  const label = `${entry.partyName}${entry.reference ? ` — ${entry.reference}` : ''}`;
  if (entry.type === 'received') {
    await glCRUD.bulkAdd([
      { timestamp: ts, transactionRef: ref, transactionType: 'payment', account: 'Cash / Bank', accountType: 'asset', debit: entry.amount, credit: 0, description: `Cash received — ${label}` },
      { timestamp: ts, transactionRef: ref, transactionType: 'payment', account: 'Accounts Receivable', accountType: 'asset', debit: 0, credit: entry.amount, description: `Cash received — ${label}` },
    ]);
  } else {
    await glCRUD.bulkAdd([
      { timestamp: ts, transactionRef: ref, transactionType: 'payment', account: 'Accounts Payable', accountType: 'liability', debit: entry.amount, credit: 0, description: `Cash paid — ${label}` },
      { timestamp: ts, transactionRef: ref, transactionType: 'payment', account: 'Cash / Bank', accountType: 'asset', debit: 0, credit: entry.amount, description: `Cash paid — ${label}` },
    ]);
  }
}

export async function postCreditNoteToGL(cn: CreditNote & { id: number }): Promise<void> {
  const ts = new Date(cn.timestamp);
  const ref = cn.creditNoteNo;
  const label = `${cn.partyName} — ${cn.creditNoteNo}`;
  const creditAccount = cn.settlementType === 'cash' ? 'Cash / Bank' : 'Accounts Receivable';

  const entries: Omit<GLEntry, 'id'>[] = [
    { timestamp: ts, transactionRef: ref, transactionType: 'adjustment', account: 'Sales Revenue', accountType: 'revenue', debit: cn.grossAmount, credit: 0, description: `Customer return — revenue reversed — ${label}` },
    { timestamp: ts, transactionRef: ref, transactionType: 'adjustment', account: 'GST Collected (5%)', accountType: 'liability', debit: cn.gstAmount, credit: 0, description: `Customer return — GST liability reversed — ${label}` },
    { timestamp: ts, transactionRef: ref, transactionType: 'adjustment', account: creditAccount, accountType: 'asset', debit: 0, credit: cn.netAmount, description: `Customer return — ${cn.settlementType === 'cash' ? 'cash refund' : 'ledger credit'} — ${label}` },
  ];

  for (const item of cn.items) {
    const inv = await findInventoryItem(item.description);
    const unitCost = (inv?.baseRate ?? 0) > 0 ? inv!.baseRate : item.rate * 0.60;
    const costAmount = Math.round(unitCost * item.qty * 100) / 100;
    if (costAmount > 0) {
      entries.push(
        { timestamp: ts, transactionRef: ref, transactionType: 'adjustment', account: 'Inventory / COGS', accountType: 'asset', debit: costAmount, credit: 0, description: `Return — stock restored — ${item.description} (${item.qty} × Nu.${unitCost.toFixed(2)})` },
        { timestamp: ts, transactionRef: ref, transactionType: 'adjustment', account: 'Cost of Goods Sold', accountType: 'expense', debit: 0, credit: costAmount, description: `Return — COGS reversed — ${item.description} (${item.qty} × Nu.${unitCost.toFixed(2)})` },
      );
    }
  }

  await glCRUD.bulkAdd(entries);
}

export async function postDebitNoteToGL(dn: DebitNote & { id: number }): Promise<void> {
  const ts = new Date(dn.timestamp);
  const ref = dn.debitNoteNo;
  const label = `${dn.partyName} — ${dn.debitNoteNo}`;
  await glCRUD.bulkAdd([
    { timestamp: ts, transactionRef: ref, transactionType: 'adjustment', account: 'Accounts Payable', accountType: 'liability', debit: dn.netAmount, credit: 0, description: `Supplier return — AP reduced — ${label}` },
    { timestamp: ts, transactionRef: ref, transactionType: 'adjustment', account: 'Inventory / COGS', accountType: 'asset', debit: 0, credit: dn.grossAmount, description: `Supplier return — stock removed — ${label}` },
    { timestamp: ts, transactionRef: ref, transactionType: 'adjustment', account: 'GST Input Credit', accountType: 'asset', debit: 0, credit: dn.gstAmount, description: `Supplier return — GST input credit reversed — ${label}` },
  ]);
}
