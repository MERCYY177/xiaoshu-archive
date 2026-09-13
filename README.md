# 私人档案馆

一个部署在 Cloudflare Workers 上的个人写作网站：浏览器里写作后自动保存，发布状态变化立即生效，不需要为每篇文章重新构建网站。

## 功能

- 网页管理后台与 1.2 秒自动保存
- 草稿、公开、隐藏和回收站状态
- 直接导入 Notion 导出的 ZIP（页面层级、图片和视频）
- D1 保存文章与版本，R2 保存附件
- JSON 内容备份
- 管理密码使用 Cloudflare Secret 保存，不写入 GitHub

## Cloudflare 资源

部署后需要在 Worker 的 Bindings 中添加：

- D1 数据库绑定名：`DB`
- R2 Bucket 绑定名：`BUCKET`
- Secret 变量名：`ADMIN_PASSWORD`（至少 12 位）

然后在 D1 控制台执行 `drizzle/0000_sturdy_lily_hollister.sql` 初始化表结构。

## 本地命令

```bash
pnpm install
pnpm build
pnpm dev
```

部署配置见 `wrangler.jsonc`。文章和附件不会提交到这个代码仓库。
