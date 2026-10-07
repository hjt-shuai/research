"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "首页" },
  { href: "/#months", label: "备考计划" },
  { href: "/resources", label: "📚 资料中心" },
  { href: "/schools", label: "🏫 院校情报" },
  { href: "/questions", label: "📝 真题" },
  { href: "/mock", label: "📊 模考" },
  { href: "/#analysis", label: "📈 成绩分析" },
  { href: "/updates", label: "⚠ 更新中心" },
  { href: "/ai", label: "🤖 AI 助手" },
];

/** 全站统一导航（首页与所有子页面共用） */
export default function AppNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="nav-pills" aria-label="功能导航">
      {LINKS.map((l) => {
        const base = l.href.split("#")[0];
        const active = base === "/" ? pathname === "/" : pathname === base;
        const isAnchor = l.href.includes("#");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={active && !isAnchor ? "is-active" : ""}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
