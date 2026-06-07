import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { InventoryItem, UnitType } from '@/lib/accounting-db';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase.from('accounting_inventory').select('*').order('description');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map(toRecord));
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const body: Omit<InventoryItem, 'id'> = await request.json();
  const { data, error } = await supabase
    .from('accounting_inventory')
    .insert({
      item_code: body.itemCode ?? null,
      description: body.description,
      unit: body.unit,
      base_rate: body.baseRate,
      stock_qty: body.stockQty,
      reorder_level: body.reorderLevel,
      last_updated: new Date().toISOString(),
      notes: body.notes ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toRecord(data), { status: 201 });
}
