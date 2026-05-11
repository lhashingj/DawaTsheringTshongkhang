import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { pusherServer } from "@/lib/pusher-server";
import Anthropic from "@anthropic-ai/sdk";
import { getAllProducts } from "@/lib/products";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET: load messages for a conversation
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: send a message (user or admin)
export async function POST(req: Request) {
  const { conversation_id, sender_type, content } = await req.json();
  const db = supabaseAdmin();

  // Save message
  const { data: msg, error } = await db
    .from("messages")
    .insert({ conversation_id, sender_type, content })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update conversation timestamp
  await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversation_id);

  // Broadcast via Pusher
  await pusherServer.trigger(`chat-${conversation_id}`, "new-message", msg);

  // If user sent the message, check if admin is online and trigger bot if not
  if (sender_type === "user") {
    const { data: status } = await db.from("admin_status").select("is_online").eq("id", 1).single();
    const adminOnline = status?.is_online ?? false;

    if (!adminOnline) {
      // Trigger bot response async (don't await to keep response fast)
      triggerBotResponse(conversation_id, content, db).catch(console.error);
    }
  }

  return NextResponse.json(msg);
}

async function triggerBotResponse(conversationId: string, userMessage: string, db: ReturnType<typeof supabaseAdmin>) {
  // Get recent messages for context
  const { data: history } = await db
    .from("messages")
    .select("sender_type, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);

  // Build product context
  const products = getAllProducts();
  const productSummary = products
    .slice(0, 30)
    .map((p: { name: string; category: string; price: number; stock: number }) => `${p.name} (${p.category}) - Nu.${p.price} - Stock: ${p.stock}`)
    .join("\n");

  const messages = (history ?? []).map((m) => ({
    role: m.sender_type === "user" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: `You are a helpful assistant for DTT Hardware (Dawa Tshering Tshongkhang), a hardware and tools shop in Paro, Bhutan.
You help customers with product inquiries, prices, stock availability, and general questions.
Be friendly, concise, and helpful. Answer in 1-3 sentences.
Phone: 17716895 / 17711469. Location: Nyamaizampa, Paro, Bhutan.

Available products (sample):
${productSummary}`,
    messages,
  });

  const botContent = response.content[0].type === "text" ? response.content[0].text : "Thank you for your message. Our team will get back to you soon.";

  const { data: botMsg } = await db
    .from("messages")
    .insert({ conversation_id: conversationId, sender_type: "bot", content: botContent })
    .select()
    .single();

  if (botMsg) {
    await pusherServer.trigger(`chat-${conversationId}`, "new-message", botMsg);
  }
}
