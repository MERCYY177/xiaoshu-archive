/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-explicit-any */
import Link from "next/link";
import type { ReactNode } from "react";
import type { NotionBlock, NotionRichText } from "@/lib/notion";

export function NotionRenderer({ blocks }: { blocks: NotionBlock[] }) {
  const nodes: ReactNode[] = [];
  for (let index = 0; index < blocks.length;) {
    const block = blocks[index];
    if (block.type === "bulleted_list_item" || block.type === "numbered_list_item") {
      const type = block.type;
      const items: NotionBlock[] = [];
      while (index < blocks.length && blocks[index].type === type) items.push(blocks[index++]);
      const Tag = type === "bulleted_list_item" ? "ul" : "ol";
      nodes.push(<Tag key={`${type}-${items[0].id}`}>{items.map((item) => <ListItem key={item.id} block={item} />)}</Tag>);
      continue;
    }
    nodes.push(<Block key={block.id} block={block} />);
    index += 1;
  }
  return <>{nodes}</>;
}

function ListItem({ block }: { block: NotionBlock }) {
  const data = block[block.type] ?? {};
  return <li><RichText value={data.rich_text} />{block.children?.length ? <NotionRenderer blocks={block.children} /> : null}</li>;
}

function Block({ block }: { block: NotionBlock }) {
  const data = block[block.type] ?? {};
  const children = block.children?.length ? <NotionRenderer blocks={block.children} /> : null;
  switch (block.type) {
    case "paragraph":
      return <div className="notion-paragraph"><p><RichText value={data.rich_text} /></p>{children}</div>;
    case "heading_1":
      return <h2><RichText value={data.rich_text} /></h2>;
    case "heading_2":
      return <h3><RichText value={data.rich_text} /></h3>;
    case "heading_3":
      return <h4><RichText value={data.rich_text} /></h4>;
    case "quote":
      return <blockquote><RichText value={data.rich_text} />{children}</blockquote>;
    case "callout":
      return <aside className="notion-callout"><span>{iconValue(data.icon)}</span><div><RichText value={data.rich_text} />{children}</div></aside>;
    case "to_do":
      return <div className={`notion-todo ${data.checked ? "checked" : ""}`}><span aria-hidden="true">{data.checked ? "✓" : ""}</span><div><RichText value={data.rich_text} />{children}</div></div>;
    case "toggle":
      return <details className="notion-toggle"><summary><RichText value={data.rich_text} /></summary>{children}</details>;
    case "divider":
      return <hr />;
    case "code":
      return <figure className="notion-code"><figcaption>{data.language || "code"}</figcaption><pre><code>{plain(data.rich_text)}</code></pre></figure>;
    case "equation":
      return <div className="notion-equation">{data.expression}</div>;
    case "image":
      return <MediaFigure url={mediaUrl(data)} caption={data.caption} kind="image" />;
    case "video":
      return <MediaFigure url={mediaUrl(data)} caption={data.caption} kind="video" />;
    case "file":
    case "pdf": {
      const url = mediaUrl(data);
      return url ? <a className="notion-file" href={url} target="_blank" rel="noreferrer">打开附件：{plain(data.caption) || "文件"}</a> : null;
    }
    case "bookmark":
    case "link_preview":
    case "embed":
      return data.url ? <a className="notion-bookmark" href={data.url} target="_blank" rel="noreferrer"><span>{plain(data.caption) || data.url}</span><small>{data.url}</small></a> : null;
    case "child_page":
      return <Link className="notion-child-page" href={`/p/${block.id}`}><span>↗</span>{data.title || "未命名页面"}</Link>;
    case "child_database":
      return <div className="notion-child-page"><span>▦</span>{data.title || "数据库"}</div>;
    case "table":
      return <div className="notion-table-wrap"><table><tbody>{block.children?.map((row) => <TableRow key={row.id} block={row} />)}</tbody></table></div>;
    case "column_list":
      return <div className="notion-columns">{block.children?.map((column) => <div className="notion-column" key={column.id}><NotionRenderer blocks={column.children ?? []} /></div>)}</div>;
    case "column":
    case "synced_block":
    case "template":
      return <div>{children}</div>;
    case "table_of_contents":
      return null;
    default:
      return children ? <div>{children}</div> : null;
  }
}

function TableRow({ block }: { block: NotionBlock }) {
  const cells = block.table_row?.cells ?? [];
  return <tr>{cells.map((cell: NotionRichText[], index: number) => <td key={index}><RichText value={cell} /></td>)}</tr>;
}

function MediaFigure({ url, caption, kind }: { url: string | null; caption?: NotionRichText[]; kind: "image" | "video" }) {
  if (!url) return null;
  return <figure className="notion-media">
    {kind === "image"
      // Notion returns time-limited remote URLs, so next/image optimization is intentionally skipped.
      ? <img src={url} alt={plain(caption)} loading="lazy" />
      : <video src={url} controls preload="metadata" />}
    {caption?.length ? <figcaption><RichText value={caption} /></figcaption> : null}
  </figure>;
}

function RichText({ value = [] }: { value?: NotionRichText[] }) {
  return <>{value.map((item, index) => {
    const annotations = item.annotations ?? {};
    let node: ReactNode = item.plain_text;
    if (annotations.code) node = <code>{node}</code>;
    if (annotations.bold) node = <strong>{node}</strong>;
    if (annotations.italic) node = <em>{node}</em>;
    if (annotations.underline) node = <u>{node}</u>;
    if (annotations.strikethrough) node = <s>{node}</s>;
    if (item.href) node = <a href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{node}</a>;
    return <span key={index} className={annotations.color && annotations.color !== "default" ? `notion-color-${annotations.color}` : undefined}>{node}</span>;
  })}</>;
}

function mediaUrl(data: Record<string, any>) {
  if (data.type === "file") return data.file?.url ?? null;
  if (data.type === "external") return data.external?.url ?? null;
  return null;
}

function iconValue(icon: Record<string, any> | undefined) {
  if (!icon) return "✦";
  if (icon.type === "emoji") return icon.emoji;
  return "✦";
}

function plain(value?: NotionRichText[]) {
  return (value ?? []).map((item) => item.plain_text ?? "").join("");
}
