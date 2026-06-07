import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { ExpenseRecord, ExpenseCategory } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('accounting_expenses')
    .select('*')
    .order('expense_date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map(toRecord));
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body: Omit<ExpenseRecord, 'id'> = await request.json();
  const { data, error } = await supabase
    .from('accounting_expenses')
    .insert({
      expense_date: new Date(body.date).toISOString().split('T')[0],
      category: body.category,
      description: body.description,
      amount: body.amount,
      input_tax_rate: body.inputTaxRate ?? null,
      input_tax_amount: body.inputTaxAmount ?? null,
      reference: body.reference ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data), { status: 201 });
}
