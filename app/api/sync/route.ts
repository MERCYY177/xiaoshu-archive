import { isAdminRequest } from "@/lib/admin-auth";
import { clearNotionCache, listNotionPages } from "@/lib/notion";

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "请先登录同步页面" }, { status: 401 });
  await clearNotionCache();
  try { await listNotionPages(true); } catch { /* Homepage shows the actionable configuration error. */ }
  return Response.redirect(new URL("/admin", request.url), 303);
}
