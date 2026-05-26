"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen industrial-grid-bg flex flex-col items-center justify-center p-4 gap-8">
      <Link href="/" className="inline-flex items-center gap-3 group">
        <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:scale-105 transition-transform">
          <Wrench className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-white font-black text-base leading-none">DTT Hardware</p>
          <p className="text-white/40 text-[10px] tracking-widest uppercase">Paro, Bhutan</p>
        </div>
      </Link>
      <Suspense fallback={
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-brand-orange mx-auto mb-4" />
          <p className="font-bold text-brand-slate">Verifying your email…</p>
        </div>
      }>
        <VerifyEmailInner />
      </Suspense>
    </div>
  );
}

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function verify() {
      // PKCE flow: Supabase redirects with ?code=... after verifying the email
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        setStatus(error ? "error" : "success");
        return;
      }

      // Implicit / legacy flow: Supabase redirects with #access_token in the hash.
      // The Supabase client picks this up automatically via onAuthStateChange.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setStatus("success");
        return;
      }

      // Wait for onAuthStateChange to fire (processes hash if present)
      const timeout = setTimeout(() => setStatus("error"), 5000);
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session) {
          clearTimeout(timeout);
          setStatus("success");
          subscription.unsubscribe();
        }
      });
    }

    verify();
  }, [searchParams]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 text-center"
    >
      {status === "loading" && (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-brand-orange mx-auto mb-4" />
          <p className="font-bold text-brand-slate text-lg">Verifying your email…</p>
          <p className="text-slate-400 text-sm mt-2">Please wait a moment.</p>
        </>
      )}
      {status === "success" && (
        <>
          <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
          <h2 className="font-black text-brand-slate text-xl mb-2">Email Verified!</h2>
          <p className="text-slate-500 text-sm mb-6">
            Your account is now active. You can sign in and start ordering.
          </p>
          <Link href="/login">
            <Button className="w-full">Sign In</Button>
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <XCircle className="h-14 w-14 text-red-400 mx-auto mb-4" />
          <h2 className="font-black text-brand-slate text-xl mb-2">Verification Failed</h2>
          <p className="text-slate-500 text-sm mb-6">
            This link is invalid or has already been used. Please try registering again.
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/register">
              <Button className="w-full">Register Again</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="w-full">Sign In</Button>
            </Link>
          </div>
        </>
      )}
    </motion.div>
  );
}
