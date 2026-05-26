"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, Search, X, LogOut, Wrench,
  Package, TrendingUp, AlertTriangle, CheckCircle,
  ChevronUp, ChevronDown, ChevronsUpDown, MessageCircle, Loader2,
  Bell, ShoppingCart, Users,
  Star, Zap, Tractor, Hammer, Shield, Droplets, Settings, Scissors,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProductModal } from "@/components/admin/ProductModal";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { formatPrice } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Product, ProductCategory } from "@/types";

const CATEGORIES: ProductCategory[] = [
  "Power Tools", "Agricultural Machinery", "Hand Tools", "Safety Equipment",
  "Irrigation & Water", "Spare Parts", "Garden & Landscaping", "Welding Equipment",
  "Measuring Tools",
];

const CATEGORY_ICONS: Record<ProductCategory, LucideIcon> = {
  "Power Tools": Zap,
  "Agricultural Machinery": Tractor,
  "Hand Tools": Hammer,
  "Safety Equipment": Shield,
  "Irrigation & Water": Droplets,
  "Spare Parts": Settings,
  "Garden & Landscaping": Scissors,
  "Welding Equipment": Wrench,
  "Measuring Tools": Package,
};

type SortKey = keyof Pick<Product, "name" | "category" | "price" | "stock">;
type SortDir = "asc" | "desc";

export default function AdminPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | "">("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  interface CartNotif {
    id: string;
    user_name: string;
    user_email: string;
    message_preview: string;
    conversation_id: string;
    created_at: string;
  }
  const [notifications, setNotifications] = useState<CartNotif[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function refreshProducts() {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => { setProducts(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  // Start fetching immediately on mount — don't wait for auth to resolve
  useEffect(() => {
    refreshProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user || user.role !== "admin") return;

    async function loadNotifs() {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("seen", false)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[Admin] Failed to load notifications:", error.message);
        return;
      }
      if (data) setNotifications(data as CartNotif[]);
    }

    loadNotifs();

    // Realtime subscription for instant updates
    const channel = supabase
      .channel("admin-notif-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, loadNotifs)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" }, loadNotifs)
      .subscribe();

    // Polling fallback every 15s in case realtime is not set up
    const poll = setInterval(loadNotifs, 15_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [user]);

  async function handleNotifClick(convId: string) {
    await supabase.from("notifications").update({ seen: true }).eq("conversation_id", convId);
    setNotifications((prev) => prev.filter((n) => n.conversation_id !== convId));
    setNotifOpen(false);
    router.push(`/admin/chat?conv=${convId}`);
  }

  async function handleClearAll() {
    await supabase.from("notifications").update({ seen: true }).eq("seen", false);
    setNotifications([]);
    setNotifOpen(false);
  }

  async function handleLogout() {
    await signOut();
    router.push("/");
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 text-slate-300" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-brand-orange" />
      : <ChevronDown className="h-3 w-3 text-brand-orange" />;
  }

  const filtered = useMemo(() => {
    let r = products;
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    if (categoryFilter) r = r.filter((p) => p.category === categoryFilter);
    return [...r].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      const cmp = typeof av === "string" ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [products, query, categoryFilter, sortKey, sortDir]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Product deleted.", variant: "success" });
      refreshProducts();
    } catch {
      toast({ title: "Failed to delete product.", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  }

  function handleSaved(_saved: Product) {
    refreshProducts();
  }

  // Stats
  const totalStock = products.reduce((s, p) => s + p.stock, 0);
  const outOfStock = products.filter((p) => p.stock <= 0).length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const inventoryValue = products.reduce((s, p) => s + p.price * Math.max(p.stock, 0), 0);

  if (authLoading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen industrial-grid-bg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
      </div>
    );
  }

  // ---- Dashboard ----
  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />

      {/* Top nav */}
      <header className="bg-brand-slate border-b border-white/5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-orange flex items-center justify-center">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            <span className="font-black text-white text-sm">DTT Admin</span>
            <span className="hidden sm:block text-white/20 text-xs">|</span>
            <span className="hidden sm:block text-white/40 text-xs">Inventory Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative flex items-center justify-center w-9 h-9 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Bell className="h-4 w-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-orange" />
                )}
              </button>
              {notifOpen && (
                <div className="fixed inset-0 z-50 bg-white flex flex-col sm:absolute sm:inset-auto sm:right-0 sm:top-11 sm:w-[min(320px,_calc(100vw_-_1rem))] sm:rounded-xl sm:shadow-2xl sm:border sm:border-slate-100 sm:overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <p className="font-bold text-brand-slate text-sm">Cart Notifications</p>
                    <div className="flex items-center gap-3">
                      {notifications.length > 0 && (
                        <button onClick={handleClearAll} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                          Clear all
                        </button>
                      )}
                      <button
                        onClick={() => setNotifOpen(false)}
                        className="sm:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  {/* Body */}
                  {notifications.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 text-center">
                      <ShoppingCart className="h-10 w-10 text-slate-200 mb-3" />
                      <p className="text-sm text-slate-400">No new order enquiries</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-50 sm:max-h-72">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleNotifClick(n.conversation_id)}
                          className="w-full text-left px-4 py-4 hover:bg-orange-50 transition-colors group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                              <ShoppingCart className="h-5 w-5 sm:h-4 sm:w-4 text-brand-orange" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-base sm:text-sm font-semibold text-brand-slate leading-tight">
                                {n.user_name}
                              </p>
                              <p className="text-sm sm:text-xs text-slate-500 mt-0.5 line-clamp-2">
                                {n.message_preview}
                              </p>
                            </div>
                            <span className="text-xs text-slate-300 group-hover:text-brand-orange transition-colors shrink-0 mt-1">
                              View →
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link href="/admin/users">
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10 gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:block">Users</span>
              </Button>
            </Link>
            <Link href="/admin/chat">
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10 gap-1.5 text-xs">
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:block">Chat</span>
              </Button>
            </Link>
            <Button
              onClick={() => { setEditTarget(null); setModalOpen(true); }}
              size="sm"
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:block">Add Product</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-white/50 hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Products", value: products.length, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Total Stock", value: totalStock.toLocaleString(), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
            { label: "Out of Stock", value: outOfStock, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
            { label: "Low Stock (≤5)", value: lowStock, icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-2xl font-black text-brand-slate">{stat.value}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Inventory value */}
        <div className="bg-brand-slate text-white rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-white/50 text-xs font-medium uppercase tracking-wider">Estimated Inventory Value</p>
            <p className="text-2xl font-black mt-0.5">{formatPrice(inventoryValue)}</p>
          </div>
          <CheckCircle className="h-8 w-8 text-brand-orange/30" />
        </div>

        {/* Table section */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h2 className="font-bold text-brand-slate">
              Products
              <span className="ml-2 text-sm font-normal text-slate-400">
                ({filtered.length}{products.length !== filtered.length ? ` of ${products.length}` : ""})
              </span>
            </h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or SKU…"
                  className="pl-9 h-9 text-sm"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as ProductCategory | "")}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-orange"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-slate-50">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 rounded bg-slate-100 animate-pulse w-3/4" />
                    <div className="h-3 rounded bg-slate-100 animate-pulse w-1/2" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No products found.</p>
              </div>
            ) : (
              filtered.map((p) => {
                const CatIcon = CATEGORY_ICONS[p.category] ?? Package;
                return (
                  <div key={p.id} className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-10 h-10 object-cover" />
                      ) : (
                        <CatIcon className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-brand-slate text-sm leading-tight line-clamp-1">{p.name}</p>
                        {p.featured
                          ? <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
                          : <Star className="h-3.5 w-3.5 text-slate-200 shrink-0" />
                        }
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{p.category} · {p.sku}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-sm font-bold text-brand-orange">{formatPrice(p.price)}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          p.stock <= 0 ? "bg-red-100 text-red-700" : p.stock <= 5 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                        }`}>
                          {p.stock <= 0 ? "Out" : `${p.stock} in stock`}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-11 w-11 text-slate-400 hover:text-brand-orange hover:bg-orange-50"
                        onClick={() => { setEditTarget(p); setModalOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-11 w-11 text-slate-400 hover:text-red-500 hover:bg-red-50"
                        onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="pl-4 pr-2 py-3 w-14" />
                  {[
                    { key: "name" as SortKey, label: "Product" },
                    { key: "category" as SortKey, label: "Category" },
                    { key: "price" as SortKey, label: "Price" },
                    { key: "stock" as SortKey, label: "Stock" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider cursor-pointer hover:text-brand-slate select-none"
                      onClick={() => handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <SortIcon col={col.key} />
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                    Featured
                  </th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 font-semibold tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 rounded bg-slate-100 animate-pulse w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400">
                      <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No products found.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const CatIcon = CATEGORY_ICONS[p.category] ?? Package;
                    return (
                      <motion.tr
                        key={p.id}
                        layout
                        className="hover:bg-slate-50/80 group"
                      >
                        <td className="pl-4 pr-2 py-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                            {p.image ? (
                              <img src={p.image} alt={p.name} className="w-10 h-10 object-cover" />
                            ) : (
                              <CatIcon className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-brand-slate leading-tight line-clamp-1">{p.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{p.sku}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">{p.category}</Badge>
                        </td>
                        <td className="px-4 py-3 font-bold text-brand-orange whitespace-nowrap">{formatPrice(p.price)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            p.stock <= 0 ? "bg-red-100 text-red-700" : p.stock <= 5 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                          }`}>
                            {p.stock <= 0 ? "Out" : p.stock}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.featured
                            ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            : <Star className="h-4 w-4 text-slate-200" />
                          }
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-brand-orange"
                              onClick={() => { setEditTarget(p); setModalOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-500"
                              onClick={() => setDeleteId(p.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Product modal */}
      <ProductModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        product={editTarget}
        onSaved={handleSaved}
      />

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setDeleteId(null)}
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className={[
                "fixed z-50 bg-white shadow-2xl",
                // Mobile: full-width bottom sheet
                "inset-x-0 bottom-0 rounded-t-2xl p-6 pb-10",
                // Desktop: small centered card
                "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2",
                "sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2",
                "sm:rounded-2xl sm:pb-6",
              ].join(" ")}
            >
              {/* Drag handle — mobile only */}
              <div className="w-12 h-1.5 rounded-full bg-slate-200 mx-auto mb-5 sm:hidden" aria-hidden="true" />

              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-7 w-7 text-red-600" />
              </div>
              <h3 className="text-center font-black text-brand-slate text-xl mb-2">
                Delete Product?
              </h3>
              <p className="text-center text-slate-500 text-sm mb-6 leading-relaxed">
                This action cannot be undone. The product will be permanently removed.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" className="flex-1 h-12 text-base" onClick={() => setDeleteId(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 h-12 text-base"
                  onClick={() => handleDelete(deleteId)}
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
