"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogIn, Eye, EyeOff, ShieldCheck, Truck, Globe, ArrowLeft, Mail, CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

const FEATURES = [
  { icon: ShieldCheck, text: "GST Certified Supplier — No. P10037232" },
  { icon: Truck, text: "Nationwide delivery to all 20 Dzongkhags" },
  { icon: Globe, text: "Trusted by builders & farmers since 2012" },
];

const fieldVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.1 + 0.2, duration: 0.4, ease: "easeOut" },
  }),
};

const inputCls = "w-full h-11 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-400 transition-colors";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, role")
        .eq("id", data.user.id)
        .single();
      // Pre-fill the AuthContext cache so the SIGNED_IN handler skips the DB call
      if (profile) {
        try { sessionStorage.setItem(`dtt-profile-${data.user.id}`, JSON.stringify(profile)); } catch {}
      }
      router.push(profile?.role === "admin" ? "/admin" : "/");
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? "";
      if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials")) {
        setError("Invalid email or password.");
      } else if (msg.includes("Email not confirmed")) {
        setError("Please verify your email before signing in.");
      } else if (msg.includes("Too many requests")) {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError("Login failed. Please try again.");
      }
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setForgotSent(true);
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? "";
      if (msg.includes("rate limit") || msg.includes("Too many")) {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      {/* Minimal sticky nav */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700 shrink-0 lg:hidden">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-white shadow group-hover:scale-105 transition-transform shrink-0">
              <img src="/logo.png" alt="DTT Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-black text-white text-sm">DTT Hardware</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors font-medium">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      <div className="flex flex-1">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col justify-between industrial-grid-bg relative overflow-hidden p-12">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-orange/8 rounded-full blur-3xl pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55 }}
          className="relative z-10"
        >
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-white shadow-lg group-hover:scale-105 transition-transform shrink-0">
              <img src="/logo.png" alt="DTT Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-white font-black text-lg leading-none">DTT Hardware</p>
              <p className="text-white/40 text-[10px] font-medium tracking-widest uppercase">Paro, Bhutan</p>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="relative z-10"
        >
          <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Bhutan&apos;s Trusted<br />
            <span className="text-gradient">Hardware Partner</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-10">
            Professional tools, machinery, and safety equipment for builders,
            farmers, and craftsmen across Bhutan.
          </p>
          <div className="space-y-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.12 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-brand-orange/20 flex items-center justify-center shrink-0">
                  <f.icon className="h-4 w-4 text-brand-orange" />
                </div>
                <span className="text-white/70 text-sm font-medium">{f.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="relative z-10 text-white/30 text-xs"
        >
          © 2026 Dawa Tshering Tshongkhang. All rights reserved.
        </motion.p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-slate-900">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[400px]"
        >
          <AnimatePresence mode="wait">
            {forgotMode ? (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Reset password</h1>
                  <p className="text-slate-400 text-sm mt-1.5">
                    Enter your email and we&apos;ll send you a reset link.
                  </p>
                </motion.div>

                {forgotSent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-8 text-center"
                  >
                    <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-7 w-7 text-green-400" />
                    </div>
                    <p className="font-bold text-white text-lg">Check your email</p>
                    <p className="text-slate-400 text-sm mt-2">
                      A password reset link has been sent to{" "}
                      <span className="font-semibold text-white">{email}</span>.
                    </p>
                    <p className="text-slate-500 text-xs mt-2 mb-8">
                      Click the link in the email to set a new password.
                    </p>
                    <button
                      onClick={() => { setForgotMode(false); setForgotSent(false); setError(""); }}
                      className="text-sm text-brand-orange font-semibold hover:underline cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="mt-8 space-y-5">
                    <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-300">Email address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        autoFocus
                        className={inputCls}
                      />
                    </motion.div>

                    <AnimatePresence mode="wait">
                      {error && (
                        <motion.p
                          key="error"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-xs text-red-400 font-medium bg-red-900/30 border border-red-700 rounded-lg px-3 py-2.5"
                        >
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
                      <Button
                        type="submit"
                        className="w-full h-11 gap-2 shadow-lg shadow-orange-500/20 cursor-pointer"
                        size="lg"
                        disabled={loading}
                      >
                        {loading ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                        {loading ? "Sending…" : "Send Reset Link"}
                      </Button>
                    </motion.div>

                    <motion.p custom={3} variants={fieldVariants} initial="hidden" animate="visible" className="text-sm text-slate-400 text-center">
                      <button
                        type="button"
                        onClick={() => { setForgotMode(false); setError(""); }}
                        className="text-brand-orange font-semibold hover:underline cursor-pointer"
                      >
                        Back to Sign In
                      </button>
                    </motion.p>
                  </form>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Welcome back</h1>
                  <p className="text-slate-400 text-sm mt-1.5">Sign in to your account to continue</p>
                </motion.div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-300">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoFocus
                      className={inputCls}
                    />
                  </motion.div>

                  <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-300">Password</label>
                      <button
                        type="button"
                        onClick={() => { setForgotMode(true); setError(""); }}
                        className="text-xs text-brand-orange font-semibold hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className={`${inputCls} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </motion.div>

                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.p
                        key="error"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-red-400 font-medium bg-red-900/30 border border-red-700 rounded-lg px-3 py-2.5"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible">
                    <Button
                      type="submit"
                      className="w-full h-11 gap-2 shadow-lg shadow-orange-500/20 cursor-pointer"
                      size="lg"
                      disabled={loading}
                    >
                      {loading ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        />
                      ) : (
                        <LogIn className="h-4 w-4" />
                      )}
                      {loading ? "Signing in…" : "Sign In"}
                    </Button>
                  </motion.div>
                </form>

                <motion.p
                  custom={4}
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  className="text-sm text-slate-400 text-center mt-6"
                >
                  No account yet?{" "}
                  <Link href="/register" className="text-brand-orange font-semibold hover:underline">
                    Create one free
                  </Link>
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      </div>
    </div>
  );
}
