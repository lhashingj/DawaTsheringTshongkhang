"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, Search, X, LogOut, Wrench,
  Package, TrendingUp, AlertTriangle, CheckCircle,
  ChevronUp, ChevronDown, ChevronsUpDown, ArrowLeft, MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProductModal } from "@/components/admin/ProductModal";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { formatPrice } from "@/lib/utils";
import type { Product, ProductCategory } from "@/types";

const ADMIN_PASSWORD = "admin123";

const CATEGORIES: ProductCategory[] = [
  "Power Tools", "Agricultural Machinery", "Hand Tools", "Safety Equipment",
  "Irrigation & Water", "Spare Parts", "Garden & Landscaping", "Welding Equipment",
  "Measuring Tools",
];

type SortKey = keyof Pick<Product, "name" | "category" | "price" | "stock">;
type SortDir = "asc" | "desc";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | "">("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const a = sessionStorage.getItem("dtt-admin");
    if (a === "true") setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => { setProducts(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [authed]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem("dtt-admin", "true");
      setAuthed(true);
    } else {
      setAuthError("Incorrect password.");
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("dtt-admin");
    setAuthed(false);
    setPassword("");
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
      setProducts((p) => p.filter((x) => x.id !== id));
      toast({ title: "Product deleted.", variant: "success" });
    } catch {
      toast({ title: "Failed to delete product.", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  }

  function handleSaved(saved: Product) {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  }

  // Stats
  const totalStock = products.reduce((s, p) => s + p.stock, 0);
  const outOfStock = products.filter((p) => p.stock <= 0).length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const inventoryValue = products.reduce((s, p) => s + p.price * Math.max(p.stock, 0), 0);

  // ---- Login screen ----
  if (!authed) {
    return (
      <div className="min-h-screen industrial-grid-bg flex items-center justify-center p-4">
        <Toaster />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-brand-orange transition-colors mb-6 -mt-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-black text-brand-slate text-base leading-none">DTT Admin</p>
              <p className="text-slate-400 text-xs mt-0.5">Inventory Management</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setAuthError(""); }}
                placeholder="Enter admin password"
                autoFocus
              />
              {authError && (
                <p className="text-xs text-red-500 font-medium">{authError}</p>
              )}
            </div>
            <Button type="submit" className="w-full" size="lg">
              Sign In
            </Button>
          </form>
          <p className="text-xs text-slate-300 text-center mt-6">
            Default password: admin123
          </p>
        </motion.div>
      </div>
    );
  }

  // ---- Dashboard ----
  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />

      {/* Sidebar / Top nav */}
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

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
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
                          <div className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
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
                  filtered.map((p) => (
                    <motion.tr
                      key={p.id}
                      layout
                      className="hover:bg-slate-50/80 group"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-brand-slate leading-tight line-clamp-1">
                            {p.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{p.sku}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs whitespace-nowrap">
                          {p.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-bold text-brand-orange whitespace-nowrap">
                        {formatPrice(p.price)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            p.stock <= 0
                              ? "bg-red-100 text-red-700"
                              : p.stock <= 5
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {p.stock <= 0 ? "Out" : p.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-400 hover:text-brand-orange"
                            onClick={() => { setEditTarget(p); setModalOpen(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-400 hover:text-red-500"
                            onClick={() => setDeleteId(p.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
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
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-center font-black text-brand-slate text-lg mb-2">
                Delete Product?
              </h3>
              <p className="text-center text-slate-500 text-sm mb-6">
                This action cannot be undone. The product will be permanently removed from the database.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
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
