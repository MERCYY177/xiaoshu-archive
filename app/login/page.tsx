/* eslint-disable @next/next/no-html-link-for-pages */

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login-shell">
      <section className="login-card">
        <h1>管理后台</h1>
        <p>输入你在 Cloudflare 中设置的管理密码。</p>
        <form action="/api/auth/login" method="post">
          <label>管理密码<input name="password" type="password" autoComplete="current-password" required minLength={12} autoFocus /></label>
          <button type="submit">登录</button>
        </form>
        {error && <p className="login-error">密码不正确，或管理密码尚未配置。</p>}
        <a href="/" className="login-back">返回档案馆</a>
      </section>
    </main>
  );
}
