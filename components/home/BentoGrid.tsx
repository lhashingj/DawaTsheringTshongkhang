"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShoppingCart, Star } from "lucide-react";
import { ProductCard } from "@/components/products/ProductCard";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types";

interface BentoGridProps {
  products: Product[];
}

export function BentoGrid({ products }: BentoGridProps) {
  const featured = products.filter((p) => p.featured).slice(0, 8);

  return (
    <section className="py-20 bg-white">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12"
        >
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-0.5 bg-brand-orange" />
              <span className="text-xs font-bold uppercase tracking-widest text-brand-orange">
                Top Picks
              </span>
            </div>
            <h2 className="section-heading">Featured Products</h2>
            <p className="text-slate-500 mt-2 max-w-xl">
              Our best-selling tools and machinery trusted by Bhutan&apos;s farmers, builders, and craftsmen.
            </p>
          </div>
          <Button asChild variant="outline" className="shrink-0 border-brand-slate text-brand-slate gap-2">
            <Link href="/products">
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {featured.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>

        {featured.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No featured products yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}
