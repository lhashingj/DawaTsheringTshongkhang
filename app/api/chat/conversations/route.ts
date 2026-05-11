import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET: admin fetches all conversations
export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("conversations")
    .select("*, messages(id, sender_type, content, created_at)")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: user creates or gets their conversation
export async function POST(req: Request) {
  const { user_id, user_name, user_email } = await req.json();
  const db = supabaseAdmin();

  // Return existing open conversation if one exists
  const { data: existing } = await db
    .from("conversations")
    .select("*")
    .eq("user_id", user_id)
    .eq("status", "open")
    .single();

  if (existing) return NextResponse.json(existing);

  const { data, error } = await db
    .from("conversations")
    .insert({ user_id, user_name, user_email })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
