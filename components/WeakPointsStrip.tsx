"use client";

import Link from "next/link";
import { weakPoints } from "@/lib/knowledge";
import { useAppStore } from "./AppStoreProvider";

export default function WeakPointsStrip() {
  const { store } = useAppStore();
  const weak = weakPoints(store.mastery, store.tasks);

  if (!weak.length) {
    return (
      <section className="card weak-strip" aria-label="薄弱知识点">
        <h2 className="section-title">当前薄弱知识点</h2>
        <p className="hint">
          暂无标记。可在{" "}
          <Link href="/knowledge">知识掌握度</Link>{" "}
          中把没吃透的知识点标记为薄弱，首页会集中提醒。
        </p>
      </section>
    );
  }

  return (
    <section className="card weak-strip" aria-label="薄弱知识点">
      <div className="section-head-row">
        <h2 className="section-title">当前薄弱知识点</h2>
        <Link className="text-link" href="/knowledge">
          去处理 →
        </Link>
      </div>
      <ul className="weak-list">
        {weak.slice(0, 8).map((w) => (
          <li key={w.id}>
            <span>{w.name}</span>
            <span className="weak-pct">掌握 {w.mastery}%</span>
          </li>
        ))}
      </ul>
      <p className="hint">优先补掌握度最低的知识点，效果最直接。</p>
    </section>
  );
}
