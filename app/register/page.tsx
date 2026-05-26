"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wrench, UserPlus, CheckCircle, Eye, EyeOff, Hammer, Package, Star, LogIn, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

const PERKS = [
  { icon: Star, text: "Access to 90+ premium hardware products" },
  { icon: Package, text: "Track your enquiries and orders" },
  { icon: Hammer, text: "Get expert advice and product support" },
];

const fieldVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.09 + 0.2, duration: 0.4, ease: "easeOut" },
  }),
};

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      });
      if (authError) throw authError;
      if (data.user) {
        await supabase.from("profiles").insert({
          id: data.user.id,
          name,
          email,
          role: "user",
        });
      }
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? "";
      if (msg.includes("already registered") || msg.includes("already in use") || msg.includes("already exists")) {
        setError("An account with this email already exists.");
      } else if (msg.includes("Password should be")) {
        setError("Password must be at least 6 characters.");
      } else if (msg.includes("valid email")) {
        setError("Please enter a valid email address.");
      } else {
        setError("Registration failed. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal sticky nav */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-100 shrink-0 lg:hidden">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-brand-orange flex items-center justify-center shadow shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <Wrench className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-black text-brand-slate text-sm">DTT Hardware</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-slate transition-colors font-medium">
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
            <div className="w-11 h-11 rounded-xl bg-brand-orange flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:scale-105 transition-transform">
              <Wrench className="h-6 w-6 text-white" strokeWidth={2.5} />
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
            Join Bhutan&apos;s<br />
            <span className="text-gradient">Premier Hardware Store</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-10">
            Create your account and get access to professional-grade tools,
            machinery, and equipment — delivered across Bhutan.
          </p>
          <div className="space-y-4">
            {PERKS.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.12 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-brand-orange/20 flex items-center justify-center shrink-0">
                  <p.icon className="h-4 w-4 text-brand-orange" />
                </div>
                <span className="text-white/70 text-sm font-medium">{p.text}</span>
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
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-slate-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[400px]"
        >
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                >
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-5" />
                </motion.div>
                <h2 className="font-black text-brand-slate text-2xl mb-2">Account Created!</h2>
                <p className="text-slate-500 text-sm mb-2">
                  A verification email has been sent to{" "}
                  <span className="font-semibold text-brand-slate">{email}</span>.
                </p>
                <p className="text-slate-400 text-xs mb-8">
                  Click the link in the email to verify your account, then sign in.
                </p>
                <Link href="/login">
                  <Button className="w-full h-11 gap-2 cursor-pointer">
                    <LogIn className="h-4 w-4" />
                    Go to Sign In
                  </Button>
                </Link>
              </motion.div>
            ) : (
              <motion.div key="form">
                <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-slate">Create account</h1>
                  <p className="text-slate-500 text-sm mt-1.5">Free to join — takes less than a minute</p>
                </motion.div>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Full Name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      required
                      autoFocus
                      className="h-11 bg-white border-slate-200 focus:border-brand-orange transition-colors"
                    />
                  </motion.div>

                  <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Email address</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="h-11 bg-white border-slate-200 focus:border-brand-orange transition-colors"
                    />
                  </motion.div>

                  <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        required
                        className="h-11 bg-white border-slate-200 focus:border-brand-orange pr-11 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
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
                        className="text-xs text-red-500 font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2.5"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible">
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
                        <UserPlus className="h-4 w-4" />
                      )}
                      {loading ? "Creating account…" : "Create Account"}
                    </Button>
                  </motion.div>
                </form>

                <motion.p
                  custom={5}
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  className="text-sm text-slate-500 text-center mt-6"
                >
                  Already have an account?{" "}
                  <Link href="/login" className="text-brand-orange font-semibold hover:underline">
                    Sign in
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
