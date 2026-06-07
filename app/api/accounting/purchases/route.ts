import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { PurchaseRecord, PurchaseItem, SyncStatus } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

function toRecord(row: Record<string, unknown>): PurchaseRecord & { id: number } {
  return {
    id: Number(row.id),
    purchaseOrderNo: row.purchase_order_no as string,
    timestamp: new Date(row.purchased_at as string),
    supplierName: row.supplier_name as string,
    supplierPhone: (row.supplier_phone as string) ?? undefined,
    supplierAddress: (row.supplier_address as string) ?? undefined,
    supplierTPN: (row.supplier_tpn as string) ?? undefined,
    items: row.items as PurchaseItem[],
    grossAmount: Number(row.gross_amount),
    gstRate: Number(row.gst_rate),
    gstAmount: Number(row.gst_amount),
    netAmount: Number(row.net_amount),
    syncStatus: row.sync_status as SyncStatus,
    notes: (row.notes as string) ?? undefined,
  };
}

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  if (searchParams.get('next') === '1') {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `PO-${year}-`;
    const { data } = await supabase
      .from('accounting_purchases')
      .select('purchase_order_no')
      .like('purchase_order_no', `${prefix}%`)
      .order('purchase_order_no', { ascending: false })
      .limit(1);
    let next = 1;
    if (data && data.length > 0) {
      const last = data[0].purchase_order_no as string;
      const num = parseInt(last.replace(prefix, ''), 10);
      if (!isNaN(num)) next = num + 1;
    }
    return NextResponse.json({ purchaseOrderNo: `${prefix}${String(next).padStart(4, '0')}` });
  }

  const { data, error } = await supabase
    .from('accounting_purchases')
    .select('*')
    .order('purchased_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map(toRecord));
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body: Omit<PurchaseRecord, 'id'> = await request.json();
  const { data, error } = await supabase
    .from('accounting_purchases')
    .insert({
      purchase_order_no: body.purchaseOrderNo,
      purchased_at: new Date(body.timestamp).toISOString(),
      supplier_name: body.supplierName,
      supplier_phone: body.supplierPhone ?? null,
      supplier_address: body.supplierAddress ?? null,
      supplier_tpn: body.supplierTPN ?? null,
      items: body.items,
      gross_amount: body.grossAmount,
      gst_rate: body.gstRate,
      gst_amount: body.gstAmount,
      net_amount: body.netAmount,
      sync_status: body.syncStatus,
      notes: body.notes ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data), { status: 201 });
}
