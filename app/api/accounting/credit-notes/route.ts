import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { CreditNote, ReturnItem, ReturnSettlement, SyncStatus } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

function toRecord(row: Record<string, unknown>): CreditNote & { id: number } {
  return {
    id: Number(row.id),
    creditNoteNo: row.credit_note_no as string,
    timestamp: new Date(row.noted_at as string),
    originalInvoiceNo: (row.original_invoice_no as string) ?? undefined,
    partyId: row.party_id != null ? Number(row.party_id) : undefined,
    partyName: row.party_name as string,
    items: row.items as ReturnItem[],
    grossAmount: Number(row.gross_amount),
    gstRate: Number(row.gst_rate),
    gstAmount: Number(row.gst_amount),
    netAmount: Number(row.net_amount),
    settlementType: row.settlement_type as ReturnSettlement,
    notes: (row.notes as string) ?? undefined,
    syncStatus: row.sync_status as SyncStatus,
  };
}

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  if (searchParams.get('next') === '1') {
    const { count } = await supabase
      .from('accounting_credit_notes')
      .select('id', { count: 'exact', head: true });
    return NextResponse.json({ creditNoteNo: `CN-${String((count ?? 0) + 1).padStart(4, '0')}` });
  }

  const { data, error } = await supabase
    .from('accounting_credit_notes')
    .select('*')
    .order('noted_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map(toRecord));
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body: Omit<CreditNote, 'id'> = await request.json();
  const { data, error } = await supabase
    .from('accounting_credit_notes')
    .insert({
      credit_note_no: body.creditNoteNo,
      noted_at: new Date(body.timestamp).toISOString(),
      original_invoice_no: body.originalInvoiceNo ?? null,
      party_id: body.partyId ?? null,
      party_name: body.partyName,
      items: body.items,
      gross_amount: body.grossAmount,
      gst_rate: body.gstRate,
      gst_amount: body.gstAmount,
      net_amount: body.netAmount,
      settlement_type: body.settlementType,
      notes: body.notes ?? null,
      sync_status: body.syncStatus,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data), { status: 201 });
}
