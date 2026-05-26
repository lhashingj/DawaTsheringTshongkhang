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
  hoverRing: string;
}

const CATEGORIES: CategoryItem[] = [
  { name: "Power Tools", icon: Zap, count: "30+ items", color: "text-yellow-600", bg: "bg-yellow-50", hoverRing: "hover:ring-yellow-200" },
  { name: "Agricultural Machinery", icon: Tractor, count: "20+ items", color: "text-green-600", bg: "bg-green-50", hoverRing: "hover:ring-green-200" },
  { name: "Hand Tools", icon: Hammer, count: "40+ items", color: "text-brand-orange", bg: "bg-orange-50", hoverRing: "hover:ring-orange-200" },
  { name: "Safety Equipment", icon: Shield, count: "15+ items", color: "text-blue-600", bg: "bg-blue-50", hoverRing: "hover:ring-blue-200" },
  { name: "Irrigation & Water", icon: Droplets, count: "20+ items", color: "text-cyan-600", bg: "bg-cyan-50", hoverRing: "hover:ring-cyan-200" },
  { name: "Spare Parts", icon: Settings, count: "50+ items", color: "text-slate-600", bg: "bg-slate-100", hoverRing: "hover:ring-slate-200" },
  { name: "Garden & Landscaping", icon: Scissors, count: "15+ items", color: "text-emerald-600", bg: "bg-emerald-50", hoverRing: "hover:ring-emerald-200" },
  { name: "Welding Equipment", icon: Wrench, count: "10+ items", color: "text-red-600", bg: "bg-red-50", hoverRing: "hover:ring-red-200" },
];

export function CategorySection() {
  return (
    <section id="categories" className="py-20 md:py-28 bg-slate-50">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          className="text-center mb-14"
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
            >
              <Link
                href={`/products?category=${encodeURIComponent(cat.name)}`}
                className={`
                  flex flex-col items-center gap-3 p-5 rounded-2xl
                  bg-white border border-slate-200
                  ring-2 ring-transparent ${cat.hoverRing}
                  hover:shadow-lg hover:-translate-y-1
                  transition-all duration-200 cursor-pointer group
                `}
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
              >
                <div className={`w-14 h-14 rounded-2xl ${cat.bg} flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-200`}>
                  <cat.icon className={`h-7 w-7 ${cat.color}`} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-brand-slate text-sm leading-tight">
                    {cat.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">{cat.count}</p>
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
