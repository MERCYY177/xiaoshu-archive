/* eslint-disable @typescript-eslint/no-explicit-any */
import { clearNotionCache, getWebhookToken, saveWebhookToken } from "@/lib/notion";

export async function POST(request: Request) {
  const raw = await request.text();
  let event: Record<string, any>;
  try { event = JSON.parse(raw); } catch { return Response.json({ error: "invalid json" }, { status: 400 }); }

  if (typeof event.verification_token === "string") {
    const saved = await saveWebhookToken(event.verification_token);
    if (!saved) console.log("Notion webhook verification token:", event.verification_token);
    return Response.json({ ok: true, saved });
  }

  const secret = await getWebhookToken();
  if (secret) {
    const signature = request.headers.get("x-notion-signature");
    if (!signature || !(await validSignature(raw, signature, secret))) {
      return Response.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  await clearNotionCache();
  return Response.json({ ok: true });
}

async function validSignature(body: string, provided: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const expected = `sha256=${[...signed].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  if (expected.length !== provided.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  return mismatch === 0;
}
