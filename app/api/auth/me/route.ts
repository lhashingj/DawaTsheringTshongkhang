import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-store";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("dtt-session")?.value;
  if (!token) return NextResponse.json(null);

  const user = getSessionUser(token);
  if (!user) return NextResponse.json(null);

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    verified: user.verified,
    role: user.role ?? "user",
    user_metadata: { name: user.name },
  });
}
