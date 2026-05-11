"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Wrench, ArrowLeft, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await getSupabase()!.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      router.push("/");
    }
  }

  return (
    <div className="min-h-screen industrial-grid-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-brand-orange transition-colors mb-6 -mt-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to site
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-black text-brand-slate text-base leading-none">Sign In</p>
            <p className="text-slate-400 text-xs mt-0.5">DTT Hardware</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
            <LogIn className="h-4 w-4" />
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <p className="text-sm text-slate-500 text-center mt-6">
          No account?{" "}
          <Link href="/register" className="text-brand-orange font-semibold hover:underline">
            Register
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
