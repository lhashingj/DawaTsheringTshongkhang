import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth-store";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("dtt-session")?.value;
  if (token) deleteSession(token);
  cookieStore.delete("dtt-session");
  return NextResponse.json({ ok: true });
}
