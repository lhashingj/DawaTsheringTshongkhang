import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { CreditNote, ReturnItem, ReturnSettlement, SyncStatus } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

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

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase.from('accounting_credit_notes').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(toRecord(data));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { error } = await supabase.from('accounting_credit_notes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
