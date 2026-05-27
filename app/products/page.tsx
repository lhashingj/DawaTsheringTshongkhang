"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, SlidersHorizontal, X, Package,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductCard } from "@/components/products/ProductCard";
import type { Product, ProductCategory } from "@/types";

const CATEGORIES: ProductCategory[] = [
  "Power Tools",
  "Agricultural Machinery",
  "Hand Tools",
  "Safety Equipment",
  "Irrigation & Water",
  "Spare Parts",
  "Garden & Landscaping",
  "Welding Equipment",
  "Measuring Tools",
];

const SORT_OPTIONS = [
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "price-asc", label: "Price (Low to High)" },
  { value: "price-desc", label: "Price (High to Low)" },
  { value: "stock-desc", label: "In Stock First" },
];

const inputCls = "w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-400 transition-colors";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<ProductCategory>>(new Set());
  const [sort, setSort] = useState("name-asc");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("category") as ProductCategory | null;
    if (cat && CATEGORIES.includes(cat)) {
      setActiveCategories(new Set([cat]));
    }
  }, []);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = products;

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    }

    if (activeCategories.size > 0) {
      result = result.filter((p) => activeCategories.has(p.category));
    }

    if (inStockOnly) {
      result = result.filter((p) => p.stock > 0);
    }

    result = [...result].sort((a, b) => {
      switch (sort) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "price-asc": return a.price - b.price;
        case "price-desc": return b.price - a.price;
        case "stock-desc": return b.stock - a.stock;
        default: return 0;
      }
    });

    return result;
  }, [products, query, activeCategories, inStockOnly, sort]);

  function toggleCategory(cat: ProductCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setActiveCategories(new Set());
    setInStockOnly(false);
    setSort("name-asc");
  }

  const hasFilters = query || activeCategories.size > 0 || inStockOnly;

  return (
    <>
      <Header />
      <div className="bg-slate-950 min-h-[200px] flex items-end pb-8 pt-28">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3"
          >
            <div>
              <p className="text-brand-orange text-xs font-bold uppercase tracking-widest mb-2">
                Inventory
              </p>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                All Products
              </h1>
              <p className="text-white/40 mt-1 text-sm">
                {loading ? "Loading…" : `${filtered.length} of ${products.length} items`}
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      <main className="bg-slate-900 min-h-screen">
        <div className="container py-8">
          {/* Search & filter bar */}
          <div className="flex flex-col gap-3 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or SKU…"
                className={`${inputCls} pl-9 h-11`}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="flex items-center gap-2 bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white h-11 px-4 rounded-lg text-sm font-medium transition-colors flex-1 sm:flex-none"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeCategories.size > 0 && (
                  <span className="ml-1 w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {activeCategories.size}
                  </span>
                )}
              </button>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="flex-1 h-11 rounded-lg border border-slate-600 bg-slate-700 px-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-6"
              >
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm text-white">Categories</h3>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inStockOnly}
                          onChange={(e) => setInStockOnly(e.target.checked)}
                          className="rounded accent-brand-orange"
                        />
                        In stock only
                      </label>
                      {hasFilters && (
                        <button
                          onClick={clearFilters}
                          className="text-xs text-red-400 hover:text-red-300 font-medium"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          activeCategories.has(cat)
                            ? "bg-brand-orange text-white border-brand-orange"
                            : "bg-slate-700 text-slate-300 border-slate-600 hover:border-orange-500 hover:text-orange-400"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active filters chips */}
          {hasFilters && (
            <div className="flex flex-wrap gap-2 mb-6">
              {[...activeCategories].map((cat) => (
                <span key={cat} className="inline-flex items-center gap-1 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-full px-3 py-1 font-medium">
                  {cat}
                  <button onClick={() => toggleCategory(cat)}><X className="h-3 w-3" /></button>
                </span>
              ))}
              {inStockOnly && (
                <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-400 border border-green-500/30 rounded-full px-3 py-1 font-medium">
                  In Stock
                  <button onClick={() => setInStockOnly(false)}><X className="h-3 w-3" /></button>
                </span>
              )}
            </div>
          )}

          {/* Products grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-64 rounded-2xl bg-slate-700 animate-pulse" />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-24">
              <Package className="h-16 w-16 mx-auto text-slate-700 mb-4" />
              <p className="text-xl font-bold text-white">No products found</p>
              <p className="text-slate-400 text-sm mt-2">
                Try adjusting your search or filters.
              </p>
              <button
                onClick={clearFilters}
                className="mt-6 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
