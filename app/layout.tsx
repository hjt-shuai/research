import type { Metadata } from "next";
import { AppStoreProvider } from "@/components/AppStoreProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "考研备考中心 · 电子科技大学计算机技术",
  description:
    "电子科技大学 085404 计算机技术考研备考中心：目标分追踪、模考、知识掌握度与月度复习计划。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>
        <AppStoreProvider>{children}</AppStoreProvider>
      </body>
    </html>
  );
}
