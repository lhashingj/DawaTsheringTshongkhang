import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { PurchaseRecord, PurchaseItem, SyncStatus } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

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

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase.from('accounting_purchases').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(toRecord(data));
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const body: Partial<PurchaseRecord> = await request.json();
  const update: Record<string, unknown> = {};
  if (body.supplierName != null) update.supplier_name = body.supplierName;
  if (body.supplierPhone !== undefined) update.supplier_phone = body.supplierPhone ?? null;
  if (body.supplierAddress !== undefined) update.supplier_address = body.supplierAddress ?? null;
  if (body.supplierTPN !== undefined) update.supplier_tpn = body.supplierTPN ?? null;
  if (body.items != null) update.items = body.items;
  if (body.grossAmount != null) update.gross_amount = body.grossAmount;
  if (body.gstRate != null) update.gst_rate = body.gstRate;
  if (body.gstAmount != null) update.gst_amount = body.gstAmount;
  if (body.netAmount != null) update.net_amount = body.netAmount;
  if (body.notes !== undefined) update.notes = body.notes ?? null;
  if (body.syncStatus != null) update.sync_status = body.syncStatus;
  const { data, error } = await supabase.from('accounting_purchases').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { error } = await supabase.from('accounting_purchases').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
