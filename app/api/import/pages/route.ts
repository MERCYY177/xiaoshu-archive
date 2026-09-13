import { requireOwnerApi, rawDb } from "@/lib/archive-db";

type ImportPage = { id: string; notion_id: string; parent_id: string | null; title: string; content_md: string; kind: "folder" | "article"; status: "draft" | "published"; sort_order: number };

export async function POST(request: Request) {
  const owner = await requireOwnerApi(request);
  if (owner instanceof Response) return owner;
  const { pages } = await request.json() as { pages?: ImportPage[] };
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > 25) return Response.json({ error: "页面批次无效" }, { status: 400 });
  const db = rawDb();
  const now = Date.now();
  const statements = pages.map((page) => db.prepare(
    "INSERT INTO archive_pages (id, notion_id, parent_id, title, content_md, kind, status, sort_order, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(notion_id) DO UPDATE SET parent_id = excluded.parent_id, title = excluded.title, content_md = excluded.content_md, kind = excluded.kind, status = excluded.status, sort_order = excluded.sort_order, updated_at = excluded.updated_at, published_at = CASE WHEN excluded.status = 'published' THEN COALESCE(archive_pages.published_at, excluded.updated_at) ELSE archive_pages.published_at END"
  ).bind(page.id, page.notion_id, page.parent_id, page.title.trim() || "未命名页面", page.content_md ?? "", page.kind === "folder" ? "folder" : "article", page.status === "published" ? "published" : "draft", Number(page.sort_order ?? 0), now, now, page.status === "published" ? now : null));
  await db.batch(statements);
  return Response.json({ imported: pages.length });
}
