import { readFileSync } from "fs";
import path from "path";
import { unstable_noStore as noStore } from "next/cache";
import { createServerClient } from "./supabase-server";
import type { Database, Product } from "@/types";

function readDbJson(): Database {
  const raw = readFileSync(path.join(process.cwd(), "data", "db.json"), "utf-8");
  return JSON.parse(raw) as Database;
}

function isSupabaseConfigured(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(key && key !== "placeholder");
}

async function autoSeed(supabase: ReturnType<typeof createServerClient>, products: Product[]) {
  for (let i = 0; i < products.length; i += 50) {
    await supabase.from("products").upsert(products.slice(i, i + 50), { onConflict: "id" });
  }
}

export async function getAllProducts(): Promise<Product[]> {
  noStore();
  if (!isSupabaseConfigured()) return readDbJson().products;
  const supabase = createServerClient();
  const { data, error } = await supabase.from("products").select("*").order("name");
  // table doesn't exist yet → fall back so UI still shows products
  if (error) return readDbJson().products;
  // table is empty → seed it now so delete/update work immediately
  if (!data || data.length === 0) {
    const local = readDbJson().products;
    await autoSeed(supabase, local);
    return local;
  }
  return data as Product[];
}

export async function getProductById(id: string): Promise<Product | undefined> {
  if (!isSupabaseConfigured()) return readDbJson().products.find((p) => p.id === id);
  const supabase = createServerClient();
  const { data } = await supabase.from("products").select("*").eq("id", id).single();
  return data as Product | undefined;
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  if (!isSupabaseConfigured()) return readDbJson().products.filter((p) => p.featured).slice(0, limit);
  const supabase = createServerClient();
  const { data } = await supabase.from("products").select("*").eq("featured", true).limit(limit);
  return (data ?? []) as Product[];
}

export async function createProduct(data: Omit<Product, "id">): Promise<Product> {
  const supabase = createServerClient();
  const id = String(Date.now());
  const product: Product = { id, ...data };
  const { data: inserted, error } = await supabase
    .from("products")
    .insert(product)
    .select()
    .single();
  if (error) throw error;
  return inserted as Product;
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<Product, "id">>
): Promise<Product | null> {
  const supabase = createServerClient();
  const { data: updated, error } = await supabase
    .from("products")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error || !updated) return null;
  return updated as Product;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const supabase = createServerClient();
  const { error, count } = await supabase
    .from("products")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw error;
  return (count ?? 0) > 0;
}
