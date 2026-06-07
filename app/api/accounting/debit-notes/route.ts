import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { DebitNote, ReturnItem, SyncStatus } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

function toRecord(row: Record<string, unknown>): DebitNote & { id: number } {
  return {
    id: Number(row.id),
    debitNoteNo: row.debit_note_no as string,
    timestamp: new Date(row.noted_at as string),
    originalPONo: (row.original_po_no as string) ?? undefined,
    partyId: row.party_id != null ? Number(row.party_id) : undefined,
    partyName: row.party_name as string,
    items: row.items as ReturnItem[],
    grossAmount: Number(row.gross_amount),
    gstRate: Number(row.gst_rate),
    gstAmount: Number(row.gst_amount),
    netAmount: Number(row.net_amount),
    notes: (row.notes as string) ?? undefined,
    syncStatus: row.sync_status as SyncStatus,
  };
}

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  if (searchParams.get('next') === '1') {
    const { count } = await supabase
      .from('accounting_debit_notes')
      .select('id', { count: 'exact', head: true });
    return NextResponse.json({ debitNoteNo: `DN-${String((count ?? 0) + 1).padStart(4, '0')}` });
  }

  const { data, error } = await supabase
    .from('accounting_debit_notes')
    .select('*')
    .order('noted_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map(toRecord));
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body: Omit<DebitNote, 'id'> = await request.json();
  const { data, error } = await supabase
    .from('accounting_debit_notes')
    .insert({
      debit_note_no: body.debitNoteNo,
      noted_at: new Date(body.timestamp).toISOString(),
      original_po_no: body.originalPONo ?? null,
      party_id: body.partyId ?? null,
      party_name: body.partyName,
      items: body.items,
      gross_amount: body.grossAmount,
      gst_rate: body.gstRate,
      gst_amount: body.gstAmount,
      net_amount: body.netAmount,
      notes: body.notes ?? null,
      sync_status: body.syncStatus,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data), { status: 201 });
}
