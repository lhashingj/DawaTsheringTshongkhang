import { readFileSync, writeFileSync } from "fs";
import path from "path";
import type { Database, Product } from "@/types";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

export function readDatabase(): Database {
  const raw = readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw) as Database;
}

export function writeDatabase(db: Database): void {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export function getAllProducts(): Product[] {
  return readDatabase().products;
}

export function getProductById(id: string): Product | undefined {
  return readDatabase().products.find((p) => p.id === id);
}

export function getFeaturedProducts(limit = 8): Product[] {
  return readDatabase().products.filter((p) => p.featured).slice(0, limit);
}

export function createProduct(data: Omit<Product, "id">): Product {
  const db = readDatabase();
  const id = String(Date.now());
  const product: Product = { id, ...data };
  db.products.push(product);
  writeDatabase(db);
  return product;
}

export function updateProduct(
  id: string,
  data: Partial<Omit<Product, "id">>
): Product | null {
  const db = readDatabase();
  const index = db.products.findIndex((p) => p.id === id);
  if (index === -1) return null;
  db.products[index] = { ...db.products[index], ...data };
  writeDatabase(db);
  return db.products[index];
}

export function deleteProduct(id: string): boolean {
  const db = readDatabase();
  const before = db.products.length;
  db.products = db.products.filter((p) => p.id !== id);
  if (db.products.length === before) return false;
  writeDatabase(db);
  return true;
}
