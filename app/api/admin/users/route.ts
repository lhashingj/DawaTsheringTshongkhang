import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function requireAdmin(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const supabase = adminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = adminClient();

  const [authRes, profilesRes] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from("profiles").select("id, name, role"),
  ]);

  if (authRes.error) return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });

  const profileMap = new Map(profilesRes.data?.map((p) => [p.id, p]) ?? []);

  const users = authRes.data.users.map((u) => {
    const profile = profileMap.get(u.id);
    return {
      id: u.id,
      name: profile?.name ?? u.user_metadata?.name ?? "Unknown",
      email: u.email ?? "",
      role: (profile?.role ?? "user") as "admin" | "user",
      verified: u.email_confirmed_at != null,
      createdAt: u.created_at,
    };
  });

  return NextResponse.json(users);
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const supabase = adminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();

  if (profile?.role === "admin") {
    return NextResponse.json({ error: "Cannot delete admin account." }, { status: 403 });
  }

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
