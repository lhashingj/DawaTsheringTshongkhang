import { NextResponse } from "next/server";
import { authenticateUser, createSession, ensureAdmin } from "@/lib/auth-store";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required." }, { status: 400 });
  }

  ensureAdmin();
  const { user, error } = authenticateUser(email, password);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const token = createSession(user!.id);
  const cookieStore = await cookies();
  cookieStore.set("dtt-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return NextResponse.json({
    id: user!.id,
    name: user!.name,
    email: user!.email,
    verified: user!.verified,
    role: user!.role ?? "user",
    user_metadata: { name: user!.name },
  });
}
