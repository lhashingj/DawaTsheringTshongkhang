import { supabase } from './supabase';
import { db } from './accounting-db';

export const LAST_BACKUP_KEY = 'dtt-accounting-last-backup';

export async function backupToSupabase(): Promise<{ counts: Record<string, number> }> {
  const [sales, purchases, inventory, parties, expenses, payments] = await Promise.all([
    db.sales.toArray(),
    db.purchases.toArray(),
    db.inventory.toArray(),
    db.parties.toArray(),
    db.expenses.toArray(),
    db.payments.toArray(),
  ]);

  const now = new Date().toISOString();
  const counts: Record<string, number> = { sales: 0, purchases: 0, inventory: 0, parties: 0, expenses: 0, payments: 0 };

  if (sales.length > 0) {
    const { error } = await supabase.from('accounting_sales').upsert(
      sales.map(s => ({
        id: s.id,
        invoice_no: s.invoiceNo,
        timestamp: new Date(s.timestamp).toISOString(),
        customer_name: s.customerName,
        customer_phone: s.customerPhone ?? null,
        customer_address: s.customerAddress ?? null,
        customer_tpn: s.customerTPN ?? null,
        items: s.items,
        gross_amount: s.grossAmount,
        gst_rate: s.gstRate,
        gst_amount: s.gstAmount,
        net_amount: s.netAmount,
        notes: s.notes ?? null,
        synced_at: now,
      })),
      { onConflict: 'id' }
    );
    if (error) throw new Error(`Sales: ${error.message}`);
    counts.sales = sales.length;
  }

  if (purchases.length > 0) {
    const { error } = await supabase.from('accounting_purchases').upsert(
      purchases.map(p => ({
        id: p.id,
        purchase_order_no: p.purchaseOrderNo,
        timestamp: new Date(p.timestamp).toISOString(),
        supplier_name: p.supplierName,
        supplier_phone: p.supplierPhone ?? null,
        supplier_address: p.supplierAddress ?? null,
        supplier_tpn: p.supplierTPN ?? null,
        items: p.items,
        gross_amount: p.grossAmount,
        gst_rate: p.gstRate,
        gst_amount: p.gstAmount,
        net_amount: p.netAmount,
        notes: p.notes ?? null,
        synced_at: now,
      })),
      { onConflict: 'id' }
    );
    if (error) throw new Error(`Purchases: ${error.message}`);
    counts.purchases = purchases.length;
  }

  if (inventory.length > 0) {
    const { error } = await supabase.from('accounting_inventory').upsert(
      inventory.map(i => ({
        id: i.id,
        item_code: i.itemCode ?? null,
        description: i.description,
        unit: i.unit,
        base_rate: i.baseRate,
        stock_qty: i.stockQty,
        reorder_level: i.reorderLevel,
        last_updated: new Date(i.lastUpdated).toISOString(),
        notes: i.notes ?? null,
        synced_at: now,
      })),
      { onConflict: 'id' }
    );
    if (error) throw new Error(`Inventory: ${error.message}`);
    counts.inventory = inventory.length;
  }

  if (parties.length > 0) {
    const { error } = await supabase.from('accounting_parties').upsert(
      parties.map(p => ({
        id: p.id,
        party_type: p.partyType,
        name: p.name,
        phone: p.phone ?? null,
        address: p.address ?? null,
        email: p.email ?? null,
        tpn: p.tpn ?? null,
        license_no: p.licenseNo ?? null,
        gst_no: p.gstNo ?? null,
        opening_balance: p.openingBalance ?? 0,
        outstanding_balance: p.outstandingBalance,
        notes: p.notes ?? null,
        created_at: new Date(p.createdAt).toISOString(),
        updated_at: new Date(p.updatedAt).toISOString(),
        synced_at: now,
      })),
      { onConflict: 'id' }
    );
    if (error) throw new Error(`Parties: ${error.message}`);
    counts.parties = parties.length;
  }

  if (expenses.length > 0) {
    const { error } = await supabase.from('accounting_expenses').upsert(
      expenses.map(e => ({
        id: e.id,
        date: new Date(e.date).toISOString().split('T')[0],
        category: e.category,
        description: e.description,
        amount: e.amount,
        reference: e.reference ?? null,
        notes: e.notes ?? null,
        synced_at: now,
      })),
      { onConflict: 'id' }
    );
    if (error) throw new Error(`Expenses: ${error.message}`);
    counts.expenses = expenses.length;
  }

  if (payments.length > 0) {
    const { error } = await supabase.from('accounting_payments').upsert(
      payments.map(p => ({
        id: p.id,
        party_id: p.partyId,
        timestamp: new Date(p.timestamp).toISOString(),
        amount: p.amount,
        direction: p.direction,
        mode: p.mode,
        reference: p.reference ?? null,
        notes: p.notes ?? null,
        synced_at: now,
      })),
      { onConflict: 'id' }
    );
    if (error) throw new Error(`Payments: ${error.message}`);
    counts.payments = payments.length;
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_BACKUP_KEY, now);
  }

  return { counts };
}

export async function restoreFromSupabase(): Promise<{ counts: Record<string, number> }> {
  const [salesRes, purchasesRes, inventoryRes, partiesRes, expensesRes, paymentsRes] = await Promise.all([
    supabase.from('accounting_sales').select('*'),
    supabase.from('accounting_purchases').select('*'),
    supabase.from('accounting_inventory').select('*'),
    supabase.from('accounting_parties').select('*'),
    supabase.from('accounting_expenses').select('*'),
    supabase.from('accounting_payments').select('*'),
  ]);

  for (const [name, res] of [
    ['Sales', salesRes], ['Purchases', purchasesRes], ['Inventory', inventoryRes],
    ['Parties', partiesRes], ['Expenses', expensesRes], ['Payments', paymentsRes],
  ] as const) {
    if ((res as { error: { message: string } | null }).error) {
      throw new Error(`${name}: ${(res as { error: { message: string } }).error.message}`);
    }
  }

  const counts: Record<string, number> = { sales: 0, purchases: 0, inventory: 0, parties: 0, expenses: 0, payments: 0 };

  await db.transaction('rw', [db.sales, db.purchases, db.inventory, db.parties, db.expenses, db.payments], async () => {
    if (salesRes.data && salesRes.data.length > 0) {
      await db.sales.clear();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.sales.bulkAdd(salesRes.data.map((s: any) => ({
        id: s.id,
        invoiceNo: s.invoice_no,
        timestamp: new Date(s.timestamp),
        customerName: s.customer_name,
        customerPhone: s.customer_phone,
        customerAddress: s.customer_address,
        customerTPN: s.customer_tpn,
        items: s.items,
        grossAmount: Number(s.gross_amount),
        gstRate: Number(s.gst_rate),
        gstAmount: Number(s.gst_amount),
        netAmount: Number(s.net_amount),
        syncStatus: 'synced' as const,
        notes: s.notes,
      })));
      counts.sales = salesRes.data.length;
    }

    if (purchasesRes.data && purchasesRes.data.length > 0) {
      await db.purchases.clear();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.purchases.bulkAdd(purchasesRes.data.map((p: any) => ({
        id: p.id,
        purchaseOrderNo: p.purchase_order_no,
        timestamp: new Date(p.timestamp),
        supplierName: p.supplier_name,
        supplierPhone: p.supplier_phone,
        supplierAddress: p.supplier_address,
        supplierTPN: p.supplier_tpn,
        items: p.items,
        grossAmount: Number(p.gross_amount),
        gstRate: Number(p.gst_rate),
        gstAmount: Number(p.gst_amount),
        netAmount: Number(p.net_amount),
        syncStatus: 'synced' as const,
        notes: p.notes,
      })));
      counts.purchases = purchasesRes.data.length;
    }

    if (inventoryRes.data && inventoryRes.data.length > 0) {
      await db.inventory.clear();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.inventory.bulkAdd(inventoryRes.data.map((i: any) => ({
        id: i.id,
        itemCode: i.item_code,
        description: i.description,
        unit: i.unit,
        baseRate: Number(i.base_rate),
        stockQty: Number(i.stock_qty),
        reorderLevel: Number(i.reorder_level),
        lastUpdated: new Date(i.last_updated),
        notes: i.notes,
      })));
      counts.inventory = inventoryRes.data.length;
    }

    if (partiesRes.data && partiesRes.data.length > 0) {
      await db.parties.clear();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.parties.bulkAdd(partiesRes.data.map((p: any) => ({
        id: p.id,
        partyType: p.party_type,
        name: p.name,
        phone: p.phone,
        address: p.address,
        email: p.email,
        tpn: p.tpn,
        licenseNo: p.license_no,
        gstNo: p.gst_no,
        openingBalance: Number(p.opening_balance),
        outstandingBalance: Number(p.outstanding_balance),
        notes: p.notes,
        createdAt: new Date(p.created_at),
        updatedAt: new Date(p.updated_at),
      })));
      counts.parties = partiesRes.data.length;
    }

    if (expensesRes.data && expensesRes.data.length > 0) {
      await db.expenses.clear();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.expenses.bulkAdd(expensesRes.data.map((e: any) => ({
        id: e.id,
        date: new Date(e.date),
        category: e.category,
        description: e.description,
        amount: Number(e.amount),
        reference: e.reference,
        notes: e.notes,
      })));
      counts.expenses = expensesRes.data.length;
    }

    if (paymentsRes.data && paymentsRes.data.length > 0) {
      await db.payments.clear();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.payments.bulkAdd(paymentsRes.data.map((p: any) => ({
        id: p.id,
        partyId: p.party_id,
        timestamp: new Date(p.timestamp),
        amount: Number(p.amount),
        direction: p.direction,
        mode: p.mode,
        reference: p.reference,
        notes: p.notes,
      })));
      counts.payments = paymentsRes.data.length;
    }
  });

  return { counts };
}

export async function getCloudRecordCounts(): Promise<Record<string, number> | null> {
  try {
    const results = await Promise.all([
      supabase.from('accounting_sales').select('id', { count: 'exact', head: true }),
      supabase.from('accounting_purchases').select('id', { count: 'exact', head: true }),
      supabase.from('accounting_inventory').select('id', { count: 'exact', head: true }),
    ]);
    if (results.some(r => r.error)) return null;
    return {
      sales: results[0].count ?? 0,
      purchases: results[1].count ?? 0,
      inventory: results[2].count ?? 0,
    };
  } catch {
    return null;
  }
}
