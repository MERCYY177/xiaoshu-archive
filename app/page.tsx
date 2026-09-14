import Link from "next/link";
import { Archive, ArrowUpRight, Clock3, FileText, Search } from "lucide-react";
import { listNotionPages, rootPageId, type NotionPageSummary } from "@/lib/notion";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  let pages: NotionPageSummary[] = [];
  let unavailable: string | null = null;
  try {
    const root = rootPageId();
    pages = (await listNotionPages())
      .filter((page) => page.id !== root)
      .filter((page) => !q.trim() || page.title.toLocaleLowerCase("zh-CN").includes(q.trim().toLocaleLowerCase("zh-CN")))
      .slice(0, 120);
  } catch (error) {
    unavailable = error instanceof Error ? error.message : "Notion内容暂时无法读取";
  }

  return (
    <main className="archive-shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="返回档案馆首页"><span className="brand-mark"><Archive size={19} /></span><span>写作基地</span></Link>
        <nav className="topnav" aria-label="主导航"><Link href="/">最近更新</Link><Link href="/browse">分类浏览</Link><Link href="/admin" className="manage-link">同步</Link></nav>
      </header>
      <section className="archive-head">
        <div><p className="eyebrow">PERSONAL ARCHIVE</p><h1>档案馆</h1><p className="lede">内容从 Notion 自动同步。首页保持中性，名字只在具体分类和文章中出现。</p></div>
        <form className="searchbox" action="/"><Search size={18} aria-hidden="true" /><input name="q" defaultValue={q} placeholder="搜索文章标题" aria-label="搜索文章标题" /></form>
      </section>
      <section className="content-section">
        <div className="section-title"><div><span>{q ? "搜索结果" : "最近更新"}</span><strong>{pages.length}</strong></div>{q && <Link href="/">清除搜索</Link>}</div>
        {unavailable ? (
          <div className="empty-state"><Archive size={30} /><h2>还没有连接 Notion</h2><p>{friendlyError(unavailable)}</p><Link href="/admin" className="primary-button">查看配置步骤 <ArrowUpRight size={17} /></Link></div>
        ) : pages.length === 0 ? (
          <div className="empty-state"><FileText size={30} /><h2>{q ? "没有找到相关标题" : "还没有可展示的页面"}</h2><p>{q ? "换一个关键词试试看。" : "把 Notion 根页面连接到集成后，子页面会自动出现在这里。"}</p></div>
        ) : (
          <div className="article-grid">{pages.map((page) => (
            <Link className="article-card" href={`/p/${page.id}`} key={page.id}>
              <div className="card-meta"><span>{renderIcon(page.icon)}文章</span><span><Clock3 size={14} />{new Date(page.updatedAt).toLocaleDateString("zh-CN")}</span></div>
              <h2>{page.title}</h2><p>打开阅读全文与图片</p><span className="read-more">打开 <ArrowUpRight size={15} /></span>
            </Link>
          ))}</div>
        )}
      </section>
    </main>
  );
}

function renderIcon(icon: string | null) {
  return icon && !icon.startsWith("http") ? `${icon} ` : "";
}

function friendlyError(message: string) {
  if (message.includes("NOTION_TOKEN")) return "先在同步页面配置 Notion 集成密钥。";
  if (message.includes("NOTION_ROOT_PAGE_ID")) return "先在同步页面配置 Notion 根页面 ID。";
  return "连接恢复后这里会自动显示内容，也可以进入同步页面手动重试。";
}
