import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  verified: boolean;
  role?: "admin" | "user";
  verifyToken?: string;
  createdAt: string;
}

const ADMIN_EMAIL = "tsheringdemajlw@gmail.com";
const ADMIN_PASSWORD = "Puppy@2026";

// Secret used to sign session tokens — set JWT_SECRET env var in Vercel dashboard
const TOKEN_SECRET = process.env.JWT_SECRET ?? "dtt-hardware-fallback-secret-2026";

export function ensureAdmin(): void {
  const users = readJSON<StoredUser[]>("users.json", []);
  if (users.find((u) => u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase())) return;
  const admin: StoredUser = {
    id: crypto.randomUUID(),
    name: "Admin",
    email: ADMIN_EMAIL,
    passwordHash: hashPassword(ADMIN_PASSWORD),
    verified: true,
    role: "admin",
    createdAt: new Date().toISOString(),
  };
  users.push(admin);
  writeJSON("users.json", users);
}

const DATA_DIR = path.join(process.cwd(), "data");

function readJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
  } catch {
    return fallback;
  }
}

function writeJSON(file: string, data: unknown): void {
  try {
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("[auth-store] write failed:", e);
  }
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computed, "hex"));
  } catch {
    return false;
  }
}

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export function createUser(name: string, email: string, password: string): { user?: StoredUser; error?: string } {
  if (!EMAIL_RE.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  const users = readJSON<StoredUser[]>("users.json", []);
  if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { error: "Email already registered." };
  }
  const user: StoredUser = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: hashPassword(password),
    verified: true,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeJSON("users.json", users);
  return { user };
}

export function authenticateUser(email: string, password: string): { user?: StoredUser; error?: string } {
  const users = readJSON<StoredUser[]>("users.json", []);
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return { error: "Invalid email or password." };
  if (!verifyPassword(password, user.passwordHash)) return { error: "Invalid email or password." };
  return { user };
}

export function verifyUserEmail(token: string): boolean {
  const users = readJSON<StoredUser[]>("users.json", []);
  const idx = users.findIndex((u) => u.verifyToken === token);
  if (idx === -1) return false;
  users[idx].verified = true;
  delete users[idx].verifyToken;
  writeJSON("users.json", users);
  return true;
}

export function getUserById(id: string): StoredUser | null {
  const users = readJSON<StoredUser[]>("users.json", []);
  return users.find((u) => u.id === id) ?? null;
}

// --- Stateless signed session tokens (no file writes, works on Vercel) ---

interface TokenPayload {
  userId: string;
  name: string;
  email: string;
  role: "admin" | "user";
  exp: number;
}

function b64Encode(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function b64Decode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
}

export function createSession(userId: string): string {
  const user = getUserById(userId);
  if (!user) throw new Error("User not found");
  const payload: TokenPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role ?? "user",
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
  };
  const encoded = b64Encode(JSON.stringify(payload));
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

export function getSessionUser(token: string): StoredUser | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const encoded = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = sign(encoded);
    // Timing-safe comparison
    const sigBuf = Buffer.from(sig, "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    const payload: TokenPayload = JSON.parse(b64Decode(encoded));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      id: payload.userId,
      name: payload.name,
      email: payload.email,
      passwordHash: "",
      verified: true,
      role: payload.role,
      createdAt: "",
    };
  } catch {
    return null;
  }
}

export function deleteSession(_token: string): void {
  // Stateless tokens: logout is handled by deleting the cookie on the client
}
