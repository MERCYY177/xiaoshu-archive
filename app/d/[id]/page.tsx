/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages */
import { ArrowLeft, ArrowUpRight, FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { getNotionDatabase } from "@/lib/notion";

export const dynamic = "force-dynamic";

export default async function DatabasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let database = null;
  try { database = await getNotionDatabase(id); } catch { notFound(); }
  if (!database) notFound();

  return (
    <main className="reading-shell database-shell">
      <a href="/" className="back-link"><ArrowLeft size={17} />返回档案馆</a>
      <section className="database-page">
        {database.cover ? <img className="article-cover" src={database.cover} alt="" /> : null}
        <header>
          <p>{database.icon && !database.icon.startsWith("http") ? database.icon : "数据库"}</p>
          <h1>{database.title}</h1>
        </header>
        {database.pages.length ? (
          <div className="database-list">
            {database.pages.map((page) => (
              <a href={`/p/${page.id}`} className="database-row" key={page.id}>
                <span className="database-row-icon">{page.icon && !page.icon.startsWith("http") ? page.icon : <FileText size={18} />}</span>
                <strong>{page.title}</strong>
                <time>{new Date(page.updatedAt).toLocaleDateString("zh-CN")}</time>
                <ArrowUpRight size={17} />
              </a>
            ))}
          </div>
        ) : <p className="database-empty">这个数据库里还没有可展示的条目。</p>}
      </section>
    </main>
  );
}
