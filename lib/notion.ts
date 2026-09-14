/* eslint-disable @typescript-eslint/no-explicit-any */
import { env } from "cloudflare:workers";

const NOTION_VERSION = "2026-03-11";
const CACHE_SECONDS = 5 * 60;

type JsonObject = Record<string, any>;

export type NotionRichText = {
  plain_text: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
};

export type NotionBlock = JsonObject & {
  id: string;
  type: string;
  has_children: boolean;
  children?: NotionBlock[];
};

export type NotionPageSummary = {
  id: string;
  title: string;
  parentId: string | null;
  updatedAt: string;
  createdAt: string;
  icon: string | null;
  cover: string | null;
};

export type NotionPageBundle = {
  page: NotionPageSummary;
  blocks: NotionBlock[];
};

type CacheEntry = { value: unknown; expiresAt: number };
const memoryCache = new Map<string, CacheEntry>();
let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;
let cacheReady: Promise<void> | null = null;

function token() {
  const value = env.NOTION_TOKEN?.trim();
  if (!value) throw new Error("NOTION_TOKEN 尚未配置");
  return value;
}

export function rootPageId() {
  const value = env.NOTION_ROOT_PAGE_ID?.trim();
  if (!value) throw new Error("NOTION_ROOT_PAGE_ID 尚未配置");
  return normalizeId(value);
}

export function notionConfiguration() {
  return {
    token: Boolean(env.NOTION_TOKEN?.trim()),
    rootPageId: Boolean(env.NOTION_ROOT_PAGE_ID?.trim()),
    database: Boolean(env.DB),
  };
}

export async function listNotionPages(force = false): Promise<NotionPageSummary[]> {
  return cached("notion:index", async () => {
    const found: JsonObject[] = [];
    let cursor: string | undefined;
    do {
      const result = await notionApi<JsonObject>("/search", {
        method: "POST",
        body: JSON.stringify({
          filter: { property: "object", value: "page" },
          sort: { direction: "descending", timestamp: "last_edited_time" },
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
      });
      found.push(...(result.results ?? []));
      cursor = result.has_more ? result.next_cursor ?? undefined : undefined;
    } while (cursor && found.length < 2000);

    const rootId = rootPageId();
    if (!found.some((page) => normalizeId(page.id) === rootId)) {
      found.push(await notionApi<JsonObject>(`/pages/${rootId}`));
    }

    return found
      .filter(isVisiblePage)
      .map(toPageSummary)
      .filter((page) => Boolean(page.title));
  }, CACHE_SECONDS, force);
}

export async function getNotionPage(pageId: string, force = false): Promise<NotionPageBundle | null> {
  const id = normalizeId(pageId);
  const allowed = await listNotionPages(force);
  if (!allowed.some((page) => normalizeId(page.id) === id)) return null;

  return cached(`notion:page:${id}`, async () => {
    const rawPage = await notionApi<JsonObject>(`/pages/${id}`);
    if (!isVisiblePage(rawPage)) throw new Error("这篇内容未公开");
    return {
      page: toPageSummary(rawPage),
      blocks: await retrieveChildren(id, 0),
    };
  }, CACHE_SECONDS, force);
}

export async function clearNotionCache() {
  memoryCache.clear();
  if (!env.DB) return;
  await ensureCacheTables();
  await env.DB.prepare("DELETE FROM notion_cache WHERE cache_key LIKE 'notion:%'").run();
}

export async function saveWebhookToken(value: string) {
  if (!env.DB) return false;
  await ensureCacheTables();
  await env.DB.prepare(
    "INSERT INTO notion_settings(setting_key, setting_value, updated_at) VALUES('webhook_token', ?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at",
  ).bind(value, Date.now()).run();
  return true;
}

export async function getWebhookToken() {
  const configured = env.NOTION_WEBHOOK_SECRET?.trim();
  if (configured) return configured;
  if (!env.DB) return null;
  await ensureCacheTables();
  const row = await env.DB.prepare("SELECT setting_value FROM notion_settings WHERE setting_key = 'webhook_token'").first<{ setting_value: string }>();
  return row?.setting_value ?? null;
}

async function retrieveChildren(blockId: string, depth: number): Promise<NotionBlock[]> {
  if (depth > 20) return [];
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ page_size: "100" });
    if (cursor) params.set("start_cursor", cursor);
    const response = await notionApi<JsonObject>(`/blocks/${normalizeId(blockId)}/children?${params}`);
    blocks.push(...(response.results ?? []));
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  for (const block of blocks) {
    if (block.has_children) block.children = await retrieveChildren(block.id, depth + 1);
  }
  return blocks;
}

async function notionApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  let release!: () => void;
  const previous = requestQueue;
  requestQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  const wait = Math.max(0, nextRequestAt - Date.now());
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  nextRequestAt = Date.now() + 340;

  try {
    const response = await fetch(`https://api.notion.com/v1${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token()}`,
        "notion-version": NOTION_VERSION,
        "content-type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      throw new Error(`Notion API ${response.status}: ${details}`);
    }
    return await response.json() as T;
  } finally {
    release();
  }
}

async function cached<T>(key: string, loader: () => Promise<T>, ttlSeconds: number, force: boolean): Promise<T> {
  const now = Date.now();
  if (!force) {
    const memory = memoryCache.get(key);
    if (memory && memory.expiresAt > now) return memory.value as T;
    const stored = await readD1Cache<T>(key, now);
    if (stored !== null) {
      memoryCache.set(key, { value: stored, expiresAt: now + ttlSeconds * 1000 });
      return stored;
    }
  }
  const value = await loader();
  const expiresAt = now + ttlSeconds * 1000;
  memoryCache.set(key, { value, expiresAt });
  await writeD1Cache(key, value, expiresAt);
  return value;
}

async function readD1Cache<T>(key: string, now: number): Promise<T | null> {
  if (!env.DB) return null;
  await ensureCacheTables();
  const row = await env.DB.prepare("SELECT value_json, expires_at FROM notion_cache WHERE cache_key = ?").bind(key).first<{ value_json: string; expires_at: number }>();
  if (!row || row.expires_at <= now) return null;
  try { return JSON.parse(row.value_json) as T; } catch { return null; }
}

async function writeD1Cache(key: string, value: unknown, expiresAt: number) {
  if (!env.DB) return;
  await ensureCacheTables();
  await env.DB.prepare(
    "INSERT INTO notion_cache(cache_key, value_json, expires_at, updated_at) VALUES(?, ?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET value_json = excluded.value_json, expires_at = excluded.expires_at, updated_at = excluded.updated_at",
  ).bind(key, JSON.stringify(value), expiresAt, Date.now()).run();
}

async function ensureCacheTables() {
  if (!env.DB) return;
  if (!cacheReady) {
    cacheReady = (async () => {
      await env.DB!.prepare("CREATE TABLE IF NOT EXISTS notion_cache (cache_key TEXT PRIMARY KEY, value_json TEXT NOT NULL, expires_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)").run();
      await env.DB!.prepare("CREATE TABLE IF NOT EXISTS notion_settings (setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL, updated_at INTEGER NOT NULL)").run();
    })().catch((error) => { cacheReady = null; throw error; });
  }
  await cacheReady;
}

function toPageSummary(page: JsonObject): NotionPageSummary {
  const parent = page.parent ?? {};
  return {
    id: normalizeId(page.id),
    title: pageTitle(page),
    parentId: parent.type === "page_id" ? normalizeId(parent.page_id) : null,
    updatedAt: page.last_edited_time ?? new Date().toISOString(),
    createdAt: page.created_time ?? page.last_edited_time ?? new Date().toISOString(),
    icon: iconValue(page.icon),
    cover: fileUrl(page.cover),
  };
}

function pageTitle(page: JsonObject) {
  const properties = Object.values(page.properties ?? {}) as JsonObject[];
  const titleProperty = properties.find((property) => property?.type === "title");
  return richPlain(titleProperty?.title) || "未命名";
}

function isVisiblePage(page: JsonObject) {
  if (page.archived || page.in_trash) return false;
  const entries = Object.entries(page.properties ?? {}) as [string, JsonObject][];
  const publish = entries.find(([name, property]) =>
    property?.type === "checkbox" && ["公开", "发布", "published", "public"].includes(name.trim().toLowerCase()),
  );
  return publish ? Boolean(publish[1].checkbox) : true;
}

function richPlain(value: NotionRichText[] | undefined) {
  return (value ?? []).map((item) => item.plain_text ?? "").join("").trim();
}

function iconValue(icon: JsonObject | null | undefined) {
  if (!icon) return null;
  if (icon.type === "emoji") return icon.emoji ?? null;
  return fileUrl(icon);
}

function fileUrl(file: JsonObject | null | undefined) {
  if (!file) return null;
  if (file.type === "file") return file.file?.url ?? null;
  if (file.type === "external") return file.external?.url ?? null;
  return null;
}

export function normalizeId(value: string) {
  const trimmed = value.trim();
  const uuid = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  if (uuid) return uuid.replaceAll("-", "").toLowerCase();
  const compact = trimmed.match(/([0-9a-f]{32})(?=[/?#]|$)/i)?.[1];
  return (compact ?? trimmed).replaceAll("-", "").toLowerCase();
}
