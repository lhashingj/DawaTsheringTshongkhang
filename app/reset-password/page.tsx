"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Wrench, Eye, EyeOff, KeyRound, CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

const fieldVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.09 + 0.2, duration: 0.4, ease: "easeOut" },
  }),
};

const inputCls = "w-full h-11 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 pr-11 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-400 transition-colors";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase processes the recovery token from the URL hash automatically.
    // onAuthStateChange fires with SIGNED_IN + recovery session once it's processed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Also mark ready if a session already exists (token already processed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? "";
      if (msg.includes("expired") || msg.includes("invalid")) {
        setError("This reset link has expired. Please request a new one.");
      } else {
        setError("Failed to update password. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      {/* Minimal sticky nav */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700 shrink-0 lg:hidden">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-brand-orange flex items-center justify-center shadow shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <Wrench className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-black text-white text-sm">DTT Hardware</span>
          </Link>
          <Link href="/login" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors font-medium">
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[400px]"
        >
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              >
                <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-5" />
              </motion.div>
              <h2 className="font-black text-white text-2xl mb-2">Password Updated!</h2>
              <p className="text-slate-400 text-sm mb-1">Your password has been changed successfully.</p>
              <p className="text-slate-500 text-xs mb-8">Redirecting you to sign in…</p>
              <Link href="/login">
                <Button className="w-full h-11 gap-2 cursor-pointer">
                  Go to Sign In
                </Button>
              </Link>
            </motion.div>
          ) : (
            <>
              <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Set new password</h1>
                <p className="text-slate-400 text-sm mt-1.5">Choose a strong password for your account.</p>
              </motion.div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      required
                      autoFocus
                      className={inputCls}
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

                <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible" className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter your password"
                      required
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </motion.div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-400 font-medium bg-red-900/30 border border-red-700 rounded-lg px-3 py-2.5"
                  >
                    {error}
                  </motion.p>
                )}

                {!ready && !error && (
                  <p className="text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5">
                    Verifying your reset link…
                  </p>
                )}

                <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible">
                  <Button
                    type="submit"
                    className="w-full h-11 gap-2 shadow-lg shadow-orange-500/20 cursor-pointer"
                    size="lg"
                    disabled={loading || !ready}
                  >
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    {loading ? "Updating…" : "Update Password"}
                  </Button>
                </motion.div>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
