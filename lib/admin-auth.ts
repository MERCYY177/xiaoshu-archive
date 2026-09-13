import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE = "xiaoshu_archive_admin";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

function adminSecret(): string | null {
  const value = env.ADMIN_PASSWORD?.trim();
  return value && value.length >= 12 ? value : null;
}

export async function passwordMatches(candidate: string): Promise<boolean> {
  const secret = adminSecret();
  if (!secret) return false;
  const [left, right] = await Promise.all([digest(candidate), digest(secret)]);
  return timingSafeEqual(left, right);
}

export async function createAdminToken(): Promise<string> {
  const secret = adminSecret();
  if (!secret) throw new Error("ADMIN_PASSWORD 尚未配置或长度不足 12 位");
  const payload = `${Date.now() + SESSION_SECONDS * 1000}`;
  return `${payload}.${await sign(payload, secret)}`;
}

export async function isAdminToken(token: string | undefined): Promise<boolean> {
  const secret = adminSecret();
  if (!secret || !token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!/^\d+$/.test(payload) || Number(payload) <= Date.now()) return false;
  return timingSafeEqual(signature, await sign(payload, secret));
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  return isAdminToken(readCookie(request.headers.get("cookie"), ADMIN_COOKIE));
}

export async function requireAdminPage(): Promise<void> {
  const store = await cookies();
  if (!(await isAdminToken(store.get(ADMIN_COOKIE)?.value))) redirect("/login");
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_SECONDS,
};

function readCookie(header: string | null, name: string): string | undefined {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const result = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(result));
}

async function digest(value: string): Promise<string> {
  const result = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(result));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function timingSafeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let i = 0; i < length; i += 1) mismatch |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  return mismatch === 0;
}
