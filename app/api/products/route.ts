import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAllProducts, createProduct } from "@/lib/products";

export async function GET() {
  try {
    const products = await getAllProducts();
    return NextResponse.json(products);
  } catch {
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, category, price, stock, description, unit, sku, featured, image } = body;

    if (!name || !category || price == null || stock == null) {
      return NextResponse.json(
        { error: "name, category, price, and stock are required" },
        { status: 400 }
      );
    }

    const product = await createProduct({
      name,
      category,
      price: Number(price),
      stock: Number(stock),
      description: description ?? "",
      unit: unit ?? "piece",
      sku: sku ?? name.replace(/\s+/g, "-").toUpperCase().slice(0, 20),
      featured: Boolean(featured),
      ...(image && { image }),
    });

    revalidatePath("/");
    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
