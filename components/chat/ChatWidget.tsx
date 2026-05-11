"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MessageCircle, X, Send, Bot, User, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import Link from "next/link";
import PusherClient from "pusher-js";

interface Message {
  id: string;
  sender_type: "user" | "admin" | "bot";
  content: string;
  created_at: string;
}

export function ChatWidget() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [adminOnline, setAdminOnline] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pusherRef = useRef<PusherClient | null>(null);

  // Check admin status
  useEffect(() => {
    fetch("/api/chat/admin-status")
      .then((r) => r.json())
      .then((d) => setAdminOnline(d.is_online));
  }, [open]);

  // Init conversation when opened and user is logged in
  useEffect(() => {
    if (!open || !user || initDone) return;
    (async () => {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          user_name: user.user_metadata?.name ?? user.email,
          user_email: user.email,
        }),
      });
      const conv = await res.json();
      setConversationId(conv.id);

      // Load existing messages
      const msgRes = await fetch(`/api/chat/messages?conversationId=${conv.id}`);
      const msgs = await msgRes.json();
      setMessages(msgs);
      setInitDone(true);

      // Subscribe to Pusher channel
      const pusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      });
      const channel = pusher.subscribe(`chat-${conv.id}`);
      channel.bind("new-message", (msg: Message) => {
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
        );
      });
      pusherRef.current = pusher;
    })();

    return () => {
      pusherRef.current?.disconnect();
    };
  }, [open, user, initDone]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !conversationId || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistic update
    const temp: Message = {
      id: `temp-${Date.now()}`,
      sender_type: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);

    await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId, sender_type: "user", content: text }),
    });
    setSending(false);
  }

  if (loading) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[340px] sm:w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
            style={{ maxHeight: "520px" }}
          >
            {/* Header */}
            <div className="bg-brand-slate px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-brand-orange flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <span className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-brand-slate",
                    adminOnline ? "bg-green-400" : "bg-slate-400"
                  )} />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-none">DTT Hardware</p>
                  <p className="text-white/50 text-xs mt-0.5">
                    {adminOnline ? "Online" : "Bot is active"}
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            {!user ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                <MessageCircle className="h-12 w-12 text-slate-200" />
                <div>
                  <p className="font-bold text-brand-slate">Sign in to chat</p>
                  <p className="text-xs text-slate-400 mt-1">Message us directly — admin or AI bot will respond.</p>
                </div>
                <div className="flex gap-2 w-full">
                  <Link href="/login" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">Sign In</Button>
                  </Link>
                  <Link href="/register" className="flex-1">
                    <Button size="sm" className="w-full">Register</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  {messages.length === 0 && (
                    <div className="text-center py-6">
                      <Bot className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">
                        {adminOnline
                          ? "Admin is online. Send a message!"
                          : "Ask us anything — our AI assistant will help you."}
                      </p>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-2 items-end",
                        msg.sender_type === "user" ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                        msg.sender_type === "user"
                          ? "bg-brand-orange"
                          : msg.sender_type === "admin"
                          ? "bg-brand-slate"
                          : "bg-slate-300"
                      )}>
                        {msg.sender_type === "user"
                          ? <User className="h-3 w-3 text-white" />
                          : <Bot className="h-3 w-3 text-white" />}
                      </div>
                      <div className={cn(
                        "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                        msg.sender_type === "user"
                          ? "bg-brand-orange text-white rounded-br-sm"
                          : "bg-white text-brand-slate shadow-sm rounded-bl-sm"
                      )}>
                        {msg.sender_type !== "user" && (
                          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 opacity-50">
                            {msg.sender_type === "admin" ? "Admin" : "AI Assistant"}
                          </p>
                        )}
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <form onSubmit={sendMessage} className="p-3 border-t border-slate-100 bg-white flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 h-9 text-sm"
                    disabled={sending}
                  />
                  <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!input.trim() || sending}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-brand-orange shadow-xl flex items-center justify-center text-white relative"
        aria-label="Open chat"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span key="msg" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
