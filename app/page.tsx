/* eslint-disable @next/next/no-html-link-for-pages */
import { Archive, ArrowUpRight, Clock3, FileText, Search } from "lucide-react";
import { NotionRenderer } from "@/components/notion-renderer";
import { getNotionPage, listNotionPages, rootPageId, type NotionPageBundle, type NotionPageSummary } from "@/lib/notion";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  let pages: NotionPageSummary[] = [];
  let rootBundle: NotionPageBundle | null = null;
  let unavailable: string | null = null;
  try {
    const root = rootPageId();
    if (q.trim()) {
      pages = (await listNotionPages())
        .filter((page) => page.id !== root)
        .filter((page) => page.title.toLocaleLowerCase("zh-CN").includes(q.trim().toLocaleLowerCase("zh-CN")))
        .slice(0, 120);
    } else {
      rootBundle = await getNotionPage(root);
    }
  } catch (error) {
    unavailable = error instanceof Error ? error.message : "Notion内容暂时无法读取";
  }

  return (
    <main className="archive-shell">
      <header className="topbar">
        <a href="/" className="brand" aria-label="返回档案馆首页"><span className="brand-mark"><Archive size={19} /></span><span>写作基地</span></a>
        <nav className="topnav" aria-label="主导航"><a href="/">档案首页</a><a href="/browse">完整目录</a><a href="/admin" className="manage-link">同步</a></nav>
      </header>
      <section className="archive-head">
        <div><p className="eyebrow">PERSONAL ARCHIVE</p><h1>档案馆</h1><p className="lede">内容从 Notion 自动同步。首页保持中性，名字只在具体分类和文章中出现。</p></div>
        <form className="searchbox" action="/"><Search size={18} aria-hidden="true" /><input name="q" defaultValue={q} placeholder="搜索文章标题" aria-label="搜索文章标题" /></form>
      </section>
      <section className="content-section">
        {q && <div className="section-title"><div><span>搜索结果</span><strong>{pages.length}</strong></div><a href="/">清除搜索</a></div>}
        {unavailable ? (
          <div className="empty-state"><Archive size={30} /><h2>还没有连接 Notion</h2><p>{friendlyError(unavailable)}</p><a href="/admin" className="primary-button">查看配置步骤 <ArrowUpRight size={17} /></a></div>
        ) : q && pages.length === 0 ? (
          <div className="empty-state"><FileText size={30} /><h2>没有找到相关标题</h2><p>换一个关键词试试看。</p></div>
        ) : q ? (
          <div className="article-grid">{pages.map((page) => (
            <a className="article-card" href={`/p/${page.id}`} key={page.id}>
              <div className="card-meta"><span>{renderIcon(page.icon)}文章</span><span><Clock3 size={14} />{new Date(page.updatedAt).toLocaleDateString("zh-CN")}</span></div>
              <h2>{page.title}</h2><p>打开阅读全文与图片</p><span className="read-more">打开 <ArrowUpRight size={15} /></span>
            </a>
          ))}</div>
        ) : rootBundle ? (
          <article className="notion-home notion-content"><NotionRenderer blocks={rootBundle.blocks} /></article>
        ) : (
          <div className="empty-state"><FileText size={30} /><h2>还没有可展示的页面</h2><p>在 Notion 根页面中添加标题、文字或子页面后，这里会按原顺序显示。</p></div>
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
