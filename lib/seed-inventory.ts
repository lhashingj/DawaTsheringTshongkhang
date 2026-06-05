import { db, inventoryCRUD, UnitType } from './accounting-db';

function mapUnit(unit: string): UnitType {
  switch (unit.toLowerCase()) {
    case 'set': return 'SET';
    case 'metre':
    case 'meter': return 'MTR';
    case 'litre':
    case 'liter': return 'LTR';
    case 'kg':
    case 'kilogram': return 'KG';
    default: return 'EACH';
  }
}

export async function seedInventoryFromProducts(): Promise<{ added: number; skipped: number }> {
  const existing = await db.inventory.toArray();
  const existingCodes = new Set(existing.map(i => i.itemCode).filter(Boolean) as string[]);

  let added = 0;
  let skipped = 0;

  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Failed to fetch products');
  const products: Array<{ sku: string; name: string; unit: string; price: number; stock: number; category: string }> = await res.json();

  for (const product of products) {
    if (existingCodes.has(product.sku)) {
      skipped++;
      continue;
    }

    await inventoryCRUD.create({
      itemCode: product.sku,
      description: product.name,
      unit: mapUnit(product.unit),
      baseRate: product.price,
      stockQty: product.stock,
      reorderLevel: 5,
      lastUpdated: new Date(),
      notes: product.category,
    });

    existingCodes.add(product.sku);
    added++;
  }

  return { added, skipped };
}
