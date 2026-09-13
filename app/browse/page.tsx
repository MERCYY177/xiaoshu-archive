import Link from "next/link";
import { Archive, ArrowLeft, ChevronRight, Folder, FileText } from "lucide-react";
import { listPublishedTree, type ArchivePage } from "@/lib/archive-db";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const pages = await listPublishedTree();
  const children = new Map<string | null, ArchivePage[]>();
  for (const page of pages) children.set(page.parent_id, [...(children.get(page.parent_id) ?? []), page]);
  const roots = children.get(null) ?? [];
  const visibleRoots = roots.length === 1 && (children.get(roots[0].id)?.length ?? 0) > 0 ? children.get(roots[0].id)! : roots;
  return (
    <main className="browse-shell">
      <Link href="/" className="back-link"><ArrowLeft size={17} />返回档案馆</Link>
      <header className="browse-head"><Archive size={31} /><h1>分类浏览</h1><p>这里的目录完全由内容生成，新增、隐藏或删除分类后会自动变化。</p></header>
      {visibleRoots.length ? <div className="tree-list">{visibleRoots.map((page) => <TreeNode key={page.id} page={page} children={children} depth={0} />)}</div> : <div className="empty-state"><Folder size={30} /><h2>还没有公开目录</h2><p>在管理后台发布页面后，这里会自动生成层级。</p></div>}
    </main>
  );
}

function TreeNode({ page, children, depth }: { page: ArchivePage; children: Map<string | null, ArchivePage[]>; depth: number }) {
  const nested = children.get(page.id) ?? [];
  return <div className="tree-branch"><Link href={`/p/${page.id}`} className="tree-node" style={{ paddingLeft: `${16 + Math.min(depth, 5) * 24}px` }}>{page.kind === "folder" ? <Folder size={18} /> : <FileText size={18} />}<span>{page.title}</span><ChevronRight size={16} /></Link>{nested.map((child) => <TreeNode key={child.id} page={child} children={children} depth={depth + 1} />)}</div>;
}
