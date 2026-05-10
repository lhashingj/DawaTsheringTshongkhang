import { NextResponse } from "next/server";
import {
  getProductById,
  updateProduct,
  deleteProduct,
} from "@/lib/products";

interface Params {
  params: { id: string };
}

export async function GET(_: Request, { params }: Params) {
  const product = getProductById(params.id);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json(product);
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const body = await request.json();
    const updated = updateProduct(params.id, {
      ...body,
      ...(body.price != null && { price: Number(body.price) }),
      ...(body.stock != null && { stock: Number(body.stock) }),
    });
    if (!updated) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const deleted = deleteProduct(params.id);
  if (!deleted) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
