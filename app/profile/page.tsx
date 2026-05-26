"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, ShoppingBag, Shield, Save, Eye, EyeOff, Phone, MapPin,
  Building2, Mail, KeyRound, CheckCircle, Package, ChevronDown, ChevronUp,
  Loader2, AlertCircle,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const GST_RATE = 0.05;

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "orders", label: "My Orders", icon: ShoppingBag },
  { id: "security", label: "Security", icon: Shield },
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

export default function ProfilePage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");

  // Profile state
  const [profile, setProfile] = useState<ProfileData>({ name: "", phone: "", address: "", company: "" });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

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
    if (tab === "orders" && !ordersLoaded && user) {
      loadOrders();
    }
  }, [tab, user]);

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
    setOrdersLoaded(true);
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

  // Redirect if not logged in
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
        </div>
        <Footer />
      </>
    );
  }

  function parseOrderContent(content: string) {
    const lines = content.split("\n").filter((l) => l.trim());
    const items = lines.filter((l) => l.startsWith("•"));
    const totalLine = lines.find((l) => l.includes("Total (incl. GST)"));
    return { items, total: totalLine?.split(": ").slice(1).join(": ") ?? "" };
  }

  return (
    <>
      <Header />

      {/* Page hero */}
      <div className="bg-brand-slate pt-24 pb-8">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-brand-orange text-xs font-bold uppercase tracking-widest mb-2">Account</p>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-orange/20 border border-brand-orange/30 flex items-center justify-center shrink-0">
                <span className="text-2xl font-black text-brand-orange">
                  {(profile.name || user.name || user.email).charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">{profile.name || user.name || "My Profile"}</h1>
                <p className="text-white/50 text-sm">{user.email}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <main className="bg-slate-50 min-h-screen">
        <div className="container py-8">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Sidebar tabs */}
            <aside className="lg:w-56 shrink-0">
              <nav className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold transition-colors cursor-pointer border-b border-slate-50 last:border-0 ${
                      tab === t.id
                        ? "bg-brand-orange text-white"
                        : "text-slate-600 hover:bg-slate-50 hover:text-brand-slate"
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

                {/* ─── PROFILE TAB ─── */}
                {tab === "profile" && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                      <h2 className="text-lg font-bold text-brand-slate mb-6">Profile Information</h2>

                      {profileLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-brand-orange" />
                        </div>
                      ) : (
                        <form onSubmit={saveProfile} className="space-y-5">
                          {/* Name */}
                          <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-slate-400" />
                              Full Name
                            </label>
                            <Input
                              value={profile.name}
                              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                              placeholder="Your full name"
                              required
                              className="h-11 bg-slate-50 border-slate-200 focus:border-brand-orange transition-colors"
                            />
                          </div>

                          {/* Email — read only */}
                          <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 text-slate-400" />
                              Email Address
                            </label>
                            <Input
                              value={user.email}
                              readOnly
                              className="h-11 bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-400">Email cannot be changed.</p>
                          </div>

                          {/* Phone */}
                          <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              Phone Number
                            </label>
                            <Input
                              value={profile.phone}
                              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                              placeholder="+975 17 xxxxxx"
                              type="tel"
                              className="h-11 bg-slate-50 border-slate-200 focus:border-brand-orange transition-colors"
                            />
                          </div>

                          {/* Company */}
                          <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 text-slate-400" />
                              Company / Organisation
                            </label>
                            <Input
                              value={profile.company}
                              onChange={(e) => setProfile((p) => ({ ...p, company: e.target.value }))}
                              placeholder="Your company or organisation name"
                              className="h-11 bg-slate-50 border-slate-200 focus:border-brand-orange transition-colors"
                            />
                          </div>

                          {/* Address */}
                          <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              Delivery Address
                            </label>
                            <textarea
                              value={profile.address}
                              onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                              placeholder="Village, Gewog, Dzongkhag"
                              rows={3}
                              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-colors resize-none"
                            />
                          </div>

                          {profileError && (
                            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
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
                                className="text-sm text-green-600 font-medium"
                              >
                                Profile updated successfully.
                              </motion.p>
                            )}
                          </div>
                        </form>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ─── ORDERS TAB ─── */}
                {tab === "orders" && (
                  <motion.div
                    key="orders"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                      <h2 className="text-lg font-bold text-brand-slate mb-6">My Orders</h2>

                      {ordersLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-brand-orange" />
                        </div>
                      ) : orders.length === 0 ? (
                        <div className="text-center py-16">
                          <Package className="h-14 w-14 mx-auto text-slate-200 mb-4" />
                          <p className="font-bold text-brand-slate text-lg">No orders yet</p>
                          <p className="text-slate-400 text-sm mt-2 mb-6">
                            Add products to your cart and place your first order enquiry.
                          </p>
                          <Button onClick={() => router.push("/products")} className="cursor-pointer">
                            Browse Products
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {orders.map((order, i) => {
                            const firstMsg = order.messages[0];
                            const { items, total } = firstMsg
                              ? parseOrderContent(firstMsg.content)
                              : { items: [], total: "" };
                            const date = new Date(order.created_at).toLocaleDateString("en-BT", {
                              year: "numeric", month: "short", day: "numeric",
                            });
                            const statusColor =
                              order.status === "open"
                                ? "bg-blue-100 text-blue-700"
                                : order.status === "closed"
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-100 text-slate-600";

                            return (
                              <motion.div
                                key={order.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="border border-slate-100 rounded-xl overflow-hidden"
                              >
                                {/* Order header */}
                                <button
                                  onClick={() => toggleOrder(order.id)}
                                  className="w-full flex items-center justify-between gap-3 p-4 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0">
                                      <ShoppingBag className="h-4 w-4 text-brand-orange" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-brand-slate">
                                        Order Enquiry
                                      </p>
                                      <p className="text-xs text-slate-400">{date}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {total && (
                                      <span className="text-sm font-extrabold text-brand-orange hidden sm:block">
                                        {total}
                                      </span>
                                    )}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusColor}`}>
                                      {order.status}
                                    </span>
                                    {order.expanded
                                      ? <ChevronUp className="h-4 w-4 text-slate-400" />
                                      : <ChevronDown className="h-4 w-4 text-slate-400" />
                                    }
                                  </div>
                                </button>

                                {/* Order details */}
                                <AnimatePresence initial={false}>
                                  {order.expanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="px-4 pb-4 border-t border-slate-50 pt-3">
                                        {items.length > 0 ? (
                                          <ul className="space-y-1.5 mb-3">
                                            {items.map((item, idx) => (
                                              <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                                                <span className="text-brand-orange mt-0.5">•</span>
                                                <span>{item.replace("• ", "")}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : firstMsg ? (
                                          <pre className="text-xs text-slate-500 whitespace-pre-wrap font-sans mb-3">
                                            {firstMsg.content}
                                          </pre>
                                        ) : (
                                          <p className="text-sm text-slate-400 mb-3">No order details available.</p>
                                        )}
                                        {total && (
                                          <p className="text-sm font-extrabold text-brand-slate border-t border-dashed border-slate-200 pt-3">
                                            Total: <span className="text-brand-orange">{total}</span>
                                          </p>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ─── SECURITY TAB ─── */}
                {tab === "security" && (
                  <motion.div
                    key="security"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                      <h2 className="text-lg font-bold text-brand-slate mb-1">Change Password</h2>
                      <p className="text-slate-500 text-sm mb-6">Choose a strong password to keep your account secure.</p>

                      <form onSubmit={changePassword} className="space-y-5 max-w-sm">
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-700">New Password</label>
                          <div className="relative">
                            <Input
                              type={showNew ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Min. 6 characters"
                              required
                              className="h-11 bg-slate-50 border-slate-200 focus:border-brand-orange pr-11 transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNew((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              tabIndex={-1}
                            >
                              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-700">Confirm New Password</label>
                          <div className="relative">
                            <Input
                              type={showConfirm ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Re-enter new password"
                              required
                              className="h-11 bg-slate-50 border-slate-200 focus:border-brand-orange pr-11 transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirm((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              tabIndex={-1}
                            >
                              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {securityError && (
                          <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
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
                              className="text-sm text-green-600 font-medium"
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
