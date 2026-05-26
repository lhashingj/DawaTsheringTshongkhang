import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getMessages, addMessage, clearConversationMessages, getConversationById } from "@/lib/chat-store";
import type { Message } from "@/lib/chat-store";
import fs from "fs";
import path from "path";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  unit: string;
  sku: string;
}

function loadProducts(): Product[] {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", "db.json"), "utf8");
    return JSON.parse(raw).products ?? [];
  } catch {
    return [];
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  clearConversationMessages(conversationId);
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json([]);
  return NextResponse.json(getMessages(conversationId));
}

export async function POST(req: Request) {
  const { conversation_id, sender_type, content } = await req.json();
  const msg = addMessage(conversation_id, sender_type, content);

  let botReply = null;
  if (sender_type === "user") {
    const conv = getConversationById(conversation_id);
    // Only bot replies for general conversations (not order/admin chats)
    if (!conv || (conv.type ?? "general") === "general") {
      const history = getMessages(conversation_id);
      const replyText = await getBotReply(content, history);
      botReply = addMessage(conversation_id, "bot", replyText);
    }
  }

  return NextResponse.json({ message: msg, botReply });
}

// ─── Bot reply orchestrator ───────────────────────────────────────────────────

async function getBotReply(userMessage: string, history: Message[]): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key && key !== "your_anthropic_api_key" && key.startsWith("sk-ant-")) {
    try {
      return await getClaudeReply(userMessage, history);
    } catch (err) {
      console.error("[chat] Claude API error, falling back to regex:", err);
    }
  }
  return getRegexReply(userMessage);
}

// ─── Claude AI reply (uses conversation history for context) ──────────────────

async function getClaudeReply(userMessage: string, history: Message[]): Promise<string> {
  const products = loadProducts();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const productList = products
    .map(
      (p) =>
        `${p.name} | ${p.category} | Nu.${p.price}/${p.unit} | ${p.stock > 0 ? `${p.stock} in stock` : "OUT OF STOCK"}`,
    )
    .join("\n");

  const systemPrompt = `You are Dawa, the virtual assistant for DTT Hardware (Dawa Tshering Tshongkhang) — a hardware store in Paro, Bhutan.

STORE INFO:
- Name: Dawa Tshering Tshongkhang (DTT Hardware)
- Location: Nyamaizampa, Paro, Bhutan
- Phone: 17716895 / 17711469
- Hours: Monday–Saturday, 9am–6pm
- Services: Hardware, tools, construction materials, agricultural machinery, local delivery within Paro

PRODUCT CATALOG (Name | Category | Price | Stock):
${productList}

RESPONSE RULES:
- Be friendly, helpful, and concise
- Always use Nu. for Bhutanese Ngultrum (currency)
- For product queries: give name, price, stock status, brief description
- For orders or human assistance: end your reply with exactly: __ESCALATE__
- Do NOT add __ESCALATE__ unless you are recommending they contact our staff
- Keep responses under 160 words
- Respond in English`;

  // Pass last 12 messages as context (6 exchanges)
  const recent = history.slice(-12);
  const claudeMessages: { role: "user" | "assistant"; content: string }[] = [];

  for (const msg of recent) {
    if (msg.sender_type === "user") {
      claudeMessages.push({ role: "user", content: msg.content });
    } else if (msg.sender_type === "bot") {
      claudeMessages.push({
        role: "assistant",
        content: msg.content.replace(/\n?__ESCALATE__\s*$/, "").trimEnd(),
      });
    }
  }
  claudeMessages.push({ role: "user", content: userMessage });

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: systemPrompt,
    messages: claudeMessages,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";
  return text || "I'm having trouble right now. Please call 17716895 for assistance.";
}

// ─── Regex fallback (used when no Anthropic API key is configured) ────────────

function getRegexReply(message: string): string {
  const m = message.toLowerCase().trim();
  const products = loadProducts();

  if (
    /^(hello|hi|hey|good morning|good afternoon|good evening|howdy|greetings)/.test(m) ||
    m === "hi" ||
    m === "hello"
  ) {
    return "Hi there! 👋 I'm Dawa, DTT Hardware's virtual assistant.\n\nI can help you with:\n• Product prices and details\n• Stock availability\n• Our location and hours\n• Delivery options\n\nWhat are you looking for today?";
  }

  if (/\bthank(s| you)\b/.test(m)) {
    return "You're welcome! Feel free to ask if you need anything else. 😊";
  }

  if (/\b(phone|contact|number|call|reach|whatsapp)\b/.test(m)) {
    return "You can reach us at:\n📞 17716895\n📞 17711469\n📍 Nyamaizampa, Paro, Bhutan\n⏰ Monday–Saturday, 9am–6pm";
  }

  if (/\b(location|address|where|find you|directions|opening|hours|open|closed|map)\b/.test(m)) {
    return "🏪 Dawa Tshering Tshongkhang\n📍 Nyamaizampa, Paro, Bhutan\n⏰ Monday–Saturday: 9am–6pm\n\n🗺️ View on Google Maps:\nhttps://maps.google.com/?q=Dawa+Tshering+Tshongkhang+Nyamaizampa+Paro+Bhutan\n\nCall us at 17716895 for directions.";
  }

  if (/\b(delivery|shipping|deliver|transport|home.*delivery)\b/.test(m)) {
    return "We offer local delivery within Paro district. 🚚\n\nPlease call 17716895 to arrange delivery and discuss rates based on your location.";
  }

  if (/\b(what.*sell|what.*have|what.*products|categories|catalog|range|types)\b/.test(m)) {
    const cats = [...new Set(products.map((p) => p.category))];
    return `We stock hardware products across these categories:\n${cats.map((c) => `• ${c}`).join("\n")}\n\nAsk me about any specific product or category!`;
  }

  if (
    /\b(human|agent|person|real|manager|owner|admin|speak to someone|talk to someone|connect me)\b/.test(m)
  ) {
    return "Of course! Let me connect you with our team. 👤\n\nYou can also reach us directly:\n📞 17716895 / 17711469\n⏰ Mon–Sat, 9am–6pm\n__ESCALATE__";
  }

  const matched = findProducts(m, products);

  if (matched.length === 1) {
    const p = matched[0];
    const stockStatus =
      p.stock > 10
        ? `✅ In stock (${p.stock} units available)`
        : p.stock > 0
        ? `⚠️ Low stock (${p.stock} left)`
        : "❌ Currently out of stock";
    return `**${p.name}**\n💰 Price: Nu. ${p.price.toLocaleString()} per ${p.unit}\n${stockStatus}\n\n${p.description}\n\nTo order or enquire, call 17716895.`;
  }

  if (matched.length > 1 && matched.length <= 6) {
    const list = matched
      .map((p) => {
        const avail = p.stock > 0 ? "✅" : "❌";
        return `${avail} ${p.name} — Nu. ${p.price.toLocaleString()} / ${p.unit}`;
      })
      .join("\n");
    return `Here are the matching products:\n${list}\n\nAsk me about any specific one for full details, or call 17716895.`;
  }

  if (matched.length > 6) {
    const sample = matched.slice(0, 5);
    const list = sample.map((p) => `• ${p.name} — Nu. ${p.price.toLocaleString()}`).join("\n");
    return `Found ${matched.length} matching products. Here are a few:\n${list}\n\nTry a more specific name, or visit our shop / call 17716895 for the full catalog.`;
  }

  if (/\b(price|cost|how much|rate|nu\.|ngultrum)\b/.test(m)) {
    return "Please tell me the specific product you're looking for and I'll give you the exact price! 💰\n\nFor example: \"price of axe\" or \"how much is the chainsaw\"";
  }

  if (/\b(stock|available|in stock|do you have|availability)\b/.test(m)) {
    return "Please tell me which product you'd like to check — I can look up current availability for you! 📦";
  }

  return "I'm sorry, I couldn't find an answer to that. 😔\n\nHere's what I can help with:\n• Product prices — e.g. \"price of cement\"\n• Stock availability — e.g. \"is the drill in stock?\"\n• Product categories — e.g. \"what tools do you have?\"\n• Store location & hours\n\nOr I can connect you directly with our team.\n__ESCALATE__";
}

function findProducts(query: string, products: Product[]): Product[] {
  const stopWords = new Set([
    "a", "an", "the", "is", "do", "you", "have", "i", "me", "for", "of", "in",
    "on", "at", "to", "and", "or", "how", "much", "what", "your",
  ]);
  const words = query
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w));

  if (words.length === 0) return [];

  const scored: { product: Product; score: number }[] = [];

  for (const product of products) {
    const nameLower = product.name.toLowerCase();
    const categoryLower = product.category.toLowerCase();
    const descLower = product.description.toLowerCase();
    let score = 0;

    for (const word of words) {
      if (nameLower.includes(word)) score += 10;
      if (categoryLower.includes(word)) score += 5;
      if (descLower.includes(word)) score += 2;
    }

    if (nameLower.includes(query)) score += 20;
    if (score > 0) scored.push({ product, score });
  }

  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) return [];
  const topScore = scored[0].score;
  return scored.filter((s) => s.score >= topScore * 0.4).map((s) => s.product);
}
