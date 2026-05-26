"use client";

import { useState } from "react";
import type React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Package, Zap, Tractor, Hammer, Shield,
  Droplets, Settings, Scissors, Wrench, Star, ZoomIn, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCart } from "@/context/CartContext";
import { toast } from "@/hooks/use-toast";
import { formatPrice, cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { Product, ProductCategory } from "@/types";

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
  "Power Tools": "text-yellow-500 bg-yellow-50",
  "Agricultural Machinery": "text-green-600 bg-green-50",
  "Hand Tools": "text-orange-500 bg-orange-50",
  "Safety Equipment": "text-blue-600 bg-blue-50",
  "Irrigation & Water": "text-cyan-600 bg-cyan-50",
  "Spare Parts": "text-slate-500 bg-slate-100",
  "Garden & Landscaping": "text-emerald-600 bg-emerald-50",
  "Welding Equipment": "text-red-500 bg-red-50",
  "Measuring Tools": "text-purple-600 bg-purple-50",
};

interface ProductCardProps {
  product: Product;
  index?: number;
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const { addItem, items } = useCart();
  const [open, setOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const Icon = CATEGORY_ICONS[product.category] ?? Package;
  const colorClass = CATEGORY_COLORS[product.category] ?? "text-slate-500 bg-slate-100";
  const inCart = items.some((i) => i.product.id === product.id);
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const isOutOfStock = product.stock <= 0;

  function handleAddToCart(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (isOutOfStock) return;
    addItem(product);
    toast({ title: "Added to cart!", description: product.name, variant: "success" });
  }

  const iconColor = colorClass.split(" ")[0];
  const bgColor = colorClass.split(" ")[1];

  return (
    <>
      {/* Card */}
      <motion.div
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4, delay: (index % 6) * 0.07 }}
        className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden cursor-pointer"
        style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" }}
        whileHover={{
          y: -5,
          boxShadow: "0 12px 32px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)",
          transition: { duration: 0.2 },
        }}
      >
        {/* Featured badge */}
        {product.featured && (
          <div className="absolute top-3 left-3 z-10">
            <Badge className="bg-brand-orange text-white border-none gap-1 text-[10px] px-2 py-0.5 shadow-sm">
              <Star className="h-2.5 w-2.5 fill-white" />
              Featured
            </Badge>
          </div>
        )}

        {/* Stock badge */}
        {isLowStock && (
          <div className="absolute top-3 right-3 z-10">
            <Badge variant="warning" className="text-[10px] px-2 py-0.5">Low Stock</Badge>
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute top-3 right-3 z-10">
            <Badge variant="destructive" className="text-[10px] px-2 py-0.5">Out of Stock</Badge>
          </div>
        )}

        {/* Image area */}
        <div className={cn("relative h-44 flex items-center justify-center overflow-hidden", product.image ? "bg-white" : bgColor)}>
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <motion.div
              whileHover={{ scale: 1.08, rotate: 4 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Icon className={cn("h-16 w-16 opacity-40", iconColor)} strokeWidth={1.2} />
            </motion.div>
          )}
          {/* Category label */}
          <div className="absolute bottom-2 left-3 z-10">
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider", product.image ? "text-slate-400" : "text-slate-400")}>
              {product.category}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-4">
          <h3 className="font-bold text-brand-slate text-sm leading-snug line-clamp-2 group-hover:text-brand-orange transition-colors duration-200">
            {product.name}
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 flex-1 leading-relaxed">
            {product.description}
          </p>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
            <div>
              <p className="text-lg font-extrabold text-brand-orange leading-none">
                {formatPrice(product.price)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">per {product.unit}</p>
            </div>
            <Button
              size="sm"
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className={cn("gap-1.5 text-xs h-9 px-3 cursor-pointer", inCart && "bg-green-600 hover:bg-green-700")}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              {inCart ? "In Cart" : "Add"}
            </Button>
          </div>
          <p className="text-[10px] text-slate-300 mt-1.5 text-right">SKU: {product.sku}</p>
        </div>
      </motion.div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && product.image && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
            onClick={(e) => { e.stopPropagation(); setLightbox(false); }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className="relative max-w-3xl max-h-[90dvh] w-full h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 800px"
                priority
              />
            </motion.div>
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox(false); }}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs font-medium text-center px-4">
              {product.name}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Detail Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
          <div className="flex flex-col sm:flex-row max-h-[90vh] sm:max-h-[80vh]">

            {/* Image panel */}
            <div className="sm:w-[44%] shrink-0 bg-slate-50 flex items-center justify-center p-8 min-h-[220px] sm:min-h-0">
              {product.image ? (
                <button
                  onClick={() => setLightbox(true)}
                  className="relative w-full aspect-square max-w-[260px] mx-auto group/img cursor-zoom-in rounded-lg overflow-hidden focus:outline-none"
                  aria-label="View full image"
                >
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-contain group-hover/img:scale-105 transition-transform duration-300"
                    sizes="300px"
                    priority
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                    <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
                  </div>
                </button>
              ) : (
                <Icon className={cn("h-28 w-28 opacity-25", iconColor)} strokeWidth={1.2} />
              )}
            </div>

            {/* Details panel */}
            <div className="flex-1 flex flex-col p-6 overflow-y-auto">
              {/* Category chip */}
              <span className={cn("self-start text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full", colorClass)}>
                {product.category}
              </span>

              <DialogTitle className="text-xl font-black text-brand-slate mt-2 leading-tight">
                {product.name}
              </DialogTitle>

              <p className="text-xs text-slate-400 mt-1 mb-3">SKU: {product.sku}</p>

              <p className="text-sm text-slate-500 leading-relaxed flex-1">
                {product.description}
              </p>

              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="text-3xl font-black text-brand-orange leading-none">
                      {formatPrice(product.price)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">per {product.unit}</p>
                  </div>
                  <div className="text-right space-y-1">
                    {isLowStock && <Badge variant="warning" className="text-[10px]">Low Stock</Badge>}
                    {isOutOfStock && <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>}
                    {!isLowStock && !isOutOfStock && (
                      <span className="text-xs text-green-600 font-semibold">{product.stock} in stock</span>
                    )}
                  </div>
                </div>

                <Button
                  size="lg"
                  className={cn(
                    "w-full gap-2 cursor-pointer shadow-lg shadow-orange-500/20",
                    inCart && "bg-green-600 hover:bg-green-700 shadow-green-500/20"
                  )}
                  disabled={isOutOfStock}
                  onClick={() => handleAddToCart()}
                >
                  <ShoppingCart className="h-4 w-4" />
                  {isOutOfStock ? "Out of Stock" : inCart ? "Added to Cart" : "Add to Cart"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
