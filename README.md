# 私人档案馆 · Notion 展示站

一个部署在 Cloudflare Workers 上的 Notion 展示前台。日常内容与图片继续写在 Notion，网站自动读取并按独立样式展示；GitHub只保存程序代码，不保存文章图片。

## 工作方式

- Notion 是写作后台与媒体源
- Cloudflare Worker 是公开阅读前台
- D1 仅保存5分钟缓存，缓存直接覆盖，不创建版本历史
- Notion图片字节不会写入 D1、GitHub或 R2
- 手动同步与 Webhook 自动刷新均受支持
- 首页不使用人物名字，具体名称只出现在分类和文章中

## 必需配置

在 Cloudflare Worker 的 **Settings → Variables and Secrets** 添加：

- `NOTION_TOKEN`：Notion内部集成密钥，使用 Secret 类型
- `NOTION_ROOT_PAGE_ID`：档案根页面 ID
- `ADMIN_PASSWORD`：同步页面密码，至少12位，使用 Secret 类型

然后在 Notion根页面的连接设置中，把页面授权给同一个内部集成。父页面授权后，子页面会继承访问权限。

## 可选配置

- D1数据库绑定名：`DB`
- Webhook签名密钥：`NOTION_WEBHOOK_SECRET`

D1表会在首次访问时自动创建，不需要手动执行 SQL。D1未绑定时网站仍可读取 Notion，但跨请求缓存和 Webhook验证令牌不会持久保存。

## 自动更新

Webhook地址：

```text
https://你的站点地址/api/notion/webhook
```

在 Notion集成后台创建 Webhook订阅后，Notion会向该地址发送一次验证令牌。绑定 D1时，令牌会显示在网站的 `/admin` 同步页面。订阅 `page.content_updated`、`page.properties_updated`、`page.created`、`page.deleted` 等页面事件即可在编辑后清理缓存。

即使不配置 Webhook，网站缓存也只保留5分钟；登录 `/admin` 还可以点击“立即同步 Notion”。

## 公开范围

集成只能读取授权给它的页面。最稳妥的方式是只授权一个专门用于公开展示的根页面，不要把整个工作区授权给集成。

如果页面属于 Notion数据库，可以添加名为 `公开`、`发布`、`Published` 或 `Public` 的复选框属性：存在该属性时，只有勾选的页面会展示；普通子页面没有这些属性时默认展示。

## 本地命令

```bash
pnpm install
pnpm build
pnpm dev
```

部署配置见 `wrangler.jsonc`。
