declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ADMIN_PASSWORD?: string;
    NOTION_TOKEN?: string;
    NOTION_ROOT_PAGE_ID?: string;
    NOTION_WEBHOOK_SECRET?: string;
  }
}
