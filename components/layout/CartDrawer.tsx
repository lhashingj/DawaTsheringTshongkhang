"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, ShoppingCart, Minus, Plus, Trash2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/utils";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, totalItems, totalPrice, clearCart } =
    useCart();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-brand-slate">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-brand-orange" />
                <h2 className="text-lg font-bold text-white">Your Cart</h2>
                {totalItems > 0 && (
                  <Badge className="bg-brand-orange text-white border-none">
                    {totalItems}
                  </Badge>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                    <ShoppingCart className="h-9 w-9 text-slate-300" />
                  </div>
                  <div>
                    <p className="font-bold text-brand-slate text-lg">Cart is empty</p>
                    <p className="text-slate-500 text-sm mt-1">
                      Browse our products and add items to your cart.
                    </p>
                  </div>
                  <Button onClick={onClose} size="lg">
                    Browse Products
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.div
                        key={item.product.id}
                        layout
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        className="flex gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50 group"
                      >
                        {/* Category icon */}
                        <div className="w-14 h-14 rounded-lg bg-brand-slate flex items-center justify-center shrink-0">
                          <span className="text-brand-orange text-xl font-black">
                            {item.product.name.charAt(0)}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-brand-slate leading-tight line-clamp-2">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {item.product.category}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  updateQuantity(item.product.id, item.quantity - 1)
                                }
                                className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center hover:border-brand-orange hover:text-brand-orange transition-colors text-slate-500"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="text-sm font-bold text-brand-slate w-6 text-center">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  updateQuantity(item.product.id, item.quantity + 1)
                                }
                                className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center hover:border-brand-orange hover:text-brand-orange transition-colors text-slate-500"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-sm font-bold text-brand-orange">
                              {formatPrice(item.product.price * item.quantity)}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="shrink-0 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 self-start mt-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-5 border-t border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Subtotal ({totalItems} items)</span>
                  <span className="text-2xl font-black text-brand-slate">
                    {formatPrice(totalPrice)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 text-center">
                  Prices in Bhutanese Ngultrum (Nu). Call to confirm order.
                </p>
                <a
                  href="tel:+97517716895"
                  className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-brand-orange text-white font-bold hover:bg-brand-orange-dark transition-colors shadow-lg shadow-orange-200"
                >
                  <Phone className="h-5 w-5" />
                  Call to Order: 17716895
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-slate-400 hover:text-red-500"
                  onClick={clearCart}
                >
                  Clear cart
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
