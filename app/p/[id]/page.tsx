/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages */
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getNotionPage } from "@/lib/notion";
import { NotionRenderer } from "@/components/notion-renderer";

export const dynamic = "force-dynamic";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let bundle = null;
  try { bundle = await getNotionPage(id); } catch { notFound(); }
  if (!bundle) notFound();

  return (
    <main className="reading-shell">
      <a href="/" className="back-link"><ArrowLeft size={17} />返回档案馆</a>
      <article className="reading-page">
        {bundle.page.cover ? <img className="article-cover" src={bundle.page.cover} alt="" /> : null}
        <header><p>{bundle.page.icon && !bundle.page.icon.startsWith("http") ? bundle.page.icon : "文章"}</p><h1>{bundle.page.title}</h1><time>{new Date(bundle.page.updatedAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</time></header>
        <div className="prose notion-content"><NotionRenderer blocks={bundle.blocks} /></div>
      </article>
    </main>
  );
}
