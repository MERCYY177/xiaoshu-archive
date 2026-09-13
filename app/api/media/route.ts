import { env } from "cloudflare:workers";
import { rawDb } from "@/lib/archive-db";

export async function GET(request: Request) {
  if (!env.BUCKET) return new Response("附件存储不可用", { status: 503 });
  const path = new URL(request.url).searchParams.get("path");
  if (!path) return new Response("缺少附件路径", { status: 400 });
  const asset = await rawDb().prepare("SELECT object_key, media_type, file_name FROM archive_assets WHERE source_path = ?").bind(path).first<{ object_key: string; media_type: string; file_name: string }>();
  if (!asset) return new Response("附件尚未导入", { status: 404 });
  const object = await env.BUCKET.get(asset.object_key);
  if (!object) return new Response("附件不存在", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", asset.media_type);
  headers.set("cache-control", "public, max-age=86400");
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
