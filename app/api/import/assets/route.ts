import { env } from "cloudflare:workers";
import { requireOwnerApi, rawDb } from "@/lib/archive-db";

export async function POST(request: Request) {
  const owner = await requireOwnerApi(request);
  if (owner instanceof Response) return owner;
  if (!env.BUCKET) return Response.json({ error: "附件存储暂时不可用" }, { status: 503 });
  const form = await request.formData();
  const sourcePath = String(form.get("sourcePath") ?? "");
  const file = form.get("file");
  if (!sourcePath || !(file instanceof File)) return Response.json({ error: "附件信息不完整" }, { status: 400 });
  const db = rawDb();
  const existing = await db.prepare("SELECT id, size_bytes FROM archive_assets WHERE source_path = ?").bind(sourcePath).first<{ id: string; size_bytes: number }>();
  if (existing?.size_bytes === file.size) return Response.json({ skipped: true, id: existing.id });
  const id = existing?.id ?? crypto.randomUUID();
  const objectKey = `archive/${id}`;
  await env.BUCKET.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || "application/octet-stream" }, customMetadata: { sourcePath, fileName: file.name } });
  await db.prepare("INSERT INTO archive_assets (id, source_path, object_key, file_name, media_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source_path) DO UPDATE SET object_key = excluded.object_key, file_name = excluded.file_name, media_type = excluded.media_type, size_bytes = excluded.size_bytes").bind(id, sourcePath, objectKey, file.name, file.type || "application/octet-stream", file.size, Date.now()).run();
  return Response.json({ id });
}
