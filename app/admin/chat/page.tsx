"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot, User, Send, Loader2, MessageCircle, ArrowLeft,
  Circle, Wifi, WifiOff,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import PusherClient from "pusher-js";

interface Message {
  id: string;
  sender_type: "user" | "admin" | "bot";
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  user_name: string;
  user_email: string;
  status: string;
  updated_at: string;
  messages: Message[];
}

const ADMIN_PASSWORD = "admin123";

export default function AdminChatPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pusherRef = useRef<PusherClient | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("dtt-admin") === "true") setAuthed(true);
  }, []);

  // Load conversations
  useEffect(() => {
    if (!authed) return;
    loadConversations();
    const iv = setInterval(loadConversations, 10000);
    return () => clearInterval(iv);
  }, [authed]);

  async function loadConversations() {
    const res = await fetch("/api/chat/conversations");
    const data = await res.json();
    if (Array.isArray(data)) setConversations(data);
  }

  // Subscribe to selected conversation via Pusher
  useEffect(() => {
    if (!selected) return;
    loadMessages(selected);

    pusherRef.current?.disconnect();
    const pusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
    const channel = pusher.subscribe(`chat-${selected}`);
    channel.bind("new-message", (msg: Message) => {
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    });
    pusherRef.current = pusher;

    return () => pusher.disconnect();
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages(convId: string) {
    const res = await fetch(`/api/chat/messages?conversationId=${convId}`);
    const data = await res.json();
    if (Array.isArray(data)) setMessages(data);
  }

  async function toggleOnline() {
    const next = !isOnline;
    setIsOnline(next);
    await fetch("/api/chat/admin-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_online: next }),
    });
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !selected || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: selected, sender_type: "admin", content: text }),
    });
    setSending(false);
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem("dtt-admin", "true");
      setAuthed(true);
    } else {
      setAuthError("Incorrect password.");
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen industrial-grid-bg flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8"
        >
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-brand-orange mb-6 -mt-2">
            <ArrowLeft className="h-4 w-4" /> Back to Admin
          </Link>
          <p className="font-black text-brand-slate text-lg mb-6">Admin Chat</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setAuthError(""); }} placeholder="Admin password" autoFocus />
            {authError && <p className="text-xs text-red-500">{authError}</p>}
            <Button type="submit" className="w-full">Sign In</Button>
          </form>
        </motion.div>
      </div>
    );
  }

  const selectedConv = conversations.find((c) => c.id === selected);
  const lastMessages = conversations.reduce<Record<string, string>>((acc, c) => {
    const last = c.messages?.[c.messages.length - 1];
    acc[c.id] = last?.content ?? "No messages yet";
    return acc;
  }, {});

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-72 bg-brand-slate flex flex-col shrink-0">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="font-black text-white text-sm">Chat Dashboard</p>
            <Link href="/admin" className="text-white/40 text-xs hover:text-white/70 transition-colors">← Back to Admin</Link>
          </div>
          <button
            onClick={toggleOnline}
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full transition-colors",
              isOnline ? "bg-green-500/20 text-green-400" : "bg-slate-600 text-slate-400"
            )}
          >
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? "Online" : "Offline"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center">
              <MessageCircle className="h-8 w-8 text-white/20 mx-auto mb-2" />
              <p className="text-white/30 text-xs">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelected(conv.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors",
                  selected === conv.id && "bg-white/10"
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <Circle className="h-2 w-2 fill-brand-orange text-brand-orange shrink-0" />
                  <p className="text-white text-sm font-semibold leading-none line-clamp-1">{conv.user_name}</p>
                </div>
                <p className="text-white/40 text-xs line-clamp-1 ml-4">{lastMessages[conv.id]}</p>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-14 w-14 text-slate-200 mx-auto mb-4" />
              <p className="font-bold text-slate-400">Select a conversation</p>
              <p className="text-sm text-slate-300 mt-1">Pick a customer from the left panel</p>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-brand-slate">{selectedConv?.user_name}</p>
                <p className="text-xs text-slate-400">{selectedConv?.user_email}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex gap-2 items-end", msg.sender_type === "admin" ? "flex-row-reverse" : "flex-row")}>
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                    msg.sender_type === "admin" ? "bg-brand-orange" : msg.sender_type === "bot" ? "bg-slate-300" : "bg-brand-slate"
                  )}>
                    {msg.sender_type === "admin" ? <User className="h-3.5 w-3.5 text-white" /> : <Bot className="h-3.5 w-3.5 text-white" />}
                  </div>
                  <div className={cn(
                    "max-w-[65%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.sender_type === "admin"
                      ? "bg-brand-orange text-white rounded-br-sm"
                      : "bg-white text-brand-slate shadow-sm rounded-bl-sm border border-slate-100"
                  )}>
                    {msg.sender_type !== "admin" && (
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 opacity-40">
                        {msg.sender_type === "bot" ? "AI Bot" : "Customer"}
                      </p>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendReply} className="p-4 bg-white border-t border-slate-100 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a reply…"
                className="flex-1"
                disabled={sending}
              />
              <Button type="submit" disabled={!input.trim() || sending} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
