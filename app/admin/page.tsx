import { ArrowLeft, CheckCircle2, CircleAlert, RefreshCw } from "lucide-react";
import { requireAdminPage } from "@/lib/admin-auth";
import { getWebhookToken, notionConfiguration } from "@/lib/notion";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ sync?: string; count?: string; message?: string }> }) {
  await requireAdminPage();
  const result = await searchParams;
  const configuration = notionConfiguration();
  const webhookToken = await getWebhookToken();
  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- force a full reload after sync */}
          <a href="/"><ArrowLeft size={17} />返回档案馆</a>
          <h1>Notion 同步</h1>
        </div>
        <form action="/api/auth/logout" method="post"><button type="submit" className="logout-button">退出登录</button></form>
      </header>
      <section className="sync-panel">
        <p className="eyebrow">NOTION CONNECTION</p>
        <h2>内容仍在 Notion，网站负责展示</h2>
        <p className="sync-intro">这里不会保存图片文件。D1只缓存当前页面文字和图片临时地址，每5分钟过期并直接覆盖。</p>
        {result.sync === "success" && <p className="sync-result success">同步成功，共读取 {result.count ?? "0"} 个 Notion 页面。现在可以返回档案馆查看。</p>}
        {result.sync === "error" && <p className="sync-result error">{result.message ?? "同步失败，请稍后再试。"}</p>}
        <div className="status-grid">
          <Status label="Notion 集成密钥" ready={configuration.token} />
          <Status label="Notion 根页面" ready={configuration.rootPageId} />
          <Status label="D1 缓存（推荐）" ready={configuration.database} optional />
          <Status label="自动更新 Webhook" ready={Boolean(webhookToken)} optional />
        </div>
        <form action="/api/sync" method="post"><button className="sync-button" type="submit"><RefreshCw size={18} />立即同步 Notion</button></form>
        <div className="setup-notes">
          <h3>需要配置的变量</h3>
          <dl><div><dt>NOTION_TOKEN</dt><dd>Notion 内部集成密钥，设置为加密 Secret。</dd></div><div><dt>NOTION_ROOT_PAGE_ID</dt><dd>档案根页面网址中的页面 ID。</dd></div><div><dt>ADMIN_PASSWORD</dt><dd>进入本同步页使用的密码，至少12位。</dd></div></dl>
          <h3>Webhook 地址</h3>
          <code>/api/notion/webhook</code>
          {webhookToken ? <><h3>Webhook 验证令牌</h3><p>Notion要求验证订阅时，复制下面这段：</p><code className="token-code">{webhookToken}</code></> : <p>在 Notion 集成后台添加上面的 Webhook 地址后，验证令牌会显示在这里。D1未绑定时，请改用 Cloudflare日志查看令牌。</p>}
        </div>
      </section>
    </main>
  );
}

function Status({ label, ready, optional = false }: { label: string; ready: boolean; optional?: boolean }) {
  return <div className={`status-card ${ready ? "ready" : "missing"}`}>{ready ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}<div><strong>{label}</strong><span>{ready ? "已配置" : optional ? "尚未配置，可稍后添加" : "必须配置"}</span></div></div>;
}
