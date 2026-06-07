import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { ExpenseRecord, ExpenseCategory } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

function toRecord(row: Record<string, unknown>): ExpenseRecord & { id: number } {
  return {
    id: Number(row.id),
    date: new Date(row.expense_date as string),
    category: row.category as ExpenseCategory,
    description: row.description as string,
    amount: Number(row.amount),
    inputTaxRate: row.input_tax_rate != null ? Number(row.input_tax_rate) : undefined,
    inputTaxAmount: row.input_tax_amount != null ? Number(row.input_tax_amount) : undefined,
    reference: (row.reference as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
  };
}

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase.from('accounting_expenses').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(toRecord(data));
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const body: Partial<ExpenseRecord> = await request.json();
  const update: Record<string, unknown> = {};
  if (body.date != null) update.expense_date = new Date(body.date).toISOString().split('T')[0];
  if (body.category != null) update.category = body.category;
  if (body.description != null) update.description = body.description;
  if (body.amount != null) update.amount = body.amount;
  if (body.inputTaxRate !== undefined) update.input_tax_rate = body.inputTaxRate ?? null;
  if (body.inputTaxAmount !== undefined) update.input_tax_amount = body.inputTaxAmount ?? null;
  if (body.reference !== undefined) update.reference = body.reference ?? null;
  if (body.notes !== undefined) update.notes = body.notes ?? null;
  const { data, error } = await supabase.from('accounting_expenses').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { error } = await supabase.from('accounting_expenses').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
