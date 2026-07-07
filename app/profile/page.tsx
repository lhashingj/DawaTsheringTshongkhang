"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, ShoppingBag, Save, Eye, EyeOff, Phone, MapPin,
  Building2, Mail, KeyRound, CheckCircle, Package, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Truck, LifeBuoy, Settings, MessageCircle, Clock,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const TABS = [
  { id: "orders", label: "Order History", icon: ShoppingBag },
  { id: "track", label: "Track Shipment", icon: Truck },
  { id: "tickets", label: "Support Tickets", icon: LifeBuoy },
  { id: "settings", label: "Account Settings", icon: Settings },
] as const;

type Tab = (typeof TABS)[number]["id"];

interface ProfileData {
  name: string;
  phone: string;
  address: string;
  company: string;
}

interface OrderMessage {
  id: string;
  content: string;
  created_at: string;
}

interface Order {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  messages: OrderMessage[];
  expanded: boolean;
}

interface Ticket {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  preview: string;
}

const inputCls = "w-full h-11 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-400 transition-colors";

function statusBadge(status: string) {
  const cls =
    status === "open"
      ? "bg-blue-500/15 text-blue-400"
      : status === "closed"
      ? "bg-green-500/15 text-green-400"
      : "bg-slate-500/15 text-slate-400";
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${cls}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-BT", { year: "numeric", month: "short", day: "numeric" });
}

function parseOrderContent(content: string) {
  const lines = content.split("\n").filter((l) => l.trim());
  const items = lines.filter((l) => l.startsWith("•"));
  const totalLine = lines.find((l) => l.includes("Total (incl. GST)"));
  return { items, total: totalLine?.split(": ").slice(1).join(": ") ?? "" };
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>("orders");

  // Profile state
  const [profile, setProfile] = useState<ProfileData>({ name: "", phone: "", address: "", company: "" });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Orders state (shared by Order History + Track Shipment)
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Support tickets state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  // Security state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState(false);
  const [securityError, setSecurityError] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name, phone, address, company")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile({
            name: data.name ?? "",
            phone: data.phone ?? "",
            address: data.address ?? "",
            company: data.company ?? "",
          });
        }
        setProfileLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadOrders();
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadOrders() {
    if (!user) return;
    setOrdersLoading(true);
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, status, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("type", "order")
      .order("updated_at", { ascending: false });

    if (!convs) { setOrdersLoading(false); return; }

    const ordersWithMsgs = await Promise.all(
      convs.map(async (conv) => {
        const { data: msgs } = await supabase
          .from("messages")
          .select("id, content, created_at")
          .eq("conversation_id", conv.id)
          .eq("sender_type", "user")
          .order("created_at", { ascending: true })
          .limit(1);
        return { ...conv, messages: msgs ?? [], expanded: false };
      })
    );

    setOrders(ordersWithMsgs);
    setOrdersLoading(false);
  }

  async function loadTickets() {
    if (!user) return;
    setTicketsLoading(true);
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, status, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("type", "general")
      .order("updated_at", { ascending: false });

    if (!convs) { setTicketsLoading(false); return; }

    const withPreview = await Promise.all(
      convs.map(async (conv) => {
        const { data: msgs } = await supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1);
        return { ...conv, preview: msgs?.[0]?.content ?? "" };
      })
    );

    setTickets(withPreview);
    setTicketsLoading(false);
  }

  function toggleOrder(id: string) {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, expanded: !o.expanded } : o));
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setProfileError("");
    setProfileSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: profile.name, phone: profile.phone, address: profile.address, company: profile.company })
        .eq("id", user.id);
      if (error) throw error;
      await refreshUser();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch {
      setProfileError("Failed to save profile. Please try again.");
    }
    setProfileSaving(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setSecurityError("");
    if (newPassword.length < 6) { setSecurityError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setSecurityError("Passwords do not match."); return; }
    setSecurityLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setSecuritySuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSecuritySuccess(false), 3000);
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? "";
      setSecurityError(msg || "Failed to update password. Please try again.");
    }
    setSecurityLoading(false);
  }

  useEffect(() => {
    if (!user && typeof window !== "undefined") {
      const t = setTimeout(() => router.push("/login"), 300);
      return () => clearTimeout(t);
    }
  }, [user, router]);

  if (!user) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      {/* Page hero */}
      <div className="bg-slate-950 pt-24 pb-8">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-brand-orange text-xs font-bold uppercase tracking-widest mb-2">My Dashboard</p>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-orange/20 border border-brand-orange/30 flex items-center justify-center shrink-0">
                <span className="text-2xl font-black text-brand-orange">
                  {(profile.name || user.name || user.email).charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">{profile.name || user.name || "My Account"}</h1>
                <p className="text-slate-400 text-sm">{user.email}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <main className="bg-slate-900 min-h-screen">
        <div className="container py-8">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Sidebar */}
            <aside className="lg:w-60 shrink-0">
              <nav className="bg-slate-800 rounded-xl border border-slate-700/70 overflow-hidden p-1.5 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-3 px-3.5 py-3 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer whitespace-nowrap lg:w-full ${
                      tab === t.id
                        ? "bg-brand-orange/15 text-brand-orange"
                        : "text-slate-400 hover:bg-slate-700/60 hover:text-white"
                    }`}
                  >
                    <t.icon className="h-4 w-4 shrink-0" />
                    {t.label}
                  </button>
                ))}
              </nav>
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">

                {/* ─── ORDER HISTORY ─── */}
                {tab === "orders" && (
                  <motion.div
                    key="orders"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="bg-slate-800 rounded-2xl border border-slate-700/70 p-6">
                      <h2 className="text-lg font-bold text-white mb-6">Order History</h2>

                      {ordersLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-brand-orange" />
                        </div>
                      ) : orders.length === 0 ? (
                        <div className="text-center py-16">
                          <Package className="h-14 w-14 mx-auto text-slate-700 mb-4" />
                          <p className="font-bold text-white text-lg">No orders yet</p>
                          <p className="text-slate-400 text-sm mt-2 mb-6">
                            Add products to your cart and place your first order enquiry.
                          </p>
                          <Button onClick={() => router.push("/products")} className="cursor-pointer">
                            Browse Products
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* Desktop: borderless table with alternating rows */}
                          <div className="hidden md:block overflow-x-auto rounded-xl">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                                  <th className="px-4 py-3 font-semibold">Order</th>
                                  <th className="px-4 py-3 font-semibold">Date</th>
                                  <th className="px-4 py-3 font-semibold">Total</th>
                                  <th className="px-4 py-3 font-semibold">Status</th>
                                  <th className="px-4 py-3" />
                                </tr>
                              </thead>
                              <tbody>
                                {orders.map((order, i) => {
                                  const firstMsg = order.messages[0];
                                  const { items, total } = firstMsg
                                    ? parseOrderContent(firstMsg.content)
                                    : { items: [], total: "" };
                                  return (
                                    <React.Fragment key={order.id}>
                                      <tr
                                        onClick={() => toggleOrder(order.id)}
                                        className={`cursor-pointer transition-colors hover:bg-slate-700/40 ${
                                          i % 2 === 1 ? "bg-slate-700/20" : ""
                                        }`}
                                      >
                                        <td className="px-4 py-3.5 rounded-l-lg">
                                          <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0">
                                              <ShoppingBag className="h-3.5 w-3.5 text-brand-orange" />
                                            </div>
                                            <span className="font-semibold text-white font-mono text-xs">
                                              #{order.id.slice(0, 8).toUpperCase()}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-300">{formatDate(order.created_at)}</td>
                                        <td className="px-4 py-3.5 font-bold text-brand-orange">{total || "—"}</td>
                                        <td className="px-4 py-3.5">{statusBadge(order.status)}</td>
                                        <td className="px-4 py-3.5 text-right rounded-r-lg">
                                          {order.expanded
                                            ? <ChevronUp className="h-4 w-4 text-slate-400 inline" />
                                            : <ChevronDown className="h-4 w-4 text-slate-400 inline" />}
                                        </td>
                                      </tr>
                                      {order.expanded && (
                                        <tr className={i % 2 === 1 ? "bg-slate-700/20" : ""}>
                                          <td colSpan={5} className="px-4 pb-4">
                                            <div className="ml-[42px] border-l-2 border-slate-700 pl-4 py-1">
                                              {items.length > 0 ? (
                                                <ul className="space-y-1.5">
                                                  {items.map((item, idx) => (
                                                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                                                      <span className="text-brand-orange mt-0.5">•</span>
                                                      <span>{item.replace("• ", "")}</span>
                                                    </li>
                                                  ))}
                                                </ul>
                                              ) : firstMsg ? (
                                                <pre className="text-xs text-slate-400 whitespace-pre-wrap font-sans">
                                                  {firstMsg.content}
                                                </pre>
                                              ) : (
                                                <p className="text-sm text-slate-500">No order details available.</p>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile: card list */}
                          <div className="md:hidden space-y-3">
                            {orders.map((order) => {
                              const firstMsg = order.messages[0];
                              const { items, total } = firstMsg
                                ? parseOrderContent(firstMsg.content)
                                : { items: [], total: "" };
                              return (
                                <div key={order.id} className="border border-slate-700/70 rounded-xl overflow-hidden">
                                  <button
                                    onClick={() => toggleOrder(order.id)}
                                    className="w-full flex items-center justify-between gap-3 p-4 hover:bg-slate-700/50 transition-colors cursor-pointer text-left"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-9 h-9 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0">
                                        <ShoppingBag className="h-4 w-4 text-brand-orange" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-white font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                                        <p className="text-xs text-slate-400">{formatDate(order.created_at)}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {statusBadge(order.status)}
                                      {order.expanded
                                        ? <ChevronUp className="h-4 w-4 text-slate-400" />
                                        : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                    </div>
                                  </button>
                                  <AnimatePresence initial={false}>
                                    {order.expanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="px-4 pb-4 border-t border-slate-700/70 pt-3">
                                          {items.length > 0 ? (
                                            <ul className="space-y-1.5 mb-3">
                                              {items.map((item, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                                                  <span className="text-brand-orange mt-0.5">•</span>
                                                  <span>{item.replace("• ", "")}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          ) : firstMsg ? (
                                            <pre className="text-xs text-slate-400 whitespace-pre-wrap font-sans mb-3">{firstMsg.content}</pre>
                                          ) : (
                                            <p className="text-sm text-slate-500 mb-3">No order details available.</p>
                                          )}
                                          {total && (
                                            <p className="text-sm font-extrabold text-white border-t border-dashed border-slate-700 pt-3">
                                              Total: <span className="text-brand-orange">{total}</span>
                                            </p>
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ─── TRACK SHIPMENT ─── */}
                {tab === "track" && (
                  <motion.div
                    key="track"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="bg-slate-800 rounded-2xl border border-slate-700/70 p-6">
                      <h2 className="text-lg font-bold text-white mb-1">Track Shipment</h2>
                      <p className="text-slate-400 text-sm mb-6">
                        Follow the progress of your order enquiries. Our team confirms delivery details over chat or phone.
                      </p>

                      {ordersLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-brand-orange" />
                        </div>
                      ) : orders.length === 0 ? (
                        <div className="text-center py-16">
                          <Truck className="h-14 w-14 mx-auto text-slate-700 mb-4" />
                          <p className="font-bold text-white text-lg">Nothing to track yet</p>
                          <p className="text-slate-400 text-sm mt-2">
                            Once you place an order enquiry, its progress will appear here.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {orders.map((order) => {
                            const closed = order.status === "closed";
                            const steps = [
                              { label: "Enquiry Placed", date: formatDate(order.created_at), done: true },
                              { label: "Processing", date: closed ? "" : "In progress", done: true, active: !closed },
                              { label: "Completed", date: closed ? formatDate(order.updated_at) : "Pending", done: closed },
                            ];
                            return (
                              <div key={order.id} className="border border-slate-700/70 rounded-xl p-5">
                                <div className="flex items-center justify-between mb-5">
                                  <p className="font-bold text-white font-mono text-sm">
                                    #{order.id.slice(0, 8).toUpperCase()}
                                  </p>
                                  {statusBadge(order.status)}
                                </div>
                                <div className="flex items-start">
                                  {steps.map((step, idx) => (
                                    <div key={step.label} className="flex-1 flex flex-col items-center relative">
                                      {idx > 0 && (
                                        <div
                                          className={`absolute top-3.5 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                                            step.done ? "bg-brand-orange" : "bg-slate-700"
                                          }`}
                                        />
                                      )}
                                      <div
                                        className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center ${
                                          step.done
                                            ? step.active
                                              ? "bg-brand-orange/20 border-2 border-brand-orange"
                                              : "bg-brand-orange"
                                            : "bg-slate-700"
                                        }`}
                                      >
                                        {step.done && !step.active ? (
                                          <CheckCircle className="h-4 w-4 text-white" />
                                        ) : step.active ? (
                                          <Clock className="h-3.5 w-3.5 text-brand-orange" />
                                        ) : (
                                          <div className="w-2 h-2 rounded-full bg-slate-500" />
                                        )}
                                      </div>
                                      <p className={`text-xs font-semibold mt-2 text-center ${step.done ? "text-white" : "text-slate-500"}`}>
                                        {step.label}
                                      </p>
                                      <p className="text-[10px] text-slate-500 mt-0.5 text-center">{step.date}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ─── SUPPORT TICKETS ─── */}
                {tab === "tickets" && (
                  <motion.div
                    key="tickets"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="bg-slate-800 rounded-2xl border border-slate-700/70 p-6">
                      <h2 className="text-lg font-bold text-white mb-1">Support Tickets</h2>
                      <p className="text-slate-400 text-sm mb-6">
                        Your conversations with our support team. Use the chat bubble at the bottom-right of any page to start a new one.
                      </p>

                      {ticketsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-brand-orange" />
                        </div>
                      ) : tickets.length === 0 ? (
                        <div className="text-center py-16">
                          <LifeBuoy className="h-14 w-14 mx-auto text-slate-700 mb-4" />
                          <p className="font-bold text-white text-lg">No support tickets</p>
                          <p className="text-slate-400 text-sm mt-2">
                            Need help? Message us any time via the chat bubble — we usually reply within business hours.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-xl overflow-hidden">
                          {tickets.map((ticket, i) => (
                            <div
                              key={ticket.id}
                              className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-700/40 ${
                                i % 2 === 1 ? "bg-slate-700/20" : ""
                              }`}
                            >
                              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                <MessageCircle className="h-4 w-4 text-blue-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-white font-mono">
                                    #{ticket.id.slice(0, 8).toUpperCase()}
                                  </p>
                                  {statusBadge(ticket.status)}
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                                  {ticket.preview || "No messages yet"}
                                </p>
                              </div>
                              <p className="text-xs text-slate-500 shrink-0">{formatDate(ticket.updated_at)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ─── ACCOUNT SETTINGS ─── */}
                {tab === "settings" && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-6"
                  >
                    <div className="bg-slate-800 rounded-2xl border border-slate-700/70 p-6">
                      <h2 className="text-lg font-bold text-white mb-6">Profile Information</h2>

                      {profileLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-brand-orange" />
                        </div>
                      ) : (
                        <form onSubmit={saveProfile} className="space-y-5">
                          <div className="grid sm:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                              <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-slate-400" />
                                Full Name
                              </label>
                              <input
                                value={profile.name}
                                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                                placeholder="Your full name"
                                required
                                className={inputCls}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5 text-slate-400" />
                                Email Address
                              </label>
                              <input
                                value={user.email}
                                readOnly
                                className="w-full h-11 bg-slate-700/50 border border-slate-700 text-slate-500 rounded-lg px-3 text-sm cursor-not-allowed"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                                Phone Number
                              </label>
                              <input
                                value={profile.phone}
                                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                                placeholder="+975 17 xxxxxx"
                                type="tel"
                                className={inputCls}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                Company / Organisation
                              </label>
                              <input
                                value={profile.company}
                                onChange={(e) => setProfile((p) => ({ ...p, company: e.target.value }))}
                                placeholder="Your company or organisation name"
                                className={inputCls}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              Delivery Address
                            </label>
                            <textarea
                              value={profile.address}
                              onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                              placeholder="Village, Gewog, Dzongkhag"
                              rows={3}
                              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors resize-none placeholder-slate-400"
                            />
                          </div>

                          {profileError && (
                            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2.5">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              {profileError}
                            </div>
                          )}

                          <div className="flex items-center gap-3 pt-2">
                            <Button
                              type="submit"
                              disabled={profileSaving}
                              className="gap-2 cursor-pointer shadow-lg shadow-orange-500/20"
                            >
                              {profileSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : profileSuccess ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                              {profileSaving ? "Saving…" : profileSuccess ? "Saved!" : "Save Changes"}
                            </Button>
                            {profileSuccess && (
                              <motion.p
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-sm text-green-400 font-medium"
                              >
                                Profile updated successfully.
                              </motion.p>
                            )}
                          </div>
                        </form>
                      )}
                    </div>

                    <div className="bg-slate-800 rounded-2xl border border-slate-700/70 p-6">
                      <h2 className="text-lg font-bold text-white mb-1">Change Password</h2>
                      <p className="text-slate-400 text-sm mb-6">Choose a strong password to keep your account secure.</p>

                      <form onSubmit={changePassword} className="space-y-5 max-w-sm">
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-300">New Password</label>
                          <div className="relative">
                            <input
                              type={showNew ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Min. 6 characters"
                              required
                              className={`${inputCls} pr-11`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowNew((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                              tabIndex={-1}
                            >
                              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-300">Confirm New Password</label>
                          <div className="relative">
                            <input
                              type={showConfirm ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Re-enter new password"
                              required
                              className={`${inputCls} pr-11`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirm((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                              tabIndex={-1}
                            >
                              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {securityError && (
                          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2.5">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {securityError}
                          </div>
                        )}

                        <div className="flex items-center gap-3 pt-2">
                          <Button
                            type="submit"
                            disabled={securityLoading}
                            className="gap-2 cursor-pointer shadow-lg shadow-orange-500/20"
                          >
                            {securityLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : securitySuccess ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <KeyRound className="h-4 w-4" />
                            )}
                            {securityLoading ? "Updating…" : securitySuccess ? "Updated!" : "Update Password"}
                          </Button>
                          {securitySuccess && (
                            <motion.p
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="text-sm text-green-400 font-medium"
                            >
                              Password changed successfully.
                            </motion.p>
                          )}
                        </div>
                      </form>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
