"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { unzip } from "fflate";
import { Download, FileArchive, FilePlus2, LoaderCircle, Save, Search, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ArchivePage } from "@/lib/archive-db";

type DraftPage = Pick<ArchivePage, "id" | "notion_id" | "parent_id" | "title" | "content_md" | "kind" | "status" | "sort_order">;
type ZipEntryMap = Record<string, Uint8Array>;

export function AdminClient({ initialPages }: { initialPages: ArchivePage[] }) {
  const [pages, setPages] = useState(initialPages);
  const [selectedId, setSelectedId] = useState(initialPages[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [importState, setImportState] = useState({ running: false, label: "", value: 0 });
  const [importMode, setImportMode] = useState<"draft" | "published">("draft");
  const dirty = useRef(false);
  const selected = pages.find((page) => page.id === selectedId);
  const visiblePages = useMemo(() => pages.filter((page) => page.title.toLowerCase().includes(query.toLowerCase())), [pages, query]);

  useEffect(() => {
    if (!selected || !dirty.current) return;
    const timer = window.setTimeout(() => savePage(selected), 1200);
    return () => window.clearTimeout(timer);
  }, [selected?.title, selected?.content_md, selected?.status, selected?.parent_id, selected?.kind]);

  useEffect(() => {
    type WebContext = { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: WebContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "create_archive_draft",
      title: "新建档案草稿",
      description: "在写作基地中新建一篇草稿，并让编辑器立即打开它。",
      inputSchema: { type: "object", properties: { title: { type: "string", minLength: 1 }, content: { type: "string" } }, required: ["title"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input: unknown) => {
        const value = input as { title?: unknown; content?: unknown };
        if (typeof value.title !== "string" || !value.title.trim()) throw new Error("标题不能为空");
        const now = Date.now();
        const page: ArchivePage = { id: crypto.randomUUID(), notion_id: null, parent_id: null, title: value.title.trim(), content_md: typeof value.content === "string" ? value.content : "", kind: "article", status: "draft", sort_order: 0, created_at: now, updated_at: now, published_at: null };
        const response = await fetch("/api/pages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(page) });
        if (!response.ok) throw new Error("草稿创建失败");
        const saved = await response.json() as ArchivePage;
        setPages((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        setSelectedId(saved.id);
        return { id: saved.id, title: saved.title, status: saved.status };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  function updateSelected(patch: Partial<ArchivePage>) {
    dirty.current = true;
    setSaveState("idle");
    setPages((current) => current.map((page) => page.id === selectedId ? { ...page, ...patch } : page));
  }

  async function savePage(page: ArchivePage) {
    setSaveState("saving");
    try {
      const response = await fetch("/api/pages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(page) });
      if (!response.ok) throw new Error();
      const saved = await response.json() as ArchivePage;
      setPages((current) => current.map((item) => item.id === saved.id ? saved : item));
      dirty.current = false;
      setSaveState("saved");
    } catch { setSaveState("error"); }
  }

  function newPage() {
    const now = Date.now();
    const page: ArchivePage = { id: crypto.randomUUID(), notion_id: null, parent_id: null, title: "未命名页面", content_md: "", kind: "article", status: "draft", sort_order: pages.length, created_at: now, updated_at: now, published_at: null };
    setPages((current) => [page, ...current]);
    setSelectedId(page.id);
    dirty.current = true;
  }

  async function importZip(file: File) {
    setImportState({ running: true, label: "正在读取压缩包", value: 2 });
    try {
      const entries = await unzipFile(file);
      const names = Object.keys(entries).filter((name) => !name.endsWith("/"));
      const mdNames = names.filter((name) => name.toLowerCase().endsWith(".md"));
      const assetNames = names.filter((name) => !name.toLowerCase().endsWith(".md") && !name.toLowerCase().endsWith(".csv"));
      const text = new TextDecoder();
      const idByPath = new Map<string, string>();
      const rawByPath = new Map<string, string>();
      mdNames.forEach((name) => {
        const notionId = name.match(/([0-9a-f]{32})(?=\.md$)/i)?.[1] ?? crypto.randomUUID().replaceAll("-", "");
        idByPath.set(normalizePath(name), notionId);
        rawByPath.set(normalizePath(name), text.decode(entries[name]));
      });
      const parentById = new Map<string, string>();
      for (const [sourcePath, markdown] of rawByPath) {
        const sourceId = idByPath.get(sourcePath)!;
        for (const target of markdownTargets(markdown, ".md")) {
          const resolved = resolveNotionPath(sourcePath, target);
          const targetId = idByPath.get(resolved);
          if (targetId && targetId !== sourceId && !parentById.has(targetId)) parentById.set(targetId, sourceId);
        }
      }
      const imported: DraftPage[] = mdNames.map((originalName, sortOrder) => {
        const path = normalizePath(originalName);
        const raw = rawByPath.get(path)!;
        const notionId = idByPath.get(path)!;
        const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() || stripNotionId(originalName);
        const childPaths = new Set(markdownTargets(raw, ".md").map((target) => resolveNotionPath(path, target)));
        let content = raw.replace(/^#\s+.+(?:\r?\n)+/, "");
        content = content.split(/\r?\n/).filter((line) => {
          const target = line.match(/^\s*\[[^\]]+\]\(([^)]+\.md)\)\s*$/i)?.[1];
          return !target || !childPaths.has(resolveNotionPath(path, target));
        }).join("\n").trim();
        content = rewriteLocalMedia(content, path);
        return { id: notionId, notion_id: notionId, parent_id: parentById.get(notionId) ?? null, title, content_md: content, kind: content ? "article" : "folder", status: importMode, sort_order: sortOrder };
      });
      for (let i = 0; i < imported.length; i += 25) {
        setImportState({ running: true, label: `正在导入页面 ${Math.min(i + 25, imported.length)} / ${imported.length}`, value: 8 + Math.round((i / Math.max(imported.length, 1)) * 35) });
        const response = await fetch("/api/import/pages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pages: imported.slice(i, i + 25) }) });
        if (!response.ok) throw new Error("页面导入失败");
      }
      let completedAssets = 0;
      const queue = [...assetNames];
      const workers = Array.from({ length: 3 }, async () => {
        while (queue.length) {
          const name = queue.shift();
          if (!name) break;
          const body = new FormData();
          body.append("sourcePath", normalizePath(name));
          const bytes = entries[name];
          const fileBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
          body.append("file", new Blob([fileBuffer], { type: mediaType(name) }), name.split("/").pop() ?? name);
          const response = await fetch("/api/import/assets", { method: "POST", body });
          if (!response.ok) throw new Error(`附件导入失败：${name}`);
          completedAssets += 1;
          setImportState({ running: true, label: `正在导入附件 ${completedAssets} / ${assetNames.length}`, value: 45 + Math.round((completedAssets / Math.max(assetNames.length, 1)) * 54) });
        }
      });
      await Promise.all(workers);
      setImportState({ running: false, label: `导入完成：${imported.length} 个页面，${assetNames.length} 个附件`, value: 100 });
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setImportState({ running: false, label: error instanceof Error ? error.message : "导入失败，请保留原 ZIP 后重试", value: 0 });
    }
  }

  async function exportContent() {
    const response = await fetch("/api/export");
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `xiaoshu-archive-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Tabs defaultValue="write" className="admin-workspace">
      <TabsList className="admin-tabs" variant="line"><TabsTrigger value="write">写作</TabsTrigger><TabsTrigger value="import">Notion 导入</TabsTrigger><TabsTrigger value="backup">备份</TabsTrigger></TabsList>
      <TabsContent value="write" className="editor-layout">
        <aside className="page-list">
          <div className="page-list-actions"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索页面" /></label><Button size="icon" onClick={newPage} aria-label="新建页面"><FilePlus2 /></Button></div>
          <div className="page-scroll">{visiblePages.map((page) => <button className={page.id === selectedId ? "page-row active" : "page-row"} key={page.id} onClick={() => { dirty.current = false; setSelectedId(page.id); }}><span>{page.title}</span><small>{statusLabel(page.status)}</small></button>)}</div>
        </aside>
        <section className="editor-pane">
          {selected ? <><div className="editor-toolbar"><div className={`save-state ${saveState}`}>{saveState === "saving" ? "保存中…" : saveState === "saved" ? "已自动保存" : saveState === "error" ? "保存失败" : "等待编辑"}</div><select value={selected.status} onChange={(event) => updateSelected({ status: event.target.value as ArchivePage["status"] })}><option value="draft">草稿</option><option value="published">公开发布</option><option value="hidden">隐藏</option><option value="trash">回收站</option></select><Button onClick={() => savePage(selected)}><Save />保存</Button></div><input className="title-input" value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })} aria-label="文章标题" /><textarea className="content-editor" value={selected.content_md} onChange={(event) => updateSelected({ content_md: event.target.value })} placeholder="从这里开始写……" aria-label="文章正文" /></> : <div className="editor-empty">新建一篇文章，或者从左侧选择页面。</div>}
        </section>
      </TabsContent>
      <TabsContent value="import" className="utility-panel">
        <FileArchive size={36} /><h2>导入 Notion ZIP</h2><p>直接选择 Notion 导出的原始压缩包。页面层级、图片和视频会自动识别，32位页面编号只用于防止重复导入，不会显示在标题中。</p>
        <label className="mode-row"><span>导入后的状态</span><select value={importMode} onChange={(event) => setImportMode(event.target.value as "draft" | "published")}><option value="draft">全部保留为草稿</option><option value="published">直接公开发布</option></select></label>
        <label className={importState.running ? "upload-button disabled" : "upload-button"}><UploadCloud size={19} />{importState.running ? "正在导入" : "选择 Notion ZIP"}<input type="file" accept=".zip,application/zip" disabled={importState.running} onChange={(event) => event.target.files?.[0] && importZip(event.target.files[0])} /></label>
        {(importState.label || importState.running) && <div className="import-progress">{importState.running && <LoaderCircle className="spin" size={18} />}<span>{importState.label}</span><Progress value={importState.value} /></div>}
      </TabsContent>
      <TabsContent value="backup" className="utility-panel"><Download size={36} /><h2>导出内容备份</h2><p>下载全部页面、层级、状态和附件索引。备份文件可以用于迁移或检查数据。</p><Button onClick={exportContent}><Download />导出 JSON</Button></TabsContent>
    </Tabs>
  );
}

function unzipFile(file: File): Promise<ZipEntryMap> {
  return file.arrayBuffer().then((buffer) => new Promise((resolve, reject) => unzip(new Uint8Array(buffer), (error, data) => error ? reject(error) : resolve(data))));
}
function normalizePath(value: string) { return decodeURIComponent(value).replace(/^\.\//, "").replaceAll("\\", "/"); }
function resolveNotionPath(source: string, target: string) {
  const base = source.split("/").slice(0, -1);
  for (const part of normalizePath(target).split("/")) { if (part === "..") base.pop(); else if (part !== ".") base.push(part); }
  return base.join("/");
}
function markdownTargets(markdown: string, extension: string) {
  const targets: string[] = []; const regex = /!?\[[^\]]*\]\(([^)]+)\)/g; let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown))) { const target = match[1].split("#")[0]; if (decodeURIComponent(target).toLowerCase().endsWith(extension)) targets.push(target); }
  return targets;
}
function rewriteLocalMedia(markdown: string, sourcePath: string) {
  return markdown.replace(/(!?\[[^\]]*\]\()([^)]+)(\))/g, (whole, start, rawTarget, end) => {
    const clean = rawTarget.split("#")[0]; const decoded = decodeURIComponent(clean);
    if (/^(https?:|mailto:|#)/i.test(decoded) || decoded.toLowerCase().endsWith(".md")) return whole;
    return `${start}/api/media?path=${encodeURIComponent(resolveNotionPath(sourcePath, clean))}${end}`;
  });
}
function stripNotionId(name: string) { return name.split("/").pop()?.replace(/\s+[0-9a-f]{32}\.md$/i, "").replace(/\.md$/i, "") || "未命名页面"; }
function mediaType(name: string) { const ext = name.split(".").pop()?.toLowerCase(); return ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "mp4" ? "video/mp4" : "application/octet-stream"; }
function statusLabel(status: ArchivePage["status"]) { return status === "published" ? "已发布" : status === "hidden" ? "隐藏" : status === "trash" ? "回收站" : "草稿"; }
