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
  hoverBorder: string;
}

const CATEGORIES: CategoryItem[] = [
  { name: "Power Tools", icon: Zap, count: "30+ items", color: "text-yellow-400", bg: "bg-yellow-500/20", hoverBorder: "hover:border-yellow-500/50" },
  { name: "Agricultural Machinery", icon: Tractor, count: "20+ items", color: "text-green-400", bg: "bg-green-500/20", hoverBorder: "hover:border-green-500/50" },
  { name: "Hand Tools", icon: Hammer, count: "40+ items", color: "text-orange-400", bg: "bg-orange-500/20", hoverBorder: "hover:border-orange-500/50" },
  { name: "Safety Equipment", icon: Shield, count: "15+ items", color: "text-blue-400", bg: "bg-blue-500/20", hoverBorder: "hover:border-blue-500/50" },
  { name: "Irrigation & Water", icon: Droplets, count: "20+ items", color: "text-cyan-400", bg: "bg-cyan-500/20", hoverBorder: "hover:border-cyan-500/50" },
  { name: "Spare Parts", icon: Settings, count: "50+ items", color: "text-slate-300", bg: "bg-slate-500/20", hoverBorder: "hover:border-slate-500/50" },
  { name: "Garden & Landscaping", icon: Scissors, count: "15+ items", color: "text-emerald-400", bg: "bg-emerald-500/20", hoverBorder: "hover:border-emerald-500/50" },
  { name: "Welding Equipment", icon: Wrench, count: "10+ items", color: "text-red-400", bg: "bg-red-500/20", hoverBorder: "hover:border-red-500/50" },
];

export function CategorySection() {
  return (
    <section id="categories" className="py-20 md:py-28 bg-slate-900">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">Shop by Category</h2>
          <p className="text-slate-400 text-base mt-3 max-w-2xl leading-relaxed mx-auto">
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
            >
              <Link
                href={`/products?category=${encodeURIComponent(cat.name)}`}
                className={`
                  flex flex-col items-center gap-3 p-5 rounded-2xl
                  bg-slate-800 border border-slate-700 ${cat.hoverBorder}
                  hover:shadow-lg hover:-translate-y-1
                  transition-all duration-200 cursor-pointer group
                `}
              >
                <div className={`w-14 h-14 rounded-2xl ${cat.bg} flex items-center justify-center transition-shadow duration-200`}>
                  <cat.icon className={`h-7 w-7 ${cat.color}`} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-white text-sm leading-tight">
                    {cat.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">{cat.count}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-brand-orange font-semibold hover:gap-3 transition-all duration-200 cursor-pointer"
          >
            View all products
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
