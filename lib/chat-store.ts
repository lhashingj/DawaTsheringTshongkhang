import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface Conversation {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  status: "open" | "closed";
  type: "general" | "order";
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: "user" | "admin" | "bot";
  content: string;
  created_at: string;
}

export interface CartNotification {
  id: string;
  user_name: string;
  user_email: string;
  product_name: string;
  product_price: number;
  conversation_id: string;
  created_at: string;
  seen: boolean;
}

interface ChatData {
  conversations: Conversation[];
  messages: Message[];
  admin_online: boolean;
  notifications: CartNotification[];
}

const CHAT_FILE = path.join(process.cwd(), "data", "chat-data.json");

function read(): ChatData {
  try {
    const data = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
    if (!data.notifications) data.notifications = [];
    return data;
  } catch {
    return { conversations: [], messages: [], admin_online: false, notifications: [] };
  }
}

function write(data: ChatData): void {
  try {
    fs.writeFileSync(CHAT_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("[chat-store] write failed:", e);
  }
}

export function getOrCreateConversation(
  userId: string,
  userName: string,
  userEmail: string,
  type: "general" | "order" = "general",
): Conversation {
  const data = read();
  const existing = data.conversations.find(
    (c) => c.user_id === userId && c.status === "open" && (c.type ?? "general") === type,
  );
  if (existing) return existing;
  const conv: Conversation = {
    id: crypto.randomUUID(),
    user_id: userId,
    user_name: userName,
    user_email: userEmail,
    status: "open",
    type,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  data.conversations.push(conv);
  write(data);
  return conv;
}

export function findConversation(userId: string, type: "general" | "order"): Conversation | null {
  const data = read();
  return (
    data.conversations.find(
      (c) => c.user_id === userId && c.status === "open" && (c.type ?? "general") === type,
    ) ?? null
  );
}

export function getConversationById(id: string): Conversation | undefined {
  return read().conversations.find((c) => c.id === id);
}

export function deleteConversation(id: string): void {
  const data = read();
  data.conversations = data.conversations.filter((c) => c.id !== id);
  data.messages = data.messages.filter((m) => m.conversation_id !== id);
  data.notifications = data.notifications.filter((n) => n.conversation_id !== id);
  write(data);
}

export function hasAdminMessages(conversationId: string): boolean {
  const data = read();
  return data.messages.some(
    (m) => m.conversation_id === conversationId && m.sender_type === "admin",
  );
}

export function getMessages(conversationId: string): Message[] {
  const data = read();
  return data.messages
    .filter((m) => m.conversation_id === conversationId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function addMessage(
  conversationId: string,
  senderType: Message["sender_type"],
  content: string,
): Message {
  const data = read();
  const msg: Message = {
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    sender_type: senderType,
    content,
    created_at: new Date().toISOString(),
  };
  data.messages.push(msg);
  const conv = data.conversations.find((c) => c.id === conversationId);
  if (conv) conv.updated_at = new Date().toISOString();
  write(data);
  return msg;
}

export function clearConversationMessages(conversationId: string): void {
  const data = read();
  data.messages = data.messages.filter((m) => m.conversation_id !== conversationId);
  const conv = data.conversations.find((c) => c.id === conversationId);
  if (conv) conv.updated_at = new Date().toISOString();
  write(data);
}

export function getAllConversations(): (Conversation & { messages: Message[] })[] {
  const data = read();
  return data.conversations
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map((conv) => ({
      ...conv,
      messages: data.messages.filter((m) => m.conversation_id === conv.id),
    }));
}

export function getAdminOnline(): boolean {
  return read().admin_online;
}

export function setAdminOnline(online: boolean): void {
  const data = read();
  data.admin_online = online;
  write(data);
}

export function addCartNotification(
  userName: string,
  userEmail: string,
  productName: string,
  productPrice: number,
  conversationId: string,
): void {
  const data = read();
  data.notifications.push({
    id: crypto.randomUUID(),
    user_name: userName,
    user_email: userEmail,
    product_name: productName,
    product_price: productPrice,
    conversation_id: conversationId,
    created_at: new Date().toISOString(),
    seen: false,
  });
  write(data);
}

export function getUnseenNotifications(): CartNotification[] {
  return read().notifications
    .filter((n) => !n.seen)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function markNotificationsSeen(conversationId?: string): void {
  const data = read();
  data.notifications = data.notifications.map((n) =>
    conversationId === undefined || n.conversation_id === conversationId
      ? { ...n, seen: true }
      : n,
  );
  write(data);
}
