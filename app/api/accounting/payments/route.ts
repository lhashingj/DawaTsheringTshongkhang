import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { PaymentRecord, PaymentDirection, PaymentMode } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

function toRecord(row: Record<string, unknown>): PaymentRecord & { id: number } {
  return {
    id: Number(row.id),
    partyId: Number(row.party_id),
    timestamp: new Date(row.paid_at as string),
    amount: Number(row.amount),
    direction: row.direction as PaymentDirection,
    mode: row.mode as PaymentMode,
    reference: (row.reference as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
  };
}

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const partyId = searchParams.get('partyId');
  let query = supabase.from('accounting_payments').select('*').order('paid_at', { ascending: false });
  if (partyId) query = query.eq('party_id', partyId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map(toRecord));
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body: Omit<PaymentRecord, 'id'> = await request.json();
  const { data, error } = await supabase
    .from('accounting_payments')
    .insert({
      party_id: body.partyId,
      paid_at: new Date(body.timestamp).toISOString(),
      amount: body.amount,
      direction: body.direction,
      mode: body.mode,
      reference: body.reference ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data), { status: 201 });
}
