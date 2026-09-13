import { env } from "cloudflare:workers";
import { isAdminRequest } from "@/lib/admin-auth";

export type ArchivePage = {
  id: string;
  notion_id: string | null;
  parent_id: string | null;
  title: string;
  content_md: string;
  kind: "folder" | "article";
  status: "draft" | "published" | "hidden" | "trash";
  sort_order: number;
  created_at: number;
  updated_at: number;
  published_at: number | null;
};

export function rawDb(): D1Database {
  if (!env.DB) throw new Error("档案数据库暂时不可用");
  return env.DB;
}

export async function requireOwnerApi(request: Request) {
  if (!(await isAdminRequest(request))) {
    return new Response(JSON.stringify({ error: "请先登录管理后台" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return true;
}

export async function listPublished(query = "") {
  const db = rawDb();
  const needle = `%${query.trim()}%`;
  const result = query.trim()
    ? await db.prepare("SELECT * FROM archive_pages WHERE status = 'published' AND (title LIKE ? OR content_md LIKE ?) ORDER BY updated_at DESC LIMIT 120").bind(needle, needle).all<ArchivePage>()
    : await db.prepare("SELECT * FROM archive_pages WHERE status = 'published' ORDER BY updated_at DESC LIMIT 120").all<ArchivePage>();
  return result.results;
}

export async function listPublishedTree() {
  const result = await rawDb().prepare("SELECT * FROM archive_pages WHERE status = 'published' ORDER BY sort_order ASC, title ASC").all<ArchivePage>();
  return result.results;
}

export async function listAllPages() {
  const result = await rawDb().prepare("SELECT * FROM archive_pages ORDER BY sort_order ASC, updated_at DESC").all<ArchivePage>();
  return result.results;
}

export async function getPublishedPage(id: string) {
  return rawDb().prepare("SELECT * FROM archive_pages WHERE id = ? AND status = 'published'").bind(id).first<ArchivePage>();
}
