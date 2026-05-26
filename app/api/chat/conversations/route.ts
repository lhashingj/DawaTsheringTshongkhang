import { NextResponse } from "next/server";
import { getAllConversations, getOrCreateConversation, hasAdminMessages, findConversation, deleteConversation, addMessage, getMessages } from "@/lib/chat-store";
import { getSessionUser } from "@/lib/auth-store";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const type = searchParams.get("type") as "general" | "order" | null;

  if (userId && type) {
    return NextResponse.json(findConversation(userId, type));
  }

  return NextResponse.json(getAllConversations());
}

export async function POST(req: Request) {
  const { user_id, user_name, user_email, type = "general" } = await req.json();
  const conv = getOrCreateConversation(user_id, user_name, user_email, type);

  // Auto-greet new general conversations
  if ((type ?? "general") === "general" && getMessages(conv.id).length === 0) {
    addMessage(
      conv.id,
      "bot",
      "Hi! I'm Dawa, DTT Hardware's virtual assistant. 👋\n\nI can help you with:\n• Product prices and details\n• Stock availability\n• Our location and hours\n• Delivery options\n\nHow can I assist you today?",
    );
  }

  return NextResponse.json({ ...conv, hasAdminMessages: hasAdminMessages(conv.id) });
}

export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("dtt-session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = getSessionUser(token);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  deleteConversation(id);
  return NextResponse.json({ ok: true });
}
