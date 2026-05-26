import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-store";
import { getOrCreateConversation, addMessage, addCartNotification } from "@/lib/chat-store";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("dtt-session")?.value;
  if (!token) return NextResponse.json({ ok: false });

  const user = getSessionUser(token);
  if (!user) return NextResponse.json({ ok: false });

  const { product_name, product_price } = await req.json();
  const conv = getOrCreateConversation(user.id, user.name, user.email);

  addMessage(conv.id, "user", `🛒 Order enquiry: ${product_name} — Nu. ${Number(product_price).toLocaleString()}`);
  addCartNotification(user.name, user.email, product_name, Number(product_price), conv.id);

  return NextResponse.json({ ok: true });
}
