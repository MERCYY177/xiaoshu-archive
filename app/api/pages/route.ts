import { requireOwnerApi, rawDb, type ArchivePage } from "@/lib/archive-db";

export async function POST(request: Request) {
  const owner = await requireOwnerApi(request);
  if (owner instanceof Response) return owner;
  const input = await request.json() as Partial<ArchivePage>;
  if (!input.id || !input.title?.trim()) return Response.json({ error: "标题不能为空" }, { status: 400 });
  const db = rawDb();
  const now = Date.now();
  const existing = await db.prepare("SELECT * FROM archive_pages WHERE id = ?").bind(input.id).first<ArchivePage>();
  const status = allowedStatus(input.status);
  const kind = input.kind === "folder" ? "folder" : "article";
  if (existing) {
    await db.batch([
      db.prepare("INSERT INTO page_versions (id, page_id, title, content_md, status, saved_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), existing.id, existing.title, existing.content_md, existing.status, now),
      db.prepare("UPDATE archive_pages SET parent_id = ?, title = ?, content_md = ?, kind = ?, status = ?, sort_order = ?, updated_at = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END WHERE id = ?").bind(input.parent_id ?? null, input.title.trim(), input.content_md ?? "", kind, status, Number(input.sort_order ?? 0), now, status, now, input.id),
    ]);
  } else {
    await db.prepare("INSERT INTO archive_pages (id, notion_id, parent_id, title, content_md, kind, status, sort_order, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(input.id, input.notion_id ?? null, input.parent_id ?? null, input.title.trim(), input.content_md ?? "", kind, status, Number(input.sort_order ?? 0), now, now, status === "published" ? now : null).run();
  }
  const saved = await db.prepare("SELECT * FROM archive_pages WHERE id = ?").bind(input.id).first<ArchivePage>();
  return Response.json(saved);
}

function allowedStatus(value: unknown): ArchivePage["status"] {
  return value === "published" || value === "hidden" || value === "trash" ? value : "draft";
}
