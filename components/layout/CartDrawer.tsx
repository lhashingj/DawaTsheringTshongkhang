"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ShoppingCart, Minus, Plus, Trash2, Phone, MessageCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatPrice, cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

const GST_RATE = 0.05;

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, totalItems, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const [chatLoading, setChatLoading] = useState(false);
  const [orderSent, setOrderSent] = useState(false);

  const gstAmount = Math.round(totalPrice * GST_RATE);
  const grandTotal = totalPrice + gstAmount;

  async function openChat() {
    if (!user) return;
    setChatLoading(true);
    try {
      // Get or create open order conversation
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "order")
        .eq("status", "open")
        .limit(1)
        .single();

      let convId: string;
      if (existing?.id) {
        convId = existing.id;
      } else {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            user_id: user.id,
            user_name: user.name ?? user.email ?? "Customer",
            user_email: user.email,
            type: "order",
            status: "open",
          })
          .select("id")
          .single();
        convId = newConv!.id;
      }

      // Save cart contents as order message
      if (items.length > 0) {
        const lines = items
          .map((i) => `• ${i.product.name} ×${i.quantity} — Nu. ${(i.product.price * i.quantity).toLocaleString()}`)
          .join("\n");
        const { error: msgErr } = await supabase.from("messages").insert({
          conversation_id: convId,
          sender_type: "user",
          content: `🛒 Order Enquiry\n\n${lines}\n\nSubtotal: Nu. ${totalPrice.toLocaleString()}\nGST (5%): Nu. ${gstAmount.toLocaleString()}\n💰 Total (incl. GST): Nu. ${grandTotal.toLocaleString()}\n\nPlease confirm availability and arrange delivery.`,
        });
        if (msgErr) console.error("[CartDrawer] Message insert failed:", msgErr);
        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convId);
        const { error: notifErr } = await supabase.from("notifications").insert({
          conversation_id: convId,
          user_name: user.name ?? user.email ?? "Customer",
          user_email: user.email ?? "",
          message_preview: items.map((i) => `${i.product.name} ×${i.quantity}`).join(", "),
        });
        if (notifErr) console.error("[CartDrawer] Notification insert failed:", notifErr);
      }

      setOrderSent(true);
      clearCart();
      setTimeout(() => {
        setOrderSent(false);
        onClose();
        window.dispatchEvent(new CustomEvent("dtt-open-chat", { detail: { forceOrderReload: true } }));
      }, 1200);
    } catch (err) {
      console.error("[CartDrawer] Failed to send order message:", err);
      setChatLoading(false);
    }
    setChatLoading(false);
  }

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
            className="fixed right-0 top-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col h-[100dvh]"
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
                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center hover:border-brand-orange hover:text-brand-orange transition-colors text-slate-500"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="text-sm font-bold text-brand-slate w-6 text-center">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
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
                {/* Price breakdown */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Subtotal ({totalItems} item{totalItems !== 1 ? "s" : ""})</span>
                    <span className="text-slate-600 font-semibold">{formatPrice(totalPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400 flex items-center gap-1">
                      GST
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">5%</span>
                    </span>
                    <span className="text-slate-600 font-semibold">+ {formatPrice(gstAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-slate-200">
                    <span className="text-slate-700 font-bold">Total (incl. GST)</span>
                    <span className="text-2xl font-black text-brand-slate">{formatPrice(grandTotal)}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 text-center">
                  Prices in Bhutanese Ngultrum (Nu.). GST registered.
                </p>
                <a
                  href="tel:+97517716895"
                  className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-brand-orange text-white font-bold hover:bg-brand-orange-dark transition-colors shadow-lg shadow-orange-200"
                >
                  <Phone className="h-5 w-5" />
                  Call to Order: 17716895
                </a>
                {user && (
                  <button
                    onClick={openChat}
                    disabled={chatLoading || orderSent}
                    className={cn(
                      "flex items-center justify-center gap-2 w-full h-11 rounded-xl text-white font-bold transition-colors cursor-pointer shadow-lg shadow-green-200",
                      orderSent
                        ? "bg-green-700"
                        : "bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed",
                    )}
                  >
                    {orderSent ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Order sent! Opening chat…
                      </>
                    ) : chatLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending order…
                      </>
                    ) : (
                      <>
                        <MessageCircle className="h-4 w-4" />
                        Order Now
                      </>
                    )}
                  </button>
                )}
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
