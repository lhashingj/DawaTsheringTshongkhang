import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const db = supabaseAdmin();
  const { data } = await db.from("admin_status").select("is_online").eq("id", 1).single();
  return NextResponse.json({ is_online: data?.is_online ?? false });
}

export async function POST(req: Request) {
  const { is_online } = await req.json();
  const db = supabaseAdmin();
  await db.from("admin_status").update({ is_online, last_seen: new Date().toISOString() }).eq("id", 1);
  return NextResponse.json({ ok: true });
}
