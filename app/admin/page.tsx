import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin-auth";
import { listAllPages } from "@/lib/archive-db";
import { AdminClient } from "./admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminPage();
  const pages = await listAllPages();
  return (
    <main className="admin-shell">
      <header className="admin-topbar"><div><Link href="/"><ArrowLeft size={17} />返回档案馆</Link><h1>内容管理</h1></div><form action="/api/auth/logout" method="post"><button type="submit" className="logout-button">退出登录</button></form></header>
      <AdminClient initialPages={pages} />
    </main>
  );
}
