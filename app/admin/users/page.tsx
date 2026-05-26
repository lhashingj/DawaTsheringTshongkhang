"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Trash2, Search, X, Loader2, Wrench, LogOut,
  MessageCircle, ShieldCheck, User, Calendar, Mail,
  Package,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  role: "admin" | "user";
  createdAt: string;
}

export default function AdminUsersPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      })
        .then((r) => r.json())
        .then((d) => { setUsers(Array.isArray(d) ? d : []); setLoading(false); })
        .catch(() => setLoading(false));
    });
  }, [user]);

  async function handleDelete(u: UserRecord) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/users?id=${u.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed");
      }
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast({ title: `${u.name} removed.`, variant: "success" });
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleLogout() {
    await signOut();
    router.push("/");
  }

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const totalUsers = users.length;
  const regularUsers = users.filter((u) => u.role !== "admin").length;
  const newest = [...users].filter((u) => u.role !== "admin").sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  if (authLoading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen industrial-grid-bg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />

      {/* Header */}
      <header className="bg-brand-slate border-b border-white/5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-orange flex items-center justify-center">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            <span className="font-black text-white text-sm">DTT Admin</span>
            <span className="hidden sm:block text-white/20 text-xs">|</span>
            <span className="hidden sm:block text-white/40 text-xs">User Management</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10 gap-1.5 text-xs">
                <Package className="h-3.5 w-3.5" />
                <span className="hidden sm:block">Products</span>
              </Button>
            </Link>
            <Link href="/admin/chat">
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10 gap-1.5 text-xs">
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:block">Chat</span>
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-white/50 hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-blue-600" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-2xl font-black text-brand-slate">{totalUsers}</p>
              <p className="text-xs text-slate-400">Total Accounts</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-green-600" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-2xl font-black text-brand-slate">{regularUsers}</p>
              <p className="text-xs text-slate-400">Registered Users</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-brand-orange" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-black text-brand-slate leading-tight">
                {newest ? newest.name : "—"}
              </p>
              <p className="text-xs text-slate-400">Latest Registered</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h2 className="font-bold text-brand-slate">
              Users
              <span className="ml-2 text-sm font-normal text-slate-400">
                ({filtered.length}{users.length !== filtered.length ? ` of ${users.length}` : ""})
              </span>
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email…"
                className="pl-9 h-9 text-sm"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Mobile card list (phones) */}
          <div className="sm:hidden divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 rounded bg-slate-100 animate-pulse w-2/3" />
                    <div className="h-3 rounded bg-slate-100 animate-pulse w-1/2" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No users found.</p>
              </div>
            ) : (
              filtered.map((u) => (
                <div key={u.id} className="p-4 flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-black",
                    u.role === "admin" ? "bg-brand-orange" : "bg-brand-slate"
                  )}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 justify-between">
                      <p className="font-semibold text-brand-slate text-sm truncate">{u.name}</p>
                      {u.role === "admin" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-brand-orange shrink-0">
                          <ShieldCheck className="h-3 w-3" />Admin
                        </span>
                      ) : (
                        <Badge variant="secondary" className="text-xs shrink-0">User</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{u.email}</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">
                      {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {u.role !== "admin" && (
                    <Button size="icon" variant="ghost" className="h-10 w-10 text-slate-400 hover:text-red-500 shrink-0"
                      onClick={() => setDeleteTarget(u)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop/tablet table (sm+) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Registered</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 rounded bg-slate-100 animate-pulse w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400">
                      <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No users found.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <motion.tr key={u.id} layout className="hover:bg-slate-50/80 group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-black",
                            u.role === "admin" ? "bg-brand-orange" : "bg-brand-slate"
                          )}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-brand-slate">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Mail className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                          {u.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.role === "admin" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-brand-orange">
                            <ShieldCheck className="h-3 w-3" />Admin
                          </span>
                        ) : (
                          <Badge variant="secondary" className="text-xs">User</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(u.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          {u.role !== "admin" && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-500"
                              onClick={() => setDeleteTarget(u)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Delete confirm modal */}
      <AnimatePresence>
        {deleteTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setDeleteTarget(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-center font-black text-brand-slate text-lg mb-1">Remove User?</h3>
              <p className="text-center text-slate-500 text-sm mb-1">
                <span className="font-semibold text-brand-slate">{deleteTarget.name}</span>
              </p>
              <p className="text-center text-slate-400 text-xs mb-6">{deleteTarget.email}</p>
              <p className="text-center text-slate-500 text-sm mb-6">
                This will permanently delete their account.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleDelete(deleteTarget)}>
                  Remove
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
