import { NextResponse } from "next/server";
import { verifyUserEmail } from "@/lib/auth-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const ok = verifyUserEmail(token);
  if (!ok) return NextResponse.json({ error: "Invalid or expired verification link." }, { status: 400 });

  return NextResponse.json({ ok: true });
}
