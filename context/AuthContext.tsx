"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  role?: "admin" | "user";
  user_metadata?: { name: string };
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  configured: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

const PROFILE_CACHE_KEY = (id: string) => `dtt-profile-${id}`;

function getCachedProfile(id: string): { name: string; role: "admin" | "user" } | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY(id));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setCachedProfile(id: string, data: { name: string; role: string }) {
  try { sessionStorage.setItem(PROFILE_CACHE_KEY(id), JSON.stringify(data)); } catch {}
}

async function buildAuthUser(sbUser: SupabaseUser): Promise<AuthUser> {
  // Use cached profile for instant load; refresh in background
  const cached = typeof window !== "undefined" ? getCachedProfile(sbUser.id) : null;

  if (cached) {
    // Background refresh — don't await
    supabase.from("profiles").select("name, role").eq("id", sbUser.id).single()
      .then(({ data }) => { if (data) setCachedProfile(sbUser.id, data); });
    return {
      id: sbUser.id,
      name: cached.name,
      email: sbUser.email ?? "",
      verified: sbUser.email_confirmed_at != null,
      role: cached.role,
      user_metadata: { name: cached.name },
    };
  }

  try {
    const { data } = await supabase
      .from("profiles")
      .select("name, role")
      .eq("id", sbUser.id)
      .single();
    const name = data?.name ?? sbUser.user_metadata?.name ?? "User";
    if (data) setCachedProfile(sbUser.id, data);
    return {
      id: sbUser.id,
      name,
      email: sbUser.email ?? "",
      verified: sbUser.email_confirmed_at != null,
      role: data?.role ?? "user",
      user_metadata: { name },
    };
  } catch {
    const name = sbUser.user_metadata?.name ?? "User";
    return {
      id: sbUser.id,
      name,
      email: sbUser.email ?? "",
      verified: sbUser.email_confirmed_at != null,
      role: "user",
      user_metadata: { name },
    };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const { data: { user: sbUser } } = await supabase.auth.getUser();
    if (!sbUser) { setUser(null); return; }
    const u = await buildAuthUser(sbUser);
    setUser(u);
  };

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on subscription — getSession() is redundant
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const u = await buildAuthUser(session.user);
        setUser(u);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, configured: true, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
