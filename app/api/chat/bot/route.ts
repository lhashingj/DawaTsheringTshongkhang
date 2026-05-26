import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
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
}

interface HistoryMsg {
  senderType: "user" | "bot";
  content: string;
}

function loadProducts(): Product[] {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", "db.json"), "utf8");
    return JSON.parse(raw).products ?? [];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  const { message, history = [] } = await req.json() as { message: string; history: HistoryMsg[] };
  const reply = await getBotReply(message, history);
  return NextResponse.json({ reply });
}

async function getBotReply(userMessage: string, history: HistoryMsg[]): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key && key !== "your_anthropic_api_key" && key.startsWith("sk-ant-")) {
    try {
      return await getClaudeReply(userMessage, history);
    } catch (err) {
      console.error("[bot] Claude error, falling back:", err);
    }
  }
  return getRegexReply(userMessage);
}

async function getClaudeReply(userMessage: string, history: HistoryMsg[]): Promise<string> {
  const products = loadProducts();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const productList = products
    .map((p) => `${p.name} | ${p.category} | Nu.${p.price}/${p.unit} | ${p.stock > 0 ? `${p.stock} in stock` : "OUT OF STOCK"}`)
    .join("\n");

  const systemPrompt = `You are Dawa, the virtual assistant for DTT Hardware (Dawa Tshering Tshongkhang) in Paro, Bhutan.

STORE INFO:
- Location: Nyamaizampa, Paro, Bhutan
- Phone: 17716895 / 17711469
- Hours: Monday–Saturday, 9am–6pm
- Services: Hardware, tools, construction materials, agricultural machinery, local delivery within Paro

PRODUCT CATALOG (Name | Category | Price | Stock):
${productList}

RULES:
- Be friendly, concise, and helpful
- Use Nu. for Bhutanese Ngultrum
- For product queries: give name, price, stock status
- All prices are exclusive of 5% GST
- To place an ORDER or need a human, end reply with: __ESCALATE__
- Do NOT add __ESCALATE__ unless recommending admin contact
- When asked about location, address, map, directions, or how to find the store, end your reply with: __MAP__
- Do NOT add __MAP__ unless the user is asking about location/directions
- Keep under 160 words`;

  const recent = history.slice(-12);
  const claudeMessages: { role: "user" | "assistant"; content: string }[] = [];
  for (const msg of recent) {
    if (msg.senderType === "user") {
      claudeMessages.push({ role: "user", content: msg.content });
    } else {
      claudeMessages.push({
        role: "assistant",
        content: msg.content.replace(/\n?__ESCALATE__\s*$/, "").replace(/\n?__MAP__\s*$/, "").trimEnd(),
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

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  return text || "I'm having trouble right now. Please call 17716895 for assistance.";
}

function getRegexReply(message: string): string {
  const m = message.toLowerCase().trim();
  const products = loadProducts();

  if (/^(hello|hi|hey|good morning|good afternoon|howdy)/.test(m) || m === "hi" || m === "hello") {
    return "Hi there! 👋 I'm Dawa, DTT Hardware's virtual assistant.\n\nI can help you with:\n• Product prices and details\n• Stock availability\n• Our location and hours\n• Delivery options\n\nWhat are you looking for today?";
  }
  if (/\bthank(s| you)\b/.test(m)) return "You're welcome! 😊";
  if (/\b(phone|contact|number|call|whatsapp)\b/.test(m)) {
    return "📞 17716895 / 17711469\n📍 Nyamaizampa, Paro, Bhutan\n⏰ Mon–Sat, 9am–6pm";
  }
  if (/\b(location|address|where|hours|open|map|direction|navigate|find us|find the)\b/.test(m)) {
    return "🏪 Nyamaizampa, Paro, Bhutan\n⏰ Mon–Sat: 9am–6pm\nCall 17716895 for directions.\n__MAP__";
  }
  if (/\b(delivery|deliver|transport)\b/.test(m)) {
    return "We offer local delivery within Paro. 🚚 Call 17716895 to arrange.";
  }
  if (/\b(human|agent|admin|order|speak to|talk to)\b/.test(m)) {
    return "Let me connect you with our team. 👤\n📞 17716895 / 17711469\n__ESCALATE__";
  }

  const stopWords = new Set(["a","an","the","is","do","you","have","i","me","for","of","in","on","to","and","or","how","much","what"]);
  const words = m.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !stopWords.has(w));
  if (words.length > 0) {
    const scored = products.map((p) => {
      const n = p.name.toLowerCase(), c = p.category.toLowerCase();
      let s = words.reduce((acc, w) => acc + (n.includes(w) ? 10 : 0) + (c.includes(w) ? 5 : 0), 0);
      if (n.includes(m)) s += 20;
      return { p, s };
    }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);

    if (scored.length === 1) {
      const { p } = scored[0];
      const stock = p.stock > 10 ? `✅ In stock (${p.stock})` : p.stock > 0 ? `⚠️ Low stock (${p.stock})` : "❌ Out of stock";
      return `**${p.name}**\n💰 Nu. ${p.price.toLocaleString()} / ${p.unit} (excl. GST)\n${stock}\nCall 17716895 to order.`;
    }
    if (scored.length > 1 && scored.length <= 6) {
      const top = scored[0].s;
      const list = scored.filter((x) => x.s >= top * 0.4).slice(0, 6)
        .map(({ p }) => `${p.stock > 0 ? "✅" : "❌"} ${p.name} — Nu. ${p.price.toLocaleString()}/${p.unit}`).join("\n");
      return `Matching products:\n${list}\n\nCall 17716895 for details.`;
    }
  }

  return "I couldn't find that. Try:\n• \"price of cement\"\n• \"is the drill in stock?\"\n• \"what tools do you have?\"\n\nOr connect with our team.\n__ESCALATE__";
}
