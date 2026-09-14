import { isAdminRequest } from "@/lib/admin-auth";
import { clearNotionCache, listNotionPages } from "@/lib/notion";

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "请先登录同步页面" }, { status: 401 });
  await clearNotionCache();
  try {
    const pages = await listNotionPages(true);
    return Response.redirect(new URL(`/admin?sync=success&count=${pages.length}`, request.url), 303);
  } catch (error) {
    const message = syncErrorMessage(error);
    return Response.redirect(new URL(`/admin?sync=error&message=${encodeURIComponent(message)}`, request.url), 303);
  }
}

function syncErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "未知错误";
  if (message.includes("Notion API 401")) return "Notion 密钥无效或已经失效，请在 Notion 重新生成后更新 NOTION_TOKEN。";
  if (message.includes("Notion API 403")) return "Notion 拒绝了访问，请确认令牌属于这个工作空间并有读取权限。";
  if (message.includes("Notion API 404")) return "找不到根页面，请检查 NOTION_ROOT_PAGE_ID 的网址是否正确。";
  if (message.includes("Notion API 400")) return "Notion 拒绝了同步请求，请把此提示截图发给我继续检查。";
  if (message.includes("Notion API 429")) return "Notion 请求过于频繁，请稍等一分钟后再同步。";
  return `同步失败：${message.slice(0, 180)}`;
}
