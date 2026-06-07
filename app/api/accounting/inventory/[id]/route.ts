import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { InventoryItem, UnitType } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

function toRecord(row: Record<string, unknown>): InventoryItem & { id: number } {
  return {
    id: Number(row.id),
    itemCode: (row.item_code as string) ?? undefined,
    description: row.description as string,
    unit: row.unit as UnitType,
    baseRate: Number(row.base_rate),
    stockQty: Number(row.stock_qty),
    reorderLevel: Number(row.reorder_level),
    lastUpdated: new Date(row.last_updated as string),
    notes: (row.notes as string) ?? undefined,
  };
}

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase.from('accounting_inventory').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(toRecord(data));
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const body = await request.json() as Partial<InventoryItem> & { stockDelta?: number };

  // Atomic stock adjustment
  if (body.stockDelta !== undefined) {
    const { data: current, error: fetchErr } = await supabase
      .from('accounting_inventory').select('stock_qty').eq('id', id).single();
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    const newQty = Math.max(0, Number(current.stock_qty) + body.stockDelta);
    const { data, error } = await supabase
      .from('accounting_inventory')
      .update({ stock_qty: newQty, last_updated: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(toRecord(data));
  }

  const update: Record<string, unknown> = { last_updated: new Date().toISOString() };
  if (body.itemCode !== undefined) update.item_code = body.itemCode ?? null;
  if (body.description != null) update.description = body.description;
  if (body.unit != null) update.unit = body.unit;
  if (body.baseRate != null) update.base_rate = body.baseRate;
  if (body.stockQty != null) update.stock_qty = body.stockQty;
  if (body.reorderLevel != null) update.reorder_level = body.reorderLevel;
  if (body.notes !== undefined) update.notes = body.notes ?? null;

  const { data, error } = await supabase.from('accounting_inventory').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data));
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = createServerClient();
  const { error } = await supabase.from('accounting_inventory').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
