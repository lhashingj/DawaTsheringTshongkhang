"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Hammer, Tractor, Shield, Droplets, Wrench, Zap,
  Scissors, Settings, ArrowRight,
} from "lucide-react";
import type { ProductCategory } from "@/types";

interface CategoryItem {
  name: ProductCategory;
  icon: React.ComponentType<{ className?: string }>;
  count: string;
  color: string;
  bg: string;
}

const CATEGORIES: CategoryItem[] = [
  { name: "Power Tools", icon: Zap, count: "30+ items", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" },
  { name: "Agricultural Machinery", icon: Tractor, count: "20+ items", color: "text-green-600", bg: "bg-green-50 border-green-100" },
  { name: "Hand Tools", icon: Hammer, count: "40+ items", color: "text-brand-orange", bg: "bg-orange-50 border-orange-100" },
  { name: "Safety Equipment", icon: Shield, count: "15+ items", color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
  { name: "Irrigation & Water", icon: Droplets, count: "20+ items", color: "text-cyan-600", bg: "bg-cyan-50 border-cyan-100" },
  { name: "Spare Parts", icon: Settings, count: "50+ items", color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
  { name: "Garden & Landscaping", icon: Scissors, count: "15+ items", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
  { name: "Welding Equipment", icon: Wrench, count: "10+ items", color: "text-red-600", bg: "bg-red-50 border-red-100" },
];

export function CategorySection() {
  return (
    <section id="categories" className="py-20 bg-slate-50">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          className="text-center mb-12"
        >
          <h2 className="section-heading">Shop by Category</h2>
          <p className="section-subheading mx-auto">
            From heavy agricultural machinery to precision hand tools — everything you need, under one roof.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -4 }}
            >
              <Link
                href={`/products?category=${encodeURIComponent(cat.name)}`}
                className={`flex flex-col items-center gap-3 p-5 rounded-2xl border ${cat.bg} hover:shadow-lg transition-all duration-300 group`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cat.color} bg-white shadow-sm group-hover:scale-110 transition-transform`}>
                  <cat.icon className={`h-6 w-6 ${cat.color}`} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-brand-slate text-sm leading-tight">
                    {cat.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{cat.count}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-brand-orange font-semibold hover:gap-3 transition-all"
          >
            View all products
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
