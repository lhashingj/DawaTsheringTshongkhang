import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDF_INVENTORY_DATA, autoCategory, autoUnit, toSKU } from '@/lib/inventory-bulk-data';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    // Fetch existing products to avoid duplicates and find max ID
    const { data: existing } = await supabase.from('products').select('id, name');
    const existingNames = new Set(
      (existing ?? []).map((p: { name: string }) => p.name.toUpperCase().trim())
    );

    // Determine next available numeric ID
    let nextId = 1;
    if (existing && existing.length > 0) {
      const maxId = Math.max(...existing.map((p: { id: string | number }) => Number(p.id) || 0));
      nextId = maxId + 1;
    }

    const toInsert: object[] = [];
    let skuCounter = nextId;

    for (const [name, stock] of PDF_INVENTORY_DATA) {
      if (existingNames.has(name.toUpperCase().trim())) continue;
      toInsert.push({
        id: String(nextId++),
        name,
        category: autoCategory(name),
        price: 0,
        stock: Math.max(0, stock),
        description: name,
        featured: false,
        unit: autoUnit(name).toLowerCase().replace('each', 'piece').replace('mtr', 'metre').replace('ltr', 'litre'),
        sku: toSKU(name) + '-' + (skuCounter++).toString(36).slice(-4).toUpperCase(),
      });
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ added: 0, message: 'All items already exist.' });
    }

    // Insert in batches of 100
    let added = 0;
    for (let i = 0; i < toInsert.length; i += 100) {
      const batch = toInsert.slice(i, i + 100);
      const { error } = await supabase.from('products').insert(batch);
      if (error) throw error;
      added += batch.length;
    }

    return NextResponse.json({ added, total: PDF_INVENTORY_DATA.length });
  } catch (err: unknown) {
    const msg = (err as { message?: string }).message ?? 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
