import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { PaymentRecord, PaymentDirection, PaymentMode } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

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

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase.from('accounting_payments').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(toRecord(data));
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const body: Partial<PaymentRecord> = await request.json();
  const update: Record<string, unknown> = {};
  if (body.partyId != null) update.party_id = body.partyId;
  if (body.timestamp != null) update.paid_at = new Date(body.timestamp).toISOString();
  if (body.amount != null) update.amount = body.amount;
  if (body.direction != null) update.direction = body.direction;
  if (body.mode != null) update.mode = body.mode;
  if (body.reference !== undefined) update.reference = body.reference ?? null;
  if (body.notes !== undefined) update.notes = body.notes ?? null;
  const { data, error } = await supabase.from('accounting_payments').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { error } = await supabase.from('accounting_payments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
