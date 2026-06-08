import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ── helpers ───────────────────────────────────────────────────────────────────

function toSaleRecord(row: Record<string, unknown>) {
  return { id: Number(row.id), invoiceNo: row.invoice_no, timestamp: row.sale_at, customerName: row.customer_name, customerPhone: row.customer_phone ?? undefined, customerAddress: row.customer_address ?? undefined, customerTPN: row.customer_tpn ?? undefined, items: row.items, grossAmount: Number(row.gross_amount), gstRate: Number(row.gst_rate), gstAmount: Number(row.gst_amount), netAmount: Number(row.net_amount), syncStatus: row.sync_status, notes: row.notes ?? undefined };
}
function toPurchaseRecord(row: Record<string, unknown>) {
  return { id: Number(row.id), purchaseOrderNo: row.purchase_order_no, timestamp: row.purchased_at, supplierName: row.supplier_name, supplierPhone: row.supplier_phone ?? undefined, supplierAddress: row.supplier_address ?? undefined, supplierTPN: row.supplier_tpn ?? undefined, items: row.items, grossAmount: Number(row.gross_amount), gstRate: Number(row.gst_rate), gstAmount: Number(row.gst_amount), netAmount: Number(row.net_amount), syncStatus: row.sync_status, notes: row.notes ?? undefined };
}
function toPartyRecord(row: Record<string, unknown>) {
  return { id: Number(row.id), partyType: row.party_type, name: row.name, phone: row.phone ?? undefined, address: row.address ?? undefined, email: row.email ?? undefined, tpn: row.tpn ?? undefined, licenseNo: row.license_no ?? undefined, gstNo: row.gst_no ?? undefined, procurementOfficer: row.procurement_officer ?? undefined, openingBalance: row.opening_balance != null ? Number(row.opening_balance) : undefined, outstandingBalance: Number(row.outstanding_balance), notes: row.notes ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at };
}
function toInventoryRecord(row: Record<string, unknown>) {
  return { id: Number(row.id), itemCode: row.item_code ?? undefined, description: row.description, unit: row.unit, baseRate: Number(row.base_rate), stockQty: Number(row.stock_qty), reorderLevel: Number(row.reorder_level), lastUpdated: row.last_updated, notes: row.notes ?? undefined };
}
function toExpenseRecord(row: Record<string, unknown>) {
  return { id: Number(row.id), date: row.expense_date, category: row.category, description: row.description, amount: Number(row.amount), inputTaxRate: row.input_tax_rate != null ? Number(row.input_tax_rate) : undefined, inputTaxAmount: row.input_tax_amount != null ? Number(row.input_tax_amount) : undefined, reference: row.reference ?? undefined, notes: row.notes ?? undefined };
}
function toPaymentRecord(row: Record<string, unknown>) {
  return { id: Number(row.id), partyId: Number(row.party_id), timestamp: row.paid_at, amount: Number(row.amount), direction: row.direction, mode: row.mode, reference: row.reference ?? undefined, notes: row.notes ?? undefined };
}
function toGLRecord(row: Record<string, unknown>) {
  return { id: Number(row.id), timestamp: row.entry_at, transactionRef: row.transaction_ref, transactionType: row.transaction_type, account: row.account, accountType: row.account_type, debit: Number(row.debit), credit: Number(row.credit), description: row.description };
}
function toCashBookRecord(row: Record<string, unknown>) {
  return { id: Number(row.id), voucherNo: row.voucher_no, timestamp: row.entry_at, type: row.type, partyId: row.party_id != null ? Number(row.party_id) : undefined, partyName: row.party_name, amount: Number(row.amount), description: row.description, reference: row.reference ?? undefined, syncStatus: row.sync_status };
}
function toCreditNoteRecord(row: Record<string, unknown>) {
  return { id: Number(row.id), creditNoteNo: row.credit_note_no, timestamp: row.noted_at, originalInvoiceNo: row.original_invoice_no ?? undefined, partyId: row.party_id != null ? Number(row.party_id) : undefined, partyName: row.party_name, items: row.items, grossAmount: Number(row.gross_amount), gstRate: Number(row.gst_rate), gstAmount: Number(row.gst_amount), netAmount: Number(row.net_amount), settlementType: row.settlement_type, notes: row.notes ?? undefined, syncStatus: row.sync_status };
}
function toDebitNoteRecord(row: Record<string, unknown>) {
  return { id: Number(row.id), debitNoteNo: row.debit_note_no, timestamp: row.noted_at, originalPONo: row.original_po_no ?? undefined, partyId: row.party_id != null ? Number(row.party_id) : undefined, partyName: row.party_name, items: row.items, grossAmount: Number(row.gross_amount), gstRate: Number(row.gst_rate), gstAmount: Number(row.gst_amount), netAmount: Number(row.net_amount), notes: row.notes ?? undefined, syncStatus: row.sync_status };
}

// ── GET — pull all data from Supabase (Restore direction) ─────────────────────

export async function GET() {
  const sb = createServerClient();

  const [sales, purchases, parties, inventory, expenses, payments, gl, cashBook, creditNotes, debitNotes] =
    await Promise.all([
      sb.from('accounting_sales').select('*').order('sale_at', { ascending: true }),
      sb.from('accounting_purchases').select('*').order('purchased_at', { ascending: true }),
      sb.from('accounting_parties').select('*').order('id', { ascending: true }),
      sb.from('accounting_inventory').select('*').order('id', { ascending: true }),
      sb.from('accounting_expenses').select('*').order('expense_date', { ascending: true }),
      sb.from('accounting_payments').select('*').order('paid_at', { ascending: true }),
      sb.from('accounting_general_ledger').select('*').order('entry_at', { ascending: true }),
      sb.from('accounting_cash_book').select('*').order('entry_at', { ascending: true }),
      sb.from('accounting_credit_notes').select('*').order('noted_at', { ascending: true }),
      sb.from('accounting_debit_notes').select('*').order('noted_at', { ascending: true }),
    ]);

  return NextResponse.json({
    sales: (sales.data || []).map(toSaleRecord),
    purchases: (purchases.data || []).map(toPurchaseRecord),
    parties: (parties.data || []).map(toPartyRecord),
    inventory: (inventory.data || []).map(toInventoryRecord),
    expenses: (expenses.data || []).map(toExpenseRecord),
    payments: (payments.data || []).map(toPaymentRecord),
    generalLedger: (gl.data || []).map(toGLRecord),
    cashBook: (cashBook.data || []).map(toCashBookRecord),
    creditNotes: (creditNotes.data || []).map(toCreditNoteRecord),
    debitNotes: (debitNotes.data || []).map(toDebitNoteRecord),
  });
}

// ── POST — push all local data to Supabase (Backup direction) ─────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function POST(request: Request) {
  const sb = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = await request.json() as Record<string, any[]>;

  const errors: string[] = [];

  async function replaceTable(
    tableName: string,
    rows: Record<string, unknown>[],
  ) {
    if (rows.length === 0) return;
    const { error: delErr } = await sb.from(tableName).delete().gte('id', 0);
    if (delErr) { errors.push(`${tableName} delete: ${delErr.message}`); return; }
    const CHUNK = 100;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error: insErr } = await sb.from(tableName).insert(rows.slice(i, i + CHUNK));
      if (insErr) { errors.push(`${tableName} insert: ${insErr.message}`); return; }
    }
  }

  const sales = (body.sales || []).map((r: Record<string, unknown>) => ({
    invoice_no: r.invoiceNo, sale_at: r.timestamp, customer_name: r.customerName,
    customer_phone: r.customerPhone ?? null, customer_address: r.customerAddress ?? null,
    customer_tpn: r.customerTPN ?? null, items: r.items,
    gross_amount: r.grossAmount, gst_rate: r.gstRate, gst_amount: r.gstAmount,
    net_amount: r.netAmount, sync_status: 'synced', notes: r.notes ?? null,
  }));

  const purchases = (body.purchases || []).map((r: Record<string, unknown>) => ({
    purchase_order_no: r.purchaseOrderNo, purchased_at: r.timestamp, supplier_name: r.supplierName,
    supplier_phone: r.supplierPhone ?? null, supplier_address: r.supplierAddress ?? null,
    supplier_tpn: r.supplierTPN ?? null, items: r.items,
    gross_amount: r.grossAmount, gst_rate: r.gstRate, gst_amount: r.gstAmount,
    net_amount: r.netAmount, sync_status: 'synced', notes: r.notes ?? null,
  }));

  const parties = (body.parties || []).map((r: Record<string, unknown>) => ({
    party_type: r.partyType, name: r.name, phone: r.phone ?? null,
    address: r.address ?? null, email: r.email ?? null, tpn: r.tpn ?? null,
    license_no: r.licenseNo ?? null, gst_no: r.gstNo ?? null,
    procurement_officer: r.procurementOfficer ?? null,
    opening_balance: r.openingBalance ?? 0, outstanding_balance: r.outstandingBalance,
    notes: r.notes ?? null, created_at: r.createdAt, updated_at: r.updatedAt,
  }));

  const inventory = (body.inventory || []).map((r: Record<string, unknown>) => ({
    item_code: r.itemCode ?? null, description: r.description, unit: r.unit,
    base_rate: r.baseRate, stock_qty: r.stockQty, reorder_level: r.reorderLevel,
    last_updated: r.lastUpdated, notes: r.notes ?? null,
  }));

  const expenses = (body.expenses || []).map((r: Record<string, unknown>) => ({
    expense_date: typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date as string).toISOString().split('T')[0],
    category: r.category, description: r.description, amount: r.amount,
    input_tax_rate: r.inputTaxRate ?? null, input_tax_amount: r.inputTaxAmount ?? null,
    reference: r.reference ?? null, notes: r.notes ?? null,
  }));

  const payments = (body.payments || []).map((r: Record<string, unknown>) => ({
    party_id: r.partyId, paid_at: r.timestamp, amount: r.amount,
    direction: r.direction, mode: r.mode,
    reference: r.reference ?? null, notes: r.notes ?? null,
  }));

  const gl = (body.generalLedger || []).map((r: Record<string, unknown>) => ({
    entry_at: r.timestamp, transaction_ref: r.transactionRef, transaction_type: r.transactionType,
    account: r.account, account_type: r.accountType, debit: r.debit, credit: r.credit, description: r.description,
  }));

  const cashBook = (body.cashBook || []).map((r: Record<string, unknown>) => ({
    voucher_no: r.voucherNo, entry_at: r.timestamp, type: r.type,
    party_id: r.partyId ?? null, party_name: r.partyName, amount: r.amount,
    description: r.description, reference: r.reference ?? null, sync_status: 'synced',
  }));

  const creditNotes = (body.creditNotes || []).map((r: Record<string, unknown>) => ({
    credit_note_no: r.creditNoteNo, noted_at: r.timestamp,
    original_invoice_no: r.originalInvoiceNo ?? null, party_id: r.partyId ?? null,
    party_name: r.partyName, items: r.items,
    gross_amount: r.grossAmount, gst_rate: r.gstRate, gst_amount: r.gstAmount,
    net_amount: r.netAmount, settlement_type: r.settlementType, notes: r.notes ?? null, sync_status: 'synced',
  }));

  const debitNotes = (body.debitNotes || []).map((r: Record<string, unknown>) => ({
    debit_note_no: r.debitNoteNo, noted_at: r.timestamp,
    original_po_no: r.originalPONo ?? null, party_id: r.partyId ?? null,
    party_name: r.partyName, items: r.items,
    gross_amount: r.grossAmount, gst_rate: r.gstRate, gst_amount: r.gstAmount,
    net_amount: r.netAmount, notes: r.notes ?? null, sync_status: 'synced',
  }));

  await replaceTable('accounting_sales', sales);
  await replaceTable('accounting_purchases', purchases);
  await replaceTable('accounting_parties', parties);
  await replaceTable('accounting_inventory', inventory);
  await replaceTable('accounting_expenses', expenses);
  await replaceTable('accounting_payments', payments);
  await replaceTable('accounting_general_ledger', gl);
  await replaceTable('accounting_cash_book', cashBook);
  await replaceTable('accounting_credit_notes', creditNotes);
  await replaceTable('accounting_debit_notes', debitNotes);

  if (errors.length > 0) {
    return NextResponse.json({ success: false, errors }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
