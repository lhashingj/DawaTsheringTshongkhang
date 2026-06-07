import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { CashBookEntry, CashBookType, SyncStatus } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

function toRecord(row: Record<string, unknown>): CashBookEntry & { id: number } {
  return {
    id: Number(row.id),
    voucherNo: row.voucher_no as string,
    timestamp: new Date(row.entry_at as string),
    type: row.type as CashBookType,
    partyId: row.party_id != null ? Number(row.party_id) : undefined,
    partyName: row.party_name as string,
    amount: Number(row.amount),
    description: row.description as string,
    reference: (row.reference as string) ?? undefined,
    syncStatus: row.sync_status as SyncStatus,
  };
}

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase.from('accounting_cash_book').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(toRecord(data));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { error } = await supabase.from('accounting_cash_book').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
