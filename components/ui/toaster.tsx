"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useToastState } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, subscribe } = useToastState();

  useEffect(() => {
    return subscribe();
  }, [subscribe]);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl",
              t.variant === "destructive" && "bg-red-50 border-red-200",
              t.variant === "success" && "bg-green-50 border-green-200",
              (!t.variant || t.variant === "default") && "bg-white border-slate-100"
            )}
          >
            {t.variant === "success" && <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />}
            {t.variant === "destructive" && <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
            {(!t.variant || t.variant === "default") && <Info className="h-5 w-5 text-brand-orange shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brand-slate">{t.title}</p>
              {t.description && (
                <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
