"use client";

import { motion } from "framer-motion";
import {
  ShoppingCart, Package, Zap, Tractor, Hammer, Shield,
  Droplets, Settings, Scissors, Wrench, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const Icon = CATEGORY_ICONS[product.category] ?? Package;
  const colorClass = CATEGORY_COLORS[product.category] ?? "text-slate-500 bg-slate-100";
  const inCart = items.some((i) => i.product.id === product.id);
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const isOutOfStock = product.stock <= 0;

  function handleAddToCart() {
    if (isOutOfStock) return;
    addItem(product);
    toast({
      title: "Added to cart!",
      description: product.name,
      variant: "success",
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: (index % 6) * 0.07 }}
      whileHover={{ y: -4 }}
      className="group relative flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
    >
      {/* Featured indicator */}
      {product.featured && (
        <div className="absolute top-3 left-3 z-10">
          <Badge className="bg-brand-orange text-white border-none gap-1 text-[10px] px-2 py-0.5">
            <Star className="h-2.5 w-2.5 fill-white" />
            Featured
          </Badge>
        </div>
      )}

      {/* Stock badge */}
      {isLowStock && (
        <div className="absolute top-3 right-3 z-10">
          <Badge variant="warning" className="text-[10px] px-2 py-0.5">
            Low Stock
          </Badge>
        </div>
      )}
      {isOutOfStock && (
        <div className="absolute top-3 right-3 z-10">
          <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
            Out of Stock
          </Badge>
        </div>
      )}

      {/* Graphic area */}
      <div className={cn(
        "relative h-40 flex items-center justify-center",
        colorClass.split(" ")[1]
      )}>
        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Icon className={cn("h-16 w-16 opacity-50", colorClass.split(" ")[0])} strokeWidth={1.2} />
        </motion.div>
        {/* Category label */}
        <div className="absolute bottom-2 left-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {product.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4">
        <h3 className="font-bold text-brand-slate text-sm leading-tight line-clamp-2 group-hover:text-brand-orange transition-colors">
          {product.name}
        </h3>
        <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 flex-1 leading-relaxed">
          {product.description}
        </p>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
          <div>
            <p className="text-lg font-black text-brand-orange">
              {formatPrice(product.price)}
            </p>
            <p className="text-[10px] text-slate-400">per {product.unit}</p>
          </div>
          <Button
            size="sm"
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={cn(
              "gap-1.5 text-xs",
              inCart && "bg-green-600 hover:bg-green-700"
            )}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {inCart ? "In Cart" : "Add"}
          </Button>
        </div>

        <p className="text-[10px] text-slate-300 mt-1.5 text-right">
          SKU: {product.sku}
        </p>
      </div>
    </motion.div>
  );
}
