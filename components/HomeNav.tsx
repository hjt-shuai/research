import Link from "next/link";

export default function HomeNav() {
  return (
    <nav className="home-nav" aria-label="功能导航">
      <Link href="/mock">模考中心</Link>
      <Link href="/knowledge">知识掌握度</Link>
      <Link href="/ai">AI 学习助手</Link>
    </nav>
  );
}
