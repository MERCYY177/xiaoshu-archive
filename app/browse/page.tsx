/* eslint-disable @next/next/no-html-link-for-pages */
import { Archive, ArrowLeft, ChevronRight, Folder, FileText } from "lucide-react";
import { listNotionPages, rootPageId, type NotionPageSummary } from "@/lib/notion";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const root = rootPageId();
  const pages = (await listNotionPages()).filter((page) => page.id !== root);
  const ids = new Set(pages.map((page) => page.id));
  const children = new Map<string | null, NotionPageSummary[]>();
  for (const page of pages) {
    const parent = page.parentId && ids.has(page.parentId) ? page.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), page]);
  }
  const roots = children.get(null) ?? [];
  return (
    <main className="browse-shell">
      <a href="/" className="back-link"><ArrowLeft size={17} />返回档案馆</a>
      <header className="browse-head"><Archive size={31} /><h1>分类浏览</h1><p>目录来自 Notion 页面层级。新增、移动或隐藏页面后会自动变化。</p></header>
      {roots.length ? <div className="tree-list">{roots.map((page) => <TreeNode key={page.id} page={page} tree={children} depth={0} />)}</div> : <div className="empty-state"><Folder size={30} /><h2>还没有页面</h2><p>连接 Notion 根页面后，这里会自动生成层级。</p></div>}
    </main>
  );
}

function TreeNode({ page, tree, depth }: { page: NotionPageSummary; tree: Map<string | null, NotionPageSummary[]>; depth: number }) {
  const nested = tree.get(page.id) ?? [];
  return <div className="tree-branch"><a href={`/p/${page.id}`} className="tree-node" style={{ paddingLeft: `${16 + Math.min(depth, 5) * 24}px` }}>{nested.length ? <Folder size={18} /> : <FileText size={18} />}<span>{page.icon && !page.icon.startsWith("http") ? `${page.icon} ` : ""}{page.title}</span><ChevronRight size={16} /></a>{nested.map((child) => <TreeNode key={child.id} page={child} tree={tree} depth={depth + 1} />)}</div>;
}
