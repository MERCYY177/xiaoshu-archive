import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notFound } from "next/navigation";
import { getPublishedPage } from "@/lib/archive-db";

export const dynamic = "force-dynamic";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getPublishedPage(id);
  if (!page) notFound();
  return (
    <main className="reading-shell">
      <Link href="/" className="back-link"><ArrowLeft size={17} />返回档案馆</Link>
      <article className="reading-page">
        <header><p>{page.kind === "folder" ? "目录" : "文章"}</p><h1>{page.title}</h1><time>{new Date(page.updated_at).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</time></header>
        <div className="prose"><ReactMarkdown remarkPlugins={[remarkGfm]}>{page.content_md}</ReactMarkdown></div>
      </article>
    </main>
  );
}
