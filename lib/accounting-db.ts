import Dexie, { Table } from 'dexie';

export type UnitType = 'EACH' | 'PCS' | 'KG' | 'MTR' | 'SET' | 'BOX' | 'LTR' | 'NOS';
export type PartyType = 'customer' | 'supplier' | 'both';
export type SyncStatus = 'pending' | 'synced' | 'error';
export type ExpenseCategory =
  | 'Rent' | 'Utilities' | 'Salaries' | 'Transport' | 'Fuel'
  | 'Maintenance' | 'Stationery' | 'Communication' | 'Other';
export type GLAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type GLTransactionType = 'sale' | 'purchase' | 'expense' | 'adjustment' | 'payment';
export type PaymentMode = 'Cash' | 'Bank Transfer' | 'Cheque' | 'Online';
export type PaymentDirection = 'in' | 'out';

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

export const LOW_STOCK_THRESHOLD = 5;

class AccountingDatabase extends Dexie {
  sales!: Table<SaleRecord, number>;
  purchases!: Table<PurchaseRecord, number>;
  parties!: Table<PartyRecord, number>;
  inventory!: Table<InventoryItem, number>;
  expenses!: Table<ExpenseRecord, number>;
  generalLedger!: Table<GLEntry, number>;
  payments!: Table<PaymentRecord, number>;

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
  }
}

export const db = new AccountingDatabase();

// ── Sales ────────────────────────────────────────────────────────────────────
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

// ── Inventory automation ──────────────────────────────────────────────────────

async function findInventoryItem(description: string): Promise<InventoryItem | undefined> {
  const q = description.toLowerCase().trim();
  const exact = await db.inventory
    .filter(i => i.description.toLowerCase().trim() === q)
    .first();
  if (exact) return exact;
  return db.inventory
    .filter(i => i.description.toLowerCase().includes(q) || q.includes(i.description.toLowerCase().trim()))
    .first();
}

export async function autoDecrementStock(items: SaleItem[]): Promise<void> {
  for (const item of items) {
    const inv = await findInventoryItem(item.description);
    if (inv?.id != null) {
      await inventoryCRUD.adjustStock(inv.id, -item.qty);
    }
  }
}

export async function autoIncrementStock(items: PurchaseItem[]): Promise<void> {
  for (const item of items) {
    const inv = await findInventoryItem(item.description);
    if (inv?.id != null) {
      await inventoryCRUD.adjustStock(inv.id, item.qty);
    }
  }
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
  await db.generalLedger.bulkAdd([
    {
      timestamp: ts, transactionRef: `EXP-${expense.id}`, transactionType: 'expense',
      account: expense.category, accountType: 'expense',
      debit: expense.amount, credit: 0,
      description: expense.description,
    },
    {
      timestamp: ts, transactionRef: `EXP-${expense.id}`, transactionType: 'expense',
      account: 'Cash / Bank', accountType: 'asset',
      debit: 0, credit: expense.amount,
      description: `Expense paid — ${expense.description}`,
    },
  ] as Omit<GLEntry, 'id'>[]);
}

export async function postPaymentToGL(
  payment: PaymentRecord & { id: number },
  partyName: string,
): Promise<void> {
  const ts = new Date(payment.timestamp);
  const ref = `PAY-${payment.id}`;
  if (payment.direction === 'in') {
    // Customer pays us: DR Cash, CR Accounts Receivable
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
    // We pay supplier: DR Accounts Payable, CR Cash
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
