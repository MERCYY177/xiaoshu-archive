import Link from "next/link";
import { Archive, ArrowUpRight, Clock3, FileText, Search } from "lucide-react";
import { listPublished } from "@/lib/archive-db";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  let pages = [] as Awaited<ReturnType<typeof listPublished>>;
  let unavailable = false;
  try { pages = await listPublished(q); } catch { unavailable = true; }
  return (
    <main className="archive-shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="返回档案馆首页"><span className="brand-mark"><Archive size={19} /></span><span>写作基地</span></Link>
        <nav className="topnav" aria-label="主导航"><Link href="/">最近更新</Link><Link href="/browse">分类浏览</Link><Link href="/admin" className="manage-link">管理</Link></nav>
      </header>
      <section className="archive-head">
        <div><p className="eyebrow">PERSONAL ARCHIVE</p><h1>档案馆</h1><p className="lede">文字按自己的脉络生长。这里不固定任何名字，只留下持续更新的内容。</p></div>
        <form className="searchbox" action="/"><Search size={18} aria-hidden="true" /><input name="q" defaultValue={q} placeholder="搜索标题或正文" aria-label="搜索标题或正文" /></form>
      </section>
      <section className="content-section">
        <div className="section-title"><div><span>{q ? "搜索结果" : "最近更新"}</span><strong>{pages.length}</strong></div>{q && <Link href="/">清除搜索</Link>}</div>
        {unavailable ? (
          <div className="empty-state"><Archive size={30} /><h2>档案暂时无法读取</h2><p>数据连接恢复后，这里会自动显示内容。</p></div>
        ) : pages.length === 0 ? (
          <div className="empty-state"><FileText size={30} /><h2>{q ? "没有找到相关内容" : "档案馆还是空的"}</h2><p>{q ? "换一个关键词试试看。" : "进入管理后台导入 Notion ZIP，或写下第一篇文章。"}</p><Link href="/admin" className="primary-button">进入管理后台 <ArrowUpRight size={17} /></Link></div>
        ) : (
          <div className="article-grid">{pages.map((page) => (
            <Link className="article-card" href={`/p/${page.id}`} key={page.id}>
              <div className="card-meta"><span>{page.kind === "folder" ? "目录" : "文章"}</span><span><Clock3 size={14} />{new Date(page.updated_at).toLocaleDateString("zh-CN")}</span></div>
              <h2>{page.title}</h2><p>{plainExcerpt(page.content_md)}</p><span className="read-more">打开 <ArrowUpRight size={15} /></span>
            </Link>
          ))}</div>
        )}
      </section>
    </main>
  );
}

function plainExcerpt(markdown: string) {
  return markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[#>*_`~-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "打开查看内容";
}
