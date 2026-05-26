import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getProductById, updateProduct, deleteProduct } from "@/lib/products";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (err) {
    console.error("[GET /api/products/:id]", err);
    return NextResponse.json({ error: "Failed to get product" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = await updateProduct(id, {
      ...body,
      ...(body.price != null && { price: Number(body.price) }),
      ...(body.stock != null && { stock: Number(body.stock) }),
    });
    if (!updated) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    revalidatePath("/");
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PUT /api/products/:id]", err);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const deleted = await deleteProduct(id);
    if (!deleted) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    revalidatePath("/");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/products/:id]", err);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
