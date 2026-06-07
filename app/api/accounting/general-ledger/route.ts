import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { GLEntry, GLAccountType, GLTransactionType } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('accounting_general_ledger')
    .select('*')
    .order('entry_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map(toRecord));
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body = await request.json() as Omit<GLEntry, 'id'> | Omit<GLEntry, 'id'>[];

  const entries = Array.isArray(body) ? body : [body];
  const rows = entries.map(e => ({
    entry_at: new Date(e.timestamp).toISOString(),
    transaction_ref: e.transactionRef,
    transaction_type: e.transactionType,
    account: e.account,
    account_type: e.accountType,
    debit: e.debit,
    credit: e.credit,
    description: e.description,
  }));

  const { data, error } = await supabase
    .from('accounting_general_ledger')
    .insert(rows)
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map(toRecord), { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get('ref');
  const ids = searchParams.get('ids');

  if (ref) {
    const { error } = await supabase
      .from('accounting_general_ledger')
      .delete()
      .eq('transaction_ref', ref);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (ids) {
    const idList = ids.split(',').map(Number).filter(n => !isNaN(n));
    const { error } = await supabase
      .from('accounting_general_ledger')
      .delete()
      .in('id', idList);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Provide ?ref=xxx or ?ids=1,2,3' }, { status: 400 });
}
