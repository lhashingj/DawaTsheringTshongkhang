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

/** Cash Book — real-time liquid cash flow tracking. */
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

/** A single line item on a customer or supplier return note. */
export interface ReturnItem {
  description: string;
  qty: number;
  unit: UnitType;
  rate: number;
  amount: number;
}

/** Credit Note — customer returns goods to us. */
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

/** Debit Note — we return goods to supplier. */
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

// ── Database class ────────────────────────────────────────────────────────────

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

// ── Sales ─────────────────────────────────────────────────────────────────────

export const salesCRUD = {
  async getNextInvoiceNo(): Promise<string> {
    const year = String(new Date().getFullYear()).slice(-2);
    const prefix = `${year}-`;
    const all = await db.sales.toArray();
    const yearSales = all.filter(s => s.invoiceNo.startsWith(prefix));
    if (yearSales.length === 0) return `${prefix}0001`;
    const maxNo = Math.max(...yearSales.map(s => parseInt(s.invoiceNo.split('-')[1], 10) || 0));
    return `${prefix}${String(maxNo + 1).padStart(4, '0')}`;
  },
  create: (data: Omit<SaleRecord, 'id'>) => db.sales.add(data),
  getAll: () => db.sales.orderBy('timestamp').reverse().toArray(),
  getById: (id: number) => db.sales.get(id),
  update: (id: number, data: Partial<SaleRecord>) => db.sales.update(id, data),
  delete: (id: number) => db.sales.delete(id),
  getByDateRange: (from: Date, to: Date) =>
    db.sales.where('timestamp').between(from, to, true, true).toArray(),
};

// ── Purchases ─────────────────────────────────────────────────────────────────

export const purchaseCRUD = {
  async getNextPONo(): Promise<string> {
    const count = await db.purchases.count();
    return `PO-${String(count + 1).padStart(4, '0')}`;
  },
  create: (data: Omit<PurchaseRecord, 'id'>) => db.purchases.add(data),
  getAll: () => db.purchases.orderBy('timestamp').reverse().toArray(),
  getById: (id: number) => db.purchases.get(id),
  update: (id: number, data: Partial<PurchaseRecord>) => db.purchases.update(id, data),
  delete: (id: number) => db.purchases.delete(id),
  getByDateRange: (from: Date, to: Date) =>
    db.purchases.where('timestamp').between(from, to, true, true).toArray(),
};

// ── Parties ───────────────────────────────────────────────────────────────────

export const partyCRUD = {
  create: (data: Omit<PartyRecord, 'id'>) => db.parties.add(data),
  getAll: () => db.parties.orderBy('name').toArray(),
  getById: (id: number) => db.parties.get(id),
  update: (id: number, data: Partial<PartyRecord>) => db.parties.update(id, data),
  delete: (id: number) => db.parties.delete(id),
  async updateBalance(id: number, delta: number) {
    const party = await db.parties.get(id);
    if (party) {
      await db.parties.update(id, {
        outstandingBalance: party.outstandingBalance + delta,
        updatedAt: new Date(),
      });
    }
  },
};

// ── Inventory ─────────────────────────────────────────────────────────────────

export const inventoryCRUD = {
  create: (data: Omit<InventoryItem, 'id'>) => db.inventory.add(data),
  getAll: () => db.inventory.orderBy('description').toArray(),
  getById: (id: number) => db.inventory.get(id),
  update: (id: number, data: Partial<InventoryItem>) => db.inventory.update(id, data),
  delete: (id: number) => db.inventory.delete(id),
  async adjustStock(id: number, delta: number) {
    const item = await db.inventory.get(id);
    if (item) {
      await db.inventory.update(id, {
        stockQty: Math.max(0, item.stockQty + delta),
        lastUpdated: new Date(),
      });
    }
  },
};

// ── Expenses ──────────────────────────────────────────────────────────────────

export const expenseCRUD = {
  create: (data: Omit<ExpenseRecord, 'id'>) => db.expenses.add(data),
  getAll: () => db.expenses.orderBy('date').reverse().toArray(),
  getById: (id: number) => db.expenses.get(id),
  update: (id: number, data: Partial<ExpenseRecord>) => db.expenses.update(id, data),
  delete: (id: number) => db.expenses.delete(id),
  getByDateRange: (from: Date, to: Date) =>
    db.expenses.where('date').between(from, to, true, true).toArray(),
};

// ── Payments ──────────────────────────────────────────────────────────────────

export const paymentCRUD = {
  create: (data: Omit<PaymentRecord, 'id'>) => db.payments.add(data),
  getAll: () => db.payments.orderBy('timestamp').reverse().toArray(),
  getById: (id: number) => db.payments.get(id),
  update: (id: number, data: Partial<PaymentRecord>) => db.payments.update(id, data),
  delete: (id: number) => db.payments.delete(id),
  getByParty: (partyId: number) =>
    db.payments.where('partyId').equals(partyId).reverse().sortBy('timestamp'),
};

// ── Cash Book ─────────────────────────────────────────────────────────────────

export const cashBookCRUD = {
  async getNextVoucherNo(): Promise<string> {
    const count = await db.cashBook.count();
    return `CB-${String(count + 1).padStart(4, '0')}`;
  },
  create: (data: Omit<CashBookEntry, 'id'>) => db.cashBook.add(data),
  getAll: () => db.cashBook.orderBy('timestamp').reverse().toArray(),
  getById: (id: number) => db.cashBook.get(id),
  update: (id: number, data: Partial<CashBookEntry>) => db.cashBook.update(id, data),
  delete: (id: number) => db.cashBook.delete(id),
};

// ── Credit Notes (Customer Returns) ──────────────────────────────────────────

export const creditNoteCRUD = {
  async getNextCNNo(): Promise<string> {
    const count = await db.creditNotes.count();
    return `CN-${String(count + 1).padStart(4, '0')}`;
  },
  create: (data: Omit<CreditNote, 'id'>) => db.creditNotes.add(data),
  getAll: () => db.creditNotes.orderBy('timestamp').reverse().toArray(),
  getById: (id: number) => db.creditNotes.get(id),
  delete: (id: number) => db.creditNotes.delete(id),
};

// ── Debit Notes (Supplier Returns) ───────────────────────────────────────────

export const debitNoteCRUD = {
  async getNextDNNo(): Promise<string> {
    const count = await db.debitNotes.count();
    return `DN-${String(count + 1).padStart(4, '0')}`;
  },
  create: (data: Omit<DebitNote, 'id'>) => db.debitNotes.add(data),
  getAll: () => db.debitNotes.orderBy('timestamp').reverse().toArray(),
  getById: (id: number) => db.debitNotes.get(id),
  delete: (id: number) => db.debitNotes.delete(id),
};

// ── Inventory automation ──────────────────────────────────────────────────────

async function findInventoryItem(description: string): Promise<InventoryItem | undefined> {
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

/**
 * Decrements inventory stock AND posts the perpetual COGS double-entry to the GL.
 *   DR  Cost of Goods Sold  (expense) = qty × unitCost
 *   CR  Inventory / COGS    (asset)   = qty × unitCost
 * Falls back to 60 % of retail rate if no baseRate is on record.
 */
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
    if (unitCost <= 0) {
      unitCost = item.rate * 0.60;
      console.warn(
        `[COGS] No purchase cost for "${item.description}" — ` +
        `fallback 60% of retail: Nu.${unitCost.toFixed(2)}`,
      );
    }

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

  if (cogsEntries.length > 0) await db.generalLedger.bulkAdd(cogsEntries);
}

// ── General Ledger posting ────────────────────────────────────────────────────

export async function postSaleToGL(sale: SaleRecord & { id: number }): Promise<void> {
  const ts = new Date(sale.timestamp);
  const label = `${sale.customerName || 'Cash Customer'} — Inv #${sale.invoiceNo}`;
  await db.generalLedger.bulkAdd([
    {
      timestamp: ts, transactionRef: sale.invoiceNo, transactionType: 'sale',
      account: 'Cash / Bank', accountType: 'asset',
      debit: sale.netAmount, credit: 0,
      description: `Cash received — ${label}`,
    },
    {
      timestamp: ts, transactionRef: sale.invoiceNo, transactionType: 'sale',
      account: 'Sales Revenue', accountType: 'revenue',
      debit: 0, credit: sale.grossAmount,
      description: `Gross revenue — ${label}`,
    },
    {
      timestamp: ts, transactionRef: sale.invoiceNo, transactionType: 'sale',
      account: 'GST Collected (5%)', accountType: 'liability',
      debit: 0, credit: sale.gstAmount,
      description: `GST 5% collected — ${label}`,
    },
  ] as Omit<GLEntry, 'id'>[]);
}

export async function postPurchaseToGL(purchase: PurchaseRecord & { id: number }): Promise<void> {
  const ts = new Date(purchase.timestamp);
  const label = `${purchase.supplierName} — ${purchase.purchaseOrderNo}`;
  await db.generalLedger.bulkAdd([
    {
      timestamp: ts, transactionRef: purchase.purchaseOrderNo, transactionType: 'purchase',
      account: 'Inventory / COGS', accountType: 'asset',
      debit: purchase.grossAmount, credit: 0,
      description: `Stock purchased — ${label}`,
    },
    {
      timestamp: ts, transactionRef: purchase.purchaseOrderNo, transactionType: 'purchase',
      account: 'GST Input Credit', accountType: 'asset',
      debit: purchase.gstAmount, credit: 0,
      description: `GST input credit — ${label}`,
    },
    {
      timestamp: ts, transactionRef: purchase.purchaseOrderNo, transactionType: 'purchase',
      account: 'Cash / Bank', accountType: 'asset',
      debit: 0, credit: purchase.netAmount,
      description: `Cash paid — ${label}`,
    },
  ] as Omit<GLEntry, 'id'>[]);
}

export async function postExpenseToGL(expense: ExpenseRecord & { id: number }): Promise<void> {
  const ts = new Date(expense.date);
  const ref = `EXP-${expense.id}`;
  const inputTax = expense.inputTaxAmount ?? 0;
  const netExpense = expense.amount - inputTax;

  const entries: Omit<GLEntry, 'id'>[] = [
    {
      timestamp: ts, transactionRef: ref, transactionType: 'expense',
      account: expense.category, accountType: 'expense',
      debit: netExpense, credit: 0,
      description: expense.description,
    },
    {
      timestamp: ts, transactionRef: ref, transactionType: 'expense',
      account: 'Cash / Bank', accountType: 'asset',
      debit: 0, credit: expense.amount,
      description: `Expense paid — ${expense.description}`,
    },
  ];

  if (inputTax > 0) {
    entries.push({
      timestamp: ts, transactionRef: ref, transactionType: 'expense',
      account: 'GST Input Credit', accountType: 'asset',
      debit: inputTax, credit: 0,
      description: `GST input credit on expense — ${expense.description}`,
    });
  }

  await db.generalLedger.bulkAdd(entries);
}

export async function postPaymentToGL(
  payment: PaymentRecord & { id: number },
  partyName: string,
): Promise<void> {
  const ts = new Date(payment.timestamp);
  const ref = `PAY-${payment.id}`;
  if (payment.direction === 'in') {
    await db.generalLedger.bulkAdd([
      {
        timestamp: ts, transactionRef: ref, transactionType: 'payment',
        account: 'Cash / Bank', accountType: 'asset',
        debit: payment.amount, credit: 0,
        description: `Payment received from ${partyName} (${payment.mode})`,
      },
      {
        timestamp: ts, transactionRef: ref, transactionType: 'payment',
        account: 'Accounts Receivable', accountType: 'asset',
        debit: 0, credit: payment.amount,
        description: `Payment received from ${partyName} (${payment.mode})`,
      },
    ] as Omit<GLEntry, 'id'>[]);
  } else {
    await db.generalLedger.bulkAdd([
      {
        timestamp: ts, transactionRef: ref, transactionType: 'payment',
        account: 'Accounts Payable', accountType: 'liability',
        debit: payment.amount, credit: 0,
        description: `Payment made to ${partyName} (${payment.mode})`,
      },
      {
        timestamp: ts, transactionRef: ref, transactionType: 'payment',
        account: 'Cash / Bank', accountType: 'asset',
        debit: 0, credit: payment.amount,
        description: `Payment made to ${partyName} (${payment.mode})`,
      },
    ] as Omit<GLEntry, 'id'>[]);
  }
}

/**
 * Cash Book GL posting.
 *   Received: DR Cash/Bank · CR Accounts Receivable
 *   Payment:  DR Accounts Payable · CR Cash/Bank
 */
export async function postCashBookToGL(entry: CashBookEntry & { id: number }): Promise<void> {
  const ts = new Date(entry.timestamp);
  const ref = entry.voucherNo;
  const label = `${entry.partyName}${entry.reference ? ` — ${entry.reference}` : ''}`;

  if (entry.type === 'received') {
    await db.generalLedger.bulkAdd([
      {
        timestamp: ts, transactionRef: ref, transactionType: 'payment',
        account: 'Cash / Bank', accountType: 'asset',
        debit: entry.amount, credit: 0,
        description: `Cash received — ${label}`,
      },
      {
        timestamp: ts, transactionRef: ref, transactionType: 'payment',
        account: 'Accounts Receivable', accountType: 'asset',
        debit: 0, credit: entry.amount,
        description: `Cash received — ${label}`,
      },
    ] as Omit<GLEntry, 'id'>[]);
  } else {
    await db.generalLedger.bulkAdd([
      {
        timestamp: ts, transactionRef: ref, transactionType: 'payment',
        account: 'Accounts Payable', accountType: 'liability',
        debit: entry.amount, credit: 0,
        description: `Cash paid — ${label}`,
      },
      {
        timestamp: ts, transactionRef: ref, transactionType: 'payment',
        account: 'Cash / Bank', accountType: 'asset',
        debit: 0, credit: entry.amount,
        description: `Cash paid — ${label}`,
      },
    ] as Omit<GLEntry, 'id'>[]);
  }
}

/**
 * Credit Note GL posting (customer return).
 *   DR Sales Revenue        (revenue)    grossAmount   ← reverse sales
 *   DR GST Collected (5%)   (liability)  gstAmount     ← reverse GST liability
 *   CR Cash/Bank or AR      (asset)      netAmount     ← refund or ledger credit
 *   DR Inventory/COGS       (asset)      costAmount    ← goods back in stock (per item)
 *   CR Cost of Goods Sold   (expense)    costAmount    ← COGS reversed (per item)
 */
export async function postCreditNoteToGL(cn: CreditNote & { id: number }): Promise<void> {
  const ts = new Date(cn.timestamp);
  const ref = cn.creditNoteNo;
  const label = `${cn.partyName} — ${cn.creditNoteNo}`;
  const creditAccount = cn.settlementType === 'cash' ? 'Cash / Bank' : 'Accounts Receivable';

  const entries: Omit<GLEntry, 'id'>[] = [
    {
      timestamp: ts, transactionRef: ref, transactionType: 'adjustment',
      account: 'Sales Revenue', accountType: 'revenue',
      debit: cn.grossAmount, credit: 0,
      description: `Customer return — revenue reversed — ${label}`,
    },
    {
      timestamp: ts, transactionRef: ref, transactionType: 'adjustment',
      account: 'GST Collected (5%)', accountType: 'liability',
      debit: cn.gstAmount, credit: 0,
      description: `Customer return — GST liability reversed — ${label}`,
    },
    {
      timestamp: ts, transactionRef: ref, transactionType: 'adjustment',
      account: creditAccount, accountType: 'asset',
      debit: 0, credit: cn.netAmount,
      description: `Customer return — ${cn.settlementType === 'cash' ? 'cash refund' : 'ledger credit'} — ${label}`,
    },
  ];

  // Reverse COGS per item
  for (const item of cn.items) {
    const inv = await findInventoryItem(item.description);
    const unitCost = (inv?.baseRate ?? 0) > 0 ? inv!.baseRate : item.rate * 0.60;
    const costAmount = Math.round(unitCost * item.qty * 100) / 100;
    if (costAmount > 0) {
      entries.push(
        {
          timestamp: ts, transactionRef: ref, transactionType: 'adjustment',
          account: 'Inventory / COGS', accountType: 'asset',
          debit: costAmount, credit: 0,
          description: `Return — stock restored — ${item.description} (${item.qty} × Nu.${unitCost.toFixed(2)})`,
        },
        {
          timestamp: ts, transactionRef: ref, transactionType: 'adjustment',
          account: 'Cost of Goods Sold', accountType: 'expense',
          debit: 0, credit: costAmount,
          description: `Return — COGS reversed — ${item.description} (${item.qty} × Nu.${unitCost.toFixed(2)})`,
        },
      );
    }
  }

  await db.generalLedger.bulkAdd(entries);
}

/**
 * Debit Note GL posting (supplier return).
 *   DR Accounts Payable   (liability) netAmount     ← reduce what we owe supplier
 *   CR Inventory/COGS     (asset)     grossAmount   ← remove stock value
 *   CR GST Input Credit   (asset)     gstAmount     ← reverse input credit we claimed
 */
export async function postDebitNoteToGL(dn: DebitNote & { id: number }): Promise<void> {
  const ts = new Date(dn.timestamp);
  const ref = dn.debitNoteNo;
  const label = `${dn.partyName} — ${dn.debitNoteNo}`;

  await db.generalLedger.bulkAdd([
    {
      timestamp: ts, transactionRef: ref, transactionType: 'adjustment',
      account: 'Accounts Payable', accountType: 'liability',
      debit: dn.netAmount, credit: 0,
      description: `Supplier return — AP reduced — ${label}`,
    },
    {
      timestamp: ts, transactionRef: ref, transactionType: 'adjustment',
      account: 'Inventory / COGS', accountType: 'asset',
      debit: 0, credit: dn.grossAmount,
      description: `Supplier return — stock removed — ${label}`,
    },
    {
      timestamp: ts, transactionRef: ref, transactionType: 'adjustment',
      account: 'GST Input Credit', accountType: 'asset',
      debit: 0, credit: dn.gstAmount,
      description: `Supplier return — GST input credit reversed — ${label}`,
    },
  ] as Omit<GLEntry, 'id'>[]);
}
