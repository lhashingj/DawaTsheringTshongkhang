import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { SaleRecord, SaleItem, SyncStatus } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

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

// GET /api/accounting/sales          → all sales, ordered newest first
// GET /api/accounting/sales?next=1   → next invoice number
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const supabase = createServerClient();

  if (searchParams.get('next') === '1') {
    const year = String(new Date().getFullYear()).slice(-2);
    const prefix = `${year}-`;
    const { data } = await supabase
      .from('accounting_sales')
      .select('invoice_no')
      .like('invoice_no', `${prefix}%`)
      .order('invoice_no', { ascending: false })
      .limit(1);
    const maxNo = data?.[0]?.invoice_no
      ? parseInt((data[0].invoice_no as string).split('-')[1], 10)
      : 0;
    const invoiceNo = `${prefix}${String(maxNo + 1).padStart(4, '0')}`;
    return NextResponse.json({ invoiceNo });
  }

  const { data, error } = await supabase
    .from('accounting_sales')
    .select('*')
    .order('sale_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(toRecord));
}

// POST /api/accounting/sales → create a new sale
export async function POST(request: Request) {
  const supabase = createServerClient();
  const body: Omit<SaleRecord, 'id'> = await request.json();

  const { data, error } = await supabase
    .from('accounting_sales')
    .insert({
      invoice_no: body.invoiceNo,
      sale_at: new Date(body.timestamp).toISOString(),
      customer_name: body.customerName,
      customer_phone: body.customerPhone ?? null,
      customer_address: body.customerAddress ?? null,
      customer_tpn: body.customerTPN ?? null,
      items: body.items,
      gross_amount: body.grossAmount,
      gst_rate: body.gstRate,
      gst_amount: body.gstAmount,
      net_amount: body.netAmount,
      sync_status: 'synced',
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data!), { status: 201 });
}
