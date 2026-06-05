"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, Search, X, LogOut, Wrench,
  Package, TrendingUp, AlertTriangle, CheckCircle,
  ChevronUp, ChevronDown, ChevronsUpDown, MessageCircle, Loader2,
  Bell, ShoppingCart, Users, Home,
  Star, Zap, Tractor, Hammer, Shield, Droplets, Settings, Scissors,
  BarChart3, Calculator,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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

const CATEGORY_COLORS: Record<ProductCategory, string> = {
  "Power Tools": "bg-yellow-500/20 text-yellow-400",
  "Agricultural Machinery": "bg-green-500/20 text-green-400",
  "Hand Tools": "bg-orange-500/20 text-orange-400",
  "Safety Equipment": "bg-red-500/20 text-red-400",
  "Irrigation & Water": "bg-blue-500/20 text-blue-400",
  "Spare Parts": "bg-slate-500/30 text-slate-300",
  "Garden & Landscaping": "bg-emerald-500/20 text-emerald-400",
  "Welding Equipment": "bg-purple-500/20 text-purple-400",
  "Measuring Tools": "bg-cyan-500/20 text-cyan-400",
};

type SortKey = keyof Pick<Product, "name" | "category" | "price" | "stock">;
type SortDir = "asc" | "desc";

const inputCls =
  "w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-400";

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
  const [importing, setImporting] = useState(false);

  async function handleBulkImport() {
    if (!confirm("Import all inventory items from the PDF stock list? Existing products will not be duplicated.")) return;
    setImporting(true);
    try {
      const res = await fetch("/api/admin/import-inventory", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: `Imported ${data.added} new products`, description: `${data.total} items processed from inventory list.` });
      refreshProducts();
    } catch (err: unknown) {
      toast({ title: "Import failed", description: (err as { message?: string }).message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

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

    const channel = supabase
      .channel("admin-notif-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, loadNotifs)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" }, loadNotifs)
      .subscribe();

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
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 text-slate-500" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-orange-400" />
      : <ChevronDown className="h-3 w-3 text-orange-400" />;
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

  return (
    <div className="min-h-screen bg-slate-900">
      <Toaster />

      {/* Top nav */}
      <header className="bg-slate-950 border-b border-slate-700/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-white shrink-0">
              <img src="/logo.png" alt="DTT Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-black text-white text-sm">DTT Admin</span>
            <span className="hidden sm:block text-slate-600 text-xs">|</span>
            <span className="hidden sm:block text-slate-500 text-xs">Product Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative flex items-center justify-center w-9 h-9 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <Bell className="h-4 w-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500" />
                )}
              </button>
              {notifOpen && (
                <div className="fixed inset-0 z-50 bg-slate-800 flex flex-col sm:absolute sm:inset-auto sm:right-0 sm:top-11 sm:w-[min(320px,_calc(100vw_-_1rem))] sm:rounded-xl sm:shadow-2xl sm:border sm:border-slate-700 sm:overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between shrink-0">
                    <p className="font-bold text-white text-sm">Cart Notifications</p>
                    <div className="flex items-center gap-3">
                      {notifications.length > 0 && (
                        <button onClick={handleClearAll} className="text-xs text-slate-400 hover:text-red-400 transition-colors">
                          Clear all
                        </button>
                      )}
                      <button
                        onClick={() => setNotifOpen(false)}
                        className="sm:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 text-center">
                      <ShoppingCart className="h-10 w-10 text-slate-600 mb-3" />
                      <p className="text-sm text-slate-500">No new order enquiries</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-700 sm:max-h-72">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleNotifClick(n.conversation_id)}
                          className="w-full text-left px-4 py-4 hover:bg-slate-700/50 transition-colors group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                              <ShoppingCart className="h-5 w-5 sm:h-4 sm:w-4 text-orange-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-base sm:text-sm font-semibold text-white leading-tight">{n.user_name}</p>
                              <p className="text-sm sm:text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message_preview}</p>
                            </div>
                            <span className="text-xs text-slate-500 group-hover:text-orange-400 transition-colors shrink-0 mt-1">View →</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link href="/admin/users">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 text-xs transition-colors">
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:block">Users</span>
              </button>
            </Link>
            <Link href="/admin/chat">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 text-xs transition-colors">
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:block">Chat</span>
              </button>
            </Link>
            <Link href="/admin/accounting">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 border border-slate-700 hover:border-orange-500/40 text-xs transition-colors">
                <Calculator className="h-3.5 w-3.5" />
                <span className="hidden sm:block">Accounting</span>
              </button>
            </Link>
            <button
              onClick={handleBulkImport}
              disabled={importing}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-slate-200 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border border-slate-600"
              title="Import all products from PDF inventory list"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
              <span className="hidden sm:block">{importing ? "Importing…" : "Import Inventory"}</span>
            </button>
            <button
              onClick={() => { setEditTarget(null); setModalOpen(true); }}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:block">Add Product</span>
            </button>
            <Link href="/">
              <button
                className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                title="Back to Home"
              >
                <Home className="h-4 w-4" />
              </button>
            </Link>
            <button
              onClick={handleLogout}
              className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Page heading */}
        <div>
          <h1 className="text-white text-2xl font-bold">Product Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Dawa Tshering Tshongkhang — Inventory &amp; Catalog Management</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Products", value: String(products.length), sub: "in catalog", color: "bg-blue-500/20 text-blue-400", icon: Package },
            { label: "Total Stock Units", value: totalStock.toLocaleString(), sub: "across all products", color: "bg-green-500/20 text-green-400", icon: TrendingUp },
            { label: "Out of Stock", value: String(outOfStock), sub: outOfStock > 0 ? "need restocking" : "all stocked", color: outOfStock > 0 ? "bg-red-500/20 text-red-400" : "bg-slate-600/30 text-slate-400", icon: AlertTriangle },
            { label: "Low Stock (≤5)", value: String(lowStock), sub: lowStock > 0 ? "reorder soon" : "levels fine", color: lowStock > 0 ? "bg-yellow-500/20 text-yellow-400" : "bg-slate-600/30 text-slate-400", icon: AlertTriangle },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-400 text-sm">{stat.label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-white text-2xl font-bold font-mono">{stat.value}</p>
              <p className="text-slate-500 text-xs mt-1">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Inventory value banner */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-orange-400/80 text-xs font-medium uppercase tracking-wider">Estimated Inventory Value</p>
            <p className="text-white text-2xl font-bold font-mono mt-1">{formatPrice(inventoryValue)}</p>
            <p className="text-slate-400 text-xs mt-1">{products.length} products · {totalStock.toLocaleString()} units</p>
          </div>
          <CheckCircle className="h-10 w-10 text-orange-500/30 shrink-0" />
        </div>

        {/* Category quick filter pills */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCategoryFilter("")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              categoryFilter === "" ? "bg-orange-500 text-white" : "bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600"
            }`}
          >
            All ({products.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = products.filter(p => p.category === cat).length;
            const Icon = CATEGORY_ICONS[cat];
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat === categoryFilter ? "" : cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  categoryFilter === cat
                    ? "bg-orange-500 text-white"
                    : "bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600"
                }`}
              >
                <Icon className="w-3 h-3" />
                {cat.split(" ")[0]} ({count})
              </button>
            );
          })}
        </div>

        {/* Table section */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h2 className="font-bold text-white">
              Products
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({filtered.length}{products.length !== filtered.length ? ` of ${products.length}` : ""})
              </span>
            </h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or SKU…"
                  className={inputCls + " pl-9"}
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as ProductCategory | "")}
                className="bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-slate-700/50">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-700 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 rounded bg-slate-700 animate-pulse w-3/4" />
                    <div className="h-3 rounded bg-slate-700 animate-pulse w-1/2" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No products found.</p>
              </div>
            ) : (
              filtered.map((p) => {
                const CatIcon = CATEGORY_ICONS[p.category] ?? Package;
                const catColor = CATEGORY_COLORS[p.category] ?? "bg-slate-600/30 text-slate-400";
                return (
                  <div key={p.id} className="p-4 flex items-center gap-3 hover:bg-slate-700/30 transition-colors">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-700 flex items-center justify-center shrink-0">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-10 h-10 object-cover" />
                      ) : (
                        <CatIcon className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-white text-sm leading-tight line-clamp-1">{p.name}</p>
                        {p.featured && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{p.category} · {p.sku}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-sm font-bold text-orange-400 font-mono">{formatPrice(p.price)}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          p.stock <= 0 ? "bg-red-500/20 text-red-400" : p.stock <= 5 ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"
                        }`}>
                          {p.stock <= 0 ? "Out" : `${p.stock} in stock`}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        className="h-11 w-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                        onClick={() => { setEditTarget(p); setModalOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="h-11 w-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        onClick={() => setDeleteId(p.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
                <tr className="border-b border-slate-700 bg-slate-800/80">
                  <th className="pl-4 pr-2 py-3 w-14" />
                  {[
                    { key: "name" as SortKey, label: "Product" },
                    { key: "category" as SortKey, label: "Category" },
                    { key: "price" as SortKey, label: "Price" },
                    { key: "stock" as SortKey, label: "Stock" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left font-semibold text-slate-400 text-xs uppercase tracking-wider cursor-pointer hover:text-white select-none transition-colors"
                      onClick={() => handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <SortIcon col={col.key} />
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs uppercase text-slate-400 font-semibold tracking-wider">Featured</th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-400 font-semibold tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 rounded bg-slate-700 animate-pulse w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-500">
                      <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No products found.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const CatIcon = CATEGORY_ICONS[p.category] ?? Package;
                    const catColor = CATEGORY_COLORS[p.category] ?? "bg-slate-600/30 text-slate-400";
                    return (
                      <motion.tr
                        key={p.id}
                        layout
                        className="hover:bg-slate-700/30 group transition-colors"
                      >
                        <td className="pl-4 pr-2 py-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-700 flex items-center justify-center">
                            {p.image ? (
                              <img src={p.image} alt={p.name} className="w-10 h-10 object-cover" />
                            ) : (
                              <CatIcon className="h-5 w-5 text-slate-500" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-white leading-tight line-clamp-1">{p.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5 font-mono">{p.sku}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${catColor}`}>
                            <CatIcon className="w-3 h-3" />
                            {p.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-orange-400 whitespace-nowrap font-mono">{formatPrice(p.price)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            p.stock <= 0 ? "bg-red-500/20 text-red-400" : p.stock <= 5 ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"
                          }`}>
                            {p.stock <= 0 ? "Out" : p.stock}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.featured
                            ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            : <Star className="h-4 w-4 text-slate-700" />
                          }
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                              onClick={() => { setEditTarget(p); setModalOpen(true); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              onClick={() => setDeleteId(p.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              onClick={() => setDeleteId(null)}
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className={[
                "fixed z-50 bg-slate-800 border border-slate-700 shadow-2xl",
                "inset-x-0 bottom-0 rounded-t-2xl p-6 pb-10",
                "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2",
                "sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2",
                "sm:rounded-2xl sm:pb-6",
              ].join(" ")}
            >
              <div className="w-12 h-1.5 rounded-full bg-slate-600 mx-auto mb-5 sm:hidden" aria-hidden="true" />
              <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-7 w-7 text-red-400" />
              </div>
              <h3 className="text-center font-black text-white text-xl mb-2">Delete Product?</h3>
              <p className="text-center text-slate-400 text-sm mb-6 leading-relaxed">
                This action cannot be undone. The product will be permanently removed.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex-1 h-12 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors text-sm font-medium"
                  onClick={() => setDeleteId(null)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors text-sm font-medium"
                  onClick={() => handleDelete(deleteId)}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
