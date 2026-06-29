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

const ADMIN_EMAIL = "tsheringdemajlw@gmail.com";

function profileFetchWithTimeout(userId: string) {
  return Promise.race([
    supabase.from("profiles").select("name, role").eq("id", userId).single(),
    new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error("timeout") }), 5000)
    ),
  ]);
}

async function buildAuthUser(sbUser: SupabaseUser): Promise<AuthUser> {
  // Use cached profile for instant load; refresh in background
  const cached = typeof window !== "undefined" ? getCachedProfile(sbUser.id) : null;

  if (cached) {
    // Background refresh — don't await
    profileFetchWithTimeout(sbUser.id)
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
    const { data } = await profileFetchWithTimeout(sbUser.id);
    const name = data?.name ?? sbUser.user_metadata?.name ?? "User";
    if (data) setCachedProfile(sbUser.id, data);
    // Fallback: treat known admin email as admin even if profile row is missing
    const role = data?.role ?? (sbUser.email?.toLowerCase() === ADMIN_EMAIL ? "admin" : "user");
    return {
      id: sbUser.id,
      name,
      email: sbUser.email ?? "",
      verified: sbUser.email_confirmed_at != null,
      role,
      user_metadata: { name },
    };
  } catch {
    const name = sbUser.user_metadata?.name ?? "User";
    const role = sbUser.email?.toLowerCase() === ADMIN_EMAIL ? "admin" : "user";
    return {
      id: sbUser.id,
      name,
      email: sbUser.email ?? "",
      verified: sbUser.email_confirmed_at != null,
      role,
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
    let mounted = true;

    // Resolve the initial session via getSession() rather than waiting for
    // onAuthStateChange to fire INITIAL_SESSION.  This avoids a re-entrant
    // callback bug: calling supabase.auth.signOut() *inside* onAuthStateChange
    // fires SIGNED_OUT which re-enters the same handler and sets loading=false
    // with user=null before the original handler finishes, causing the admin
    // guard to bounce the user back to /login on their first successful login.
    async function initAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session?.user) {
        const u = await buildAuthUser(session.user);
        if (mounted) setUser(u);
      }

      if (mounted) setLoading(false);
    }

    initAuth();

    // Handle subsequent auth changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED).
    // Skip INITIAL_SESSION — it is handled by initAuth() above.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === "INITIAL_SESSION") return;

      if (session?.user) {
        setLoading(true);
        const u = await buildAuthUser(session.user);
        if (mounted) { setUser(u); setLoading(false); }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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
