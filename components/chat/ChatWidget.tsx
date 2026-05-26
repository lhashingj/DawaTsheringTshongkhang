"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Loader2, ShoppingBag, ArrowLeft, Package, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Message {
  id: string;
  senderType: "user" | "admin" | "bot";
  content: string;
  createdAt: string;
}

interface MsgRow {
  id: string;
  sender_type: "user" | "admin" | "bot";
  content: string;
  created_at: string;
}

function mapMsg(row: MsgRow): Message {
  return { id: row.id, senderType: row.sender_type, content: row.content, createdAt: row.created_at };
}

function renderWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all text-brand-orange hover:opacity-80">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const WELCOME_MSG = "Hi! I'm Dawa, DTT Hardware's virtual assistant. 👋\n\nI can help you with:\n• Product prices and details\n• Stock availability\n• Our location and hours\n• Delivery options\n\nHow can I assist you today?";

export function ChatWidget() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"bot" | "order">("bot");

  const [guestId, setGuestId] = useState<string | null>(null);

  const [botConvId, setBotConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [orderConvId, setOrderConvId] = useState<string | null>(null);
  const [orderMessages, setOrderMessages] = useState<Message[]>([]);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [botTyping, setBotTyping] = useState(false);
  const [adminOnline, setAdminOnline] = useState(false);
  const [initDone, setInitDone] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const unsubBotRef = useRef<(() => void) | null>(null);
  const unsubOrderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let id = localStorage.getItem("dtt-guest-id");
    if (!id) {
      id = `guest-${Math.random().toString(36).slice(2)}-${Date.now()}`;
      localStorage.setItem("dtt-guest-id", id);
    }
    setGuestId(id);
  }, []);

  const chatUserId = user?.id ?? guestId;
  const chatUserName = user?.name ?? "Guest";
  const chatUserEmail = user?.email ?? "guest@dtt.local";

  // Watch admin online status
  useEffect(() => {
    supabase
      .from("settings")
      .select("is_online")
      .eq("key", "admin")
      .single()
      .then(({ data }) => setAdminOnline(data?.is_online ?? false));

    const channel = supabase
      .channel("admin-status-widget")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "settings", filter: "key=eq.admin" },
        (payload) => setAdminOnline((payload.new as { is_online: boolean }).is_online ?? false)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Cart "Order Now" event
  useEffect(() => {
    function handleOpen(e: Event) {
      const detail = (e as CustomEvent).detail;
      setOpen(true);
      setMode("order");
      if (detail?.forceOrderReload && user?.id) {
        loadOrderConv(user.id);
      }
    }
    window.addEventListener("dtt-open-chat", handleOpen);
    return () => window.removeEventListener("dtt-open-chat", handleOpen);
  }, [user?.id]);

  async function loadOrderConv(uid: string) {
    const { data } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", uid)
      .eq("type", "order")
      .eq("status", "open")
      .limit(1)
      .single();
    if (data?.id) {
      setOrderConvId(data.id);
      subscribeMessages(data.id, setOrderMessages, unsubOrderRef);
    }
  }

  function subscribeMessages(
    convId: string,
    setter: React.Dispatch<React.SetStateAction<Message[]>>,
    unsubRef: React.MutableRefObject<(() => void) | null>,
  ) {
    unsubRef.current?.();

    async function reload() {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_type, content, created_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      if (data) setter((data as MsgRow[]).map(mapMsg));
    }

    reload();

    const channel = supabase
      .channel(`messages-${convId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        reload
      )
      .subscribe();

    unsubRef.current = () => { supabase.removeChannel(channel); };
  }

  useEffect(() => () => {
    unsubBotRef.current?.();
    unsubOrderRef.current?.();
  }, []);

  // Init when chat opens
  useEffect(() => {
    if (!open || !chatUserId || initDone) return;
    (async () => {
      // General (bot) conversation
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", chatUserId)
        .eq("type", "general")
        .eq("status", "open")
        .limit(1)
        .single();

      let convId: string;
      if (existing?.id) {
        convId = existing.id;
      } else {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({ user_id: chatUserId, user_name: chatUserName, user_email: chatUserEmail, type: "general", status: "open" })
          .select("id")
          .single();
        convId = newConv!.id;
        await supabase.from("messages").insert({
          conversation_id: convId,
          sender_type: "bot",
          content: WELCOME_MSG,
        });
      }
      setBotConvId(convId);
      subscribeMessages(convId, setMessages, unsubBotRef);

      // Restore order conversation for logged-in users
      if (user?.id) await loadOrderConv(user.id);

      setInitDone(true);
    })();
  }, [open, chatUserId, initDone]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" }), 120);
    return () => clearTimeout(t);
  }, [open, mode]);

  useEffect(() => {
    const t = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [messages.length, orderMessages.length]);

  useEffect(() => {
    setInitDone(false);
    setBotConvId(null);
    setOrderConvId(null);
    setMessages([]);
    setOrderMessages([]);
    setMode("bot");
    unsubBotRef.current?.();
    unsubOrderRef.current?.();
  }, [user?.id]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending || !chatUserId) return;
    if (!user && mode === "order") return;
    const text = input.trim();
    setInput("");
    setSending(true);

    if (mode === "bot") {
      if (!botConvId) { setSending(false); return; }
      await supabase.from("messages").insert({ conversation_id: botConvId, sender_type: "user", content: text });
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", botConvId);

      setBotTyping(true);
      try {
        const { reply } = await fetch("/api/chat/bot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: messages.slice(-12).map((m) => ({ senderType: m.senderType, content: m.content })),
          }),
        }).then((r) => r.json());
        if (reply) {
          await supabase.from("messages").insert({ conversation_id: botConvId, sender_type: "bot", content: reply });
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", botConvId);
        }
      } catch {
        await supabase.from("messages").insert({
          conversation_id: botConvId,
          sender_type: "bot",
          content: "Sorry, I'm having trouble right now. Please call 17716895 for assistance.",
        });
      }
      setBotTyping(false);
    } else {
      let activeConvId = orderConvId;
      if (!activeConvId && user) {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({ user_id: user.id, user_name: user.name ?? user.email, user_email: user.email, type: "order", status: "open" })
          .select("id")
          .single();
        activeConvId = newConv!.id;
        setOrderConvId(newConv!.id);
        subscribeMessages(newConv!.id, setOrderMessages, unsubOrderRef);
      }
      if (!activeConvId) { setSending(false); return; }
      await supabase.from("messages").insert({ conversation_id: activeConvId, sender_type: "user", content: text });
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConvId);
    }

    setSending(false);
  }

  if (loading || user?.role === "admin") return null;

  const activeMessages = mode === "bot" ? messages : orderMessages;

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
                {mode === "order" && (
                  <button onClick={() => setMode("bot")} className="text-white/50 hover:text-white transition-colors mr-0.5">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-brand-orange flex items-center justify-center">
                    {mode === "order" ? <Package className="h-5 w-5 text-white" /> : <Bot className="h-5 w-5 text-white" />}
                  </div>
                  <span className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-brand-slate", adminOnline ? "bg-green-400" : "bg-slate-400")} />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-none">{mode === "order" ? "Order Chat" : "Dawa AI"}</p>
                  <p className="text-white/50 text-xs mt-0.5">
                    {mode === "order" ? (adminOnline ? "Admin online" : "Admin will reply shortly") : "DTT Hardware Virtual Assistant"}
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <>
              {mode === "order" && !user ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                  <Package className="h-12 w-12 text-slate-200" />
                  <div>
                    <p className="font-bold text-brand-slate">Sign in to place an order</p>
                    <p className="text-xs text-slate-400 mt-1">Create an account or sign in to chat directly with our team.</p>
                  </div>
                  <div className="flex gap-2 w-full">
                    <Link href="/login" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setOpen(false)}>
                        <LogIn className="h-3.5 w-3.5" /> Sign In
                      </Button>
                    </Link>
                    <Link href="/register" className="flex-1">
                      <Button size="sm" className="w-full" onClick={() => setOpen(false)}>Register</Button>
                    </Link>
                  </div>
                  <button onClick={() => setMode("bot")} className="text-xs text-slate-400 hover:text-brand-orange transition-colors">
                    ← Back to Dawa
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                    {activeMessages.length === 0 && mode === "bot" && (
                      <div className="text-center py-6 space-y-3">
                        <Bot className="h-10 w-10 text-slate-300 mx-auto" />
                        <p className="text-sm font-semibold text-slate-500">Hi, I&apos;m Dawa!</p>
                        <p className="text-xs text-slate-400">Ask me about products, prices, or availability.</p>
                      </div>
                    )}
                    {activeMessages.length === 0 && mode === "order" && (
                      <div className="text-center py-6 space-y-2">
                        <Package className="h-10 w-10 text-slate-300 mx-auto" />
                        <p className="text-xs text-slate-500 font-medium">Direct Admin Chat</p>
                        <p className="text-xs text-slate-400">
                          {adminOnline ? "Admin is online — describe your order." : "Describe your order and admin will reply shortly."}
                        </p>
                      </div>
                    )}
                    {activeMessages.map((msg) => {
                      const hasEscalate = msg.senderType === "bot" && msg.content.includes("__ESCALATE__");
                      const hasMap = msg.senderType === "bot" && msg.content.includes("__MAP__");
                      const display = msg.content
                        .replace(/\n?__ESCALATE__\s*$/, "")
                        .replace(/\n?__MAP__\s*$/, "")
                        .trimEnd();
                      return (
                        <div key={msg.id} className="flex flex-col gap-1">
                          <div className={cn("flex gap-2 items-end", msg.senderType === "user" ? "flex-row-reverse" : "flex-row")}>
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                              msg.senderType === "user" ? "bg-brand-orange" : msg.senderType === "admin" ? "bg-brand-slate" : "bg-slate-300")}>
                              {msg.senderType === "user" ? <User className="h-3 w-3 text-white" /> : <Bot className="h-3 w-3 text-white" />}
                            </div>
                            <div className={cn("rounded-2xl px-3.5 py-2 text-sm",
                              hasMap ? "w-[260px]" : "max-w-[75%]",
                              msg.senderType === "user" ? "bg-brand-orange text-white rounded-br-sm whitespace-pre-line"
                                : msg.senderType === "admin" ? "bg-brand-slate text-white rounded-bl-sm"
                                : "bg-white text-brand-slate shadow-sm rounded-bl-sm")}>
                              {msg.senderType !== "user" && (
                                <p className={cn("text-[10px] font-semibold uppercase tracking-wider mb-0.5",
                                  msg.senderType === "admin" ? "opacity-60" : "opacity-50 text-brand-slate")}>
                                  {msg.senderType === "admin" ? "Admin" : "Dawa AI"}
                                </p>
                              )}
                              <span className="whitespace-pre-line">{renderWithLinks(display)}</span>
                              {hasMap && (
                                <div className="mt-2 rounded-lg overflow-hidden">
                                  <iframe
                                    src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d7083.089037307908!2d89.422464!3d27.421136!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39e19d001f3ee1c1%3A0xb97b5314e22d6a91!2sDawa%20Tshering%20Tshongkhang!5e0!3m2!1sen!2sus!4v1778751380922!5m2!1sen!2sus"
                                    width="100%"
                                    height="180"
                                    style={{ border: 0 }}
                                    allowFullScreen
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          {hasEscalate && mode === "bot" && (
                            <div className="ml-8">
                              {user ? (
                                <button onClick={() => setMode("order")} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-brand-orange hover:bg-brand-orange/90 rounded-full px-3 py-1.5 transition-colors">
                                  <Package className="h-3 w-3" /> Connect to Admin
                                </button>
                              ) : (
                                <Link href="/login" onClick={() => setOpen(false)}>
                                  <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-brand-orange hover:bg-brand-orange/90 rounded-full px-3 py-1.5 transition-colors">
                                    <LogIn className="h-3 w-3" /> Sign in to talk to Admin
                                  </button>
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {botTyping && mode === "bot" && (
                      <div className="flex gap-2 items-end">
                        <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center shrink-0">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                        <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1">
                          {[0, 0.15, 0.3].map((delay, i) => (
                            <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400"
                              animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay }} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {mode === "bot" && messages.length > 0 && !orderConvId && user && (
                    <div className="px-3 py-2 bg-orange-50 border-t border-orange-100 flex items-center justify-between">
                      <p className="text-xs text-slate-500">Ready to place an order?</p>
                      <button onClick={() => setMode("order")} className="inline-flex items-center gap-1 text-xs font-bold text-brand-orange hover:underline">
                        <ShoppingBag className="h-3 w-3" /> Order with Admin
                      </button>
                    </div>
                  )}
                  {mode === "bot" && messages.length > 0 && !user && (
                    <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                      <p className="text-xs text-slate-400">Want to place an order?</p>
                      <Link href="/login" onClick={() => setOpen(false)}>
                        <button className="inline-flex items-center gap-1 text-xs font-bold text-brand-orange hover:underline">
                          <LogIn className="h-3 w-3" /> Sign in
                        </button>
                      </Link>
                    </div>
                  )}
                  {mode === "bot" && orderConvId && (
                    <div className="px-3 py-2 bg-brand-slate/5 border-t border-brand-slate/10 flex items-center justify-between">
                      <p className="text-xs text-slate-500">You have an active order chat.</p>
                      <button onClick={() => setMode("order")} className="inline-flex items-center gap-1 text-xs font-bold text-brand-slate hover:underline">
                        <Package className="h-3 w-3" /> View Order
                      </button>
                    </div>
                  )}

                  <form onSubmit={sendMessage} className="p-3 border-t border-slate-100 bg-white flex gap-2">
                    <Input value={input} onChange={(e) => setInput(e.target.value)}
                      placeholder={mode === "bot" ? "Ask about a product…" : "Describe your order…"}
                      className="flex-1 h-9 text-sm" disabled={sending} />
                    <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!input.trim() || sending}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </form>
                </>
              )}
            </>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
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
