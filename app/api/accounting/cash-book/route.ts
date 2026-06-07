import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { CashBookEntry, CashBookType, SyncStatus } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

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

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  if (searchParams.get('next') === '1') {
    const { count } = await supabase
      .from('accounting_cash_book')
      .select('id', { count: 'exact', head: true });
    return NextResponse.json({ voucherNo: `CB-${String((count ?? 0) + 1).padStart(4, '0')}` });
  }

  const { data, error } = await supabase
    .from('accounting_cash_book')
    .select('*')
    .order('entry_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map(toRecord));
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body: Omit<CashBookEntry, 'id'> = await request.json();
  const { data, error } = await supabase
    .from('accounting_cash_book')
    .insert({
      voucher_no: body.voucherNo,
      entry_at: new Date(body.timestamp).toISOString(),
      type: body.type,
      party_id: body.partyId ?? null,
      party_name: body.partyName,
      amount: body.amount,
      description: body.description,
      reference: body.reference ?? null,
      sync_status: body.syncStatus,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data), { status: 201 });
}
