import { requireOwnerApi, rawDb } from "@/lib/archive-db";

export async function GET(request: Request) {
  const owner = await requireOwnerApi(request);
  if (owner instanceof Response) return owner;
  const db = rawDb();
  const [pages, assets] = await Promise.all([
    db.prepare("SELECT * FROM archive_pages ORDER BY sort_order ASC").all(),
    db.prepare("SELECT id, source_path, file_name, media_type, size_bytes, created_at FROM archive_assets ORDER BY created_at ASC").all(),
  ]);
  const payload = { format: "xiaoshu-archive-v1", exportedAt: new Date().toISOString(), pages: pages.results, assets: assets.results };
  return new Response(JSON.stringify(payload, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="xiaoshu-archive.json"' } });
}
