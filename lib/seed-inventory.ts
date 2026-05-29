import { db, inventoryCRUD, UnitType } from './accounting-db';
import productsData from '@/data/db.json';
import { PDF_INVENTORY_DATA, autoUnit, toSKU } from './inventory-bulk-data';

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

  for (const product of productsData.products) {
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

export async function seedInventoryFromBulkData(): Promise<{ added: number; skipped: number }> {
  const existing = await db.inventory.toArray();
  const existingDescs = new Set(
    existing.map(i => i.description.toUpperCase().trim())
  );

  let added = 0;
  let skipped = 0;

  for (const [name, stock] of PDF_INVENTORY_DATA) {
    const key = name.toUpperCase().trim();
    if (existingDescs.has(key)) {
      skipped++;
      continue;
    }

    const sku = toSKU(name);
    await inventoryCRUD.create({
      itemCode: sku,
      description: name,
      unit: autoUnit(name) as UnitType,
      baseRate: 0,
      stockQty: Math.max(0, stock),
      reorderLevel: 5,
      lastUpdated: new Date(),
    });

    existingDescs.add(key);
    added++;
  }

  return { added, skipped };
}
