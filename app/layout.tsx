import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "私人档案馆",
  description: "由 Notion 自动同步的个人写作档案馆",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
