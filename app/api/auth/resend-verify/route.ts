import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { sendEmail } from "@/lib/email";

const DATA_DIR = path.join(process.cwd(), "data");

function readJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
  } catch {
    return fallback;
  }
}

function writeJSON(file: string, data: unknown): void {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required." }, { status: 400 });

  const users = readJSON<{ id: string; email: string; name: string; verified: boolean; verifyToken?: string }[]>("users.json", []);
  const idx = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());

  if (idx === -1 || users[idx].verified) {
    // Don't reveal whether the email exists or is already verified
    return NextResponse.json({ ok: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  users[idx].verifyToken = token;
  writeJSON("users.json", users);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dawatsheringshop.com";
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
  const name = users[idx].name;

  await sendEmail({
    to: email,
    subject: "Verify your DTT Hardware account",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#1e293b;padding:24px;border-radius:12px 12px 0 0;">
          <h1 style="color:#f97316;margin:0;font-size:20px;">DTT Hardware</h1>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
          <h2 style="color:#1e293b;margin-top:0;">Verify your email, ${name}!</h2>
          <p style="color:#475569;">Click the button below to verify your email address and activate your account.</p>
          <a href="${verifyUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0;">
            Verify Email Address
          </a>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
            If you did not create an account, you can safely ignore this email.<br/>
            DTT Hardware · Nyamaizampa, Paro, Bhutan
          </p>
        </div>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
