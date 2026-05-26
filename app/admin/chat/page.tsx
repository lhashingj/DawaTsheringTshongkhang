"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import {
  Bot, User, Send, Loader2, MessageCircle, Wifi, WifiOff,
  Trash2, Package, ArrowLeft, Search, Clock,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

interface Message {
  id: string;
  senderType: "user" | "admin" | "bot";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: string;
  type?: "general" | "order";
  updatedAt: string;
  lastMessage?: string;
}

interface ConvRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  status: string;
  type: "general" | "order";
  updated_at: string;
}

function timeAgo(iso: string) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AdminChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-brand-slate">
        <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
      </div>
    }>
      <AdminChatInner />
    </Suspense>
  );
}

function AdminChatInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const urlParamApplied = useRef(false);
  const unsubMessagesRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) router.replace("/login");
  }, [user, loading, router]);

  // Load admin online status
  useEffect(() => {
    if (!user || user.role !== "admin") return;
    supabase
      .from("settings")
      .select("is_online")
      .eq("key", "admin")
      .single()
      .then(({ data }) => setIsOnline(data?.is_online ?? false));
  }, [user]);

  async function loadConversations() {
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, user_id, user_name, user_email, status, type, updated_at")
      .order("updated_at", { ascending: false });
    if (!convs) return;

    const withPreview = await Promise.all(
      (convs as ConvRow[]).map(async (c) => {
        const { data: msgs } = await supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1);
        return {
          id: c.id,
          userId: c.user_id,
          userName: c.user_name ?? "Unknown",
          userEmail: c.user_email ?? "",
          status: c.status,
          type: c.type ?? "general",
          updatedAt: c.updated_at ?? "",
          lastMessage: msgs?.[0]?.content?.slice(0, 60) ?? "No messages yet",
        } as Conversation;
      })
    );
    setConversations(withPreview);
  }

  // Real-time conversations listener
  useEffect(() => {
    if (!user || user.role !== "admin") return;
    loadConversations();

    const channel = supabase
      .channel("admin-conversations")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, loadConversations)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, loadConversations)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Apply URL ?conv= param only once on first load
  useEffect(() => {
    if (urlParamApplied.current) return;
    const convId = searchParams.get("conv");
    if (convId && conversations.length > 0) {
      setSelected(convId);
      urlParamApplied.current = true;
    }
  }, [searchParams, conversations]);

  // Real-time messages for selected conversation
  useEffect(() => {
    unsubMessagesRef.current?.();
    if (!selected) { setMessages([]); return; }

    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_type, content, created_at")
        .eq("conversation_id", selected!)
        .order("created_at", { ascending: true });
      if (data) {
        setMessages(data.map((m) => ({
          id: m.id,
          senderType: m.sender_type as Message["senderType"],
          content: m.content,
          createdAt: m.created_at ?? "",
        })));
      }
    }

    loadMessages();

    const channel = supabase
      .channel(`admin-messages-${selected}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${selected}` },
        loadMessages
      )
      .subscribe();

    unsubMessagesRef.current = () => { supabase.removeChannel(channel); };
    return () => unsubMessagesRef.current?.();
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function toggleOnline() {
    const next = !isOnline;
    setIsOnline(next);
    await supabase
      .from("settings")
      .upsert({ key: "admin", is_online: next });
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !selected || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    await supabase.from("messages").insert({
      conversation_id: selected,
      sender_type: "admin",
      content: text,
    });
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", selected);
    setSending(false);
  }

  async function deleteConversation(convId: string) {
    await supabase.from("messages").delete().eq("conversation_id", convId);
    await supabase.from("conversations").delete().eq("id", convId);
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (selected === convId) { setSelected(null); setMessages([]); }
    setDeleteConfirm(null);
  }

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen industrial-grid-bg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
      </div>
    );
  }

  const selectedConv = conversations.find((c) => c.id === selected);
  const filtered = conversations.filter((c) =>
    !search || c.userName.toLowerCase().includes(search.toLowerCase()) || c.userEmail.toLowerCase().includes(search.toLowerCase())
  );
  const orderConvs = filtered.filter((c) => c.type === "order");
  const generalConvs = filtered.filter((c) => (c.type ?? "general") === "general");

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className={cn(
        "flex flex-col bg-brand-slate border-r border-white/5",
        "w-full lg:w-80 shrink-0",
        selected ? "hidden lg:flex" : "flex",
      )}>
        <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Link href="/admin" className="text-white/40 hover:text-white/70 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="font-black text-white text-sm leading-none">Chat Dashboard</p>
              <p className="text-white/40 text-[10px] mt-0.5 uppercase tracking-wider">
                {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={toggleOnline}
            className={cn(
              "flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all cursor-pointer shrink-0",
              isOnline ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/30" : "bg-white/5 text-white/40 hover:bg-white/10"
            )}
          >
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? "Online" : "Offline"}
          </button>
        </div>

        <div className="px-3 py-2.5 border-b border-white/5 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…"
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white/70 placeholder-white/30 focus:outline-none focus:border-brand-orange/50 transition-colors" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <MessageCircle className="h-10 w-10 text-white/10 mb-3" />
              <p className="text-white/30 text-sm font-medium">No conversations yet</p>
            </div>
          ) : (
            <>
              {orderConvs.length > 0 && (
                <>
                  <div className="px-4 py-2 flex items-center gap-2">
                    <Package className="h-3 w-3 text-brand-orange" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-orange">
                      Order Enquiries ({orderConvs.length})
                    </span>
                  </div>
                  {orderConvs.map((conv) => (
                    <ConvItem key={conv.id} conv={conv} selected={selected} onSelect={setSelected} onDeleteRequest={setDeleteConfirm} />
                  ))}
                </>
              )}
              {generalConvs.length > 0 && (
                <>
                  <div className="px-4 py-2 flex items-center gap-2 mt-1">
                    <Bot className="h-3 w-3 text-slate-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                      General ({generalConvs.length})
                    </span>
                  </div>
                  {generalConvs.map((conv) => (
                    <ConvItem key={conv.id} conv={conv} selected={selected} onSelect={setSelected} onDeleteRequest={setDeleteConfirm} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </aside>

      {/* ── Chat area ── */}
      <div className={cn("flex-1 flex flex-col min-w-0", !selected ? "hidden lg:flex" : "flex")}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-slate-300" />
              </div>
              <p className="font-bold text-slate-400">Select a conversation</p>
              <p className="text-sm text-slate-300 mt-1">Pick a customer from the left panel</p>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
              <button onClick={() => { setSelected(null); setMessages([]); }}
                className="lg:hidden text-slate-400 hover:text-brand-slate transition-colors p-1 -ml-1 cursor-pointer">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="w-9 h-9 rounded-full bg-brand-slate flex items-center justify-center shrink-0 text-white font-black text-sm">
                {selectedConv?.userName?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-brand-slate text-sm leading-none truncate">{selectedConv?.userName}</p>
                <p className="text-xs text-slate-400 truncate mt-0.5">{selectedConv?.userEmail}</p>
              </div>
              {selectedConv?.type === "order" && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-orange bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full shrink-0">
                  <Package className="h-3 w-3" /> Order
                </span>
              )}
              <button onClick={() => setDeleteConfirm(selected)}
                className="text-slate-300 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50 cursor-pointer" title="Delete conversation">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-12">
                  <MessageCircle className="h-10 w-10 text-slate-200" />
                  <p className="text-slate-400 text-sm font-medium">No messages yet</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex gap-2 items-end", msg.senderType === "admin" ? "flex-row-reverse" : "flex-row")}>
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-black",
                    msg.senderType === "admin" ? "bg-brand-orange" : msg.senderType === "bot" ? "bg-slate-300" : "bg-brand-slate")}>
                    {msg.senderType === "admin" ? "A" : msg.senderType === "bot" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                  </div>
                  <div className={cn("max-w-[72%] sm:max-w-[65%] rounded-2xl px-3.5 py-2.5 text-sm",
                    msg.senderType === "admin" ? "bg-brand-orange text-white rounded-br-sm"
                      : msg.senderType === "bot" ? "bg-white text-slate-500 shadow-sm rounded-bl-sm border border-slate-100"
                      : "bg-white text-brand-slate shadow-sm rounded-bl-sm border border-slate-100")}>
                    {msg.senderType !== "admin" && (
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-40">
                        {msg.senderType === "bot" ? "AI Bot" : selectedConv?.userName ?? "Customer"}
                      </p>
                    )}
                    <span className="whitespace-pre-line leading-relaxed">{msg.content}</span>
                    <p className={cn("text-[10px] mt-1.5 flex items-center gap-1", msg.senderType === "admin" ? "text-white/50 justify-end" : "text-slate-300")}>
                      <Clock className="h-2.5 w-2.5" />{timeAgo(msg.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendReply} className="p-3 sm:p-4 bg-white border-t border-slate-100 flex gap-2 shrink-0">
              <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your reply…" className="flex-1 h-10 sm:h-11 text-sm" disabled={sending} />
              <Button type="submit" disabled={!input.trim() || sending} className="h-10 sm:h-11 px-4 gap-2 cursor-pointer">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="hidden sm:block">Send</span>
              </Button>
            </form>
          </>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="text-center font-black text-brand-slate text-lg mb-2">Delete Conversation?</h3>
            <p className="text-center text-slate-500 text-sm mb-6">All messages will be permanently deleted.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={() => deleteConversation(deleteConfirm)}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConvItem({ conv, selected, onSelect, onDeleteRequest }: {
  conv: Conversation;
  selected: string | null;
  onSelect: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}) {
  const isOrder = conv.type === "order";
  const isSelected = selected === conv.id;
  return (
    <div className={cn("relative group border-b border-white/5 transition-colors", isSelected ? "bg-white/15" : "hover:bg-white/5")}>
      <button onClick={() => onSelect(conv.id)} className="w-full text-left px-4 py-3.5 pr-12 cursor-pointer">
        <div className="flex items-start gap-3">
          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white font-black text-sm mt-0.5",
            isOrder ? "bg-brand-orange/80" : "bg-white/10")}>
            {conv.userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-white text-sm font-semibold leading-none line-clamp-1 flex-1">{conv.userName}</p>
              {isOrder && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-brand-orange bg-brand-orange/10 px-1.5 py-0.5 rounded-full shrink-0">Order</span>
              )}
            </div>
            <p className="text-white/40 text-xs line-clamp-1 mt-0.5">{conv.lastMessage}</p>
            <p className="text-white/20 text-[10px] mt-1">{timeAgo(conv.updatedAt)}</p>
          </div>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDeleteRequest(conv.id); }}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-red-400 transition-colors sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
