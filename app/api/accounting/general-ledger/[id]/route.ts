import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { GLEntry, GLAccountType, GLTransactionType } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

function toRecord(row: Record<string, unknown>): GLEntry & { id: number } {
  return {
    id: Number(row.id),
    timestamp: new Date(row.entry_at as string),
    transactionRef: row.transaction_ref as string,
    transactionType: row.transaction_type as GLTransactionType,
    account: row.account as string,
    accountType: row.account_type as GLAccountType,
    debit: Number(row.debit),
    credit: Number(row.credit),
    description: row.description as string,
  };
}

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase.from('accounting_general_ledger').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(toRecord(data));
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const body: Partial<GLEntry> = await request.json();
  const update: Record<string, unknown> = {};
  if (body.timestamp != null) update.entry_at = new Date(body.timestamp).toISOString();
  if (body.transactionRef != null) update.transaction_ref = body.transactionRef;
  if (body.transactionType != null) update.transaction_type = body.transactionType;
  if (body.account != null) update.account = body.account;
  if (body.accountType != null) update.account_type = body.accountType;
  if (body.debit != null) update.debit = body.debit;
  if (body.credit != null) update.credit = body.credit;
  if (body.description != null) update.description = body.description;
  const { data, error } = await supabase.from('accounting_general_ledger').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { error } = await supabase.from('accounting_general_ledger').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
