import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { SaleRecord, SaleItem, SyncStatus } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

function toRecord(row: Record<string, unknown>): SaleRecord & { id: number } {
  return {
    id: Number(row.id),
    invoiceNo: row.invoice_no as string,
    timestamp: new Date(row.sale_at as string),
    customerName: row.customer_name as string,
    customerPhone: (row.customer_phone as string) ?? undefined,
    customerAddress: (row.customer_address as string) ?? undefined,
    customerTPN: (row.customer_tpn as string) ?? undefined,
    items: row.items as SaleItem[],
    grossAmount: Number(row.gross_amount),
    gstRate: Number(row.gst_rate),
    gstAmount: Number(row.gst_amount),
    netAmount: Number(row.net_amount),
    syncStatus: row.sync_status as SyncStatus,
    notes: (row.notes as string) ?? undefined,
  };
}

// GET /api/accounting/sales/[id]
export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('accounting_sales')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(toRecord(data));
}

// PUT /api/accounting/sales/[id]
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const body: Partial<SaleRecord> = await request.json();

  const update: Record<string, unknown> = {};
  if (body.customerName != null) update.customer_name = body.customerName;
  if (body.customerPhone !== undefined) update.customer_phone = body.customerPhone ?? null;
  if (body.customerAddress !== undefined) update.customer_address = body.customerAddress ?? null;
  if (body.customerTPN !== undefined) update.customer_tpn = body.customerTPN ?? null;
  if (body.items != null) update.items = body.items;
  if (body.grossAmount != null) update.gross_amount = body.grossAmount;
  if (body.gstRate != null) update.gst_rate = body.gstRate;
  if (body.gstAmount != null) update.gst_amount = body.gstAmount;
  if (body.netAmount != null) update.net_amount = body.netAmount;
  if (body.notes !== undefined) update.notes = body.notes ?? null;
  if (body.syncStatus != null) update.sync_status = body.syncStatus;

  const { data, error } = await supabase
    .from('accounting_sales')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data));
}

// DELETE /api/accounting/sales/[id]
export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { error } = await supabase
    .from('accounting_sales')
    .delete()
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
