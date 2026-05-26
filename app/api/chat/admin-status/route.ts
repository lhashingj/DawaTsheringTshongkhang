import { NextResponse } from "next/server";
import { getAdminOnline, setAdminOnline } from "@/lib/chat-store";

export async function GET() {
  return NextResponse.json({ is_online: getAdminOnline() });
}

export async function POST(req: Request) {
  const { is_online } = await req.json();
  setAdminOnline(!!is_online);
  return NextResponse.json({ ok: true });
}
