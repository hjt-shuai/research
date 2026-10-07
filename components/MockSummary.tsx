"use client";

import Link from "next/link";
import {
  MAIN_TARGET,
  avg,
  examTotal,
  recentFirst,
  sortByDateAsc,
} from "@/lib/scoring";
import { useAppStore } from "./AppStoreProvider";

export default function MockSummary() {
  const { store } = useAppStore();
  const recent = recentFirst(store.mocks).slice(0, 3);
  const totals = sortByDateAsc(store.mocks).map(examTotal);
  const avg3 = totals.length ? Math.round(avg(totals.slice(-3))) : null;
  const best = totals.length ? Math.max(...totals) : null;
  const latest = totals.length ? totals[totals.length - 1] : null;
  const gap = latest != null ? latest - MAIN_TARGET : null;

  return (
    <section className="card mock-summary" aria-label="最近模考">
      <div className="section-head-row">
        <h2 className="section-title">最近模考</h2>
        <Link className="text-link" href="/mock">
          进入模考中心 →
        </Link>
      </div>
      {store.mocks.length === 0 ? (
        <p className="hint">
          尚未记录模考。完成一次完整模考后，预测分、成绩分析与趋势图都会自动亮起来。
        </p>
      ) : (
        <>
          <div className="mock-mini-stats">
            <div>
              <span className="mock-mini-label">考试次数</span>
              <span className="mock-mini-value">{store.mocks.length}</span>
            </div>
            <div>
              <span className="mock-mini-label">最高总分</span>
              <span className="mock-mini-value">{best ?? "—"}</span>
            </div>
            <div>
              <span className="mock-mini-label">近 3 次平均</span>
              <span className="mock-mini-value">{avg3 ?? "—"}</span>
            </div>
            <div>
              <span className="mock-mini-label">距主目标 {MAIN_TARGET}</span>
              <span className="mock-mini-value">
                {gap != null ? (gap >= 0 ? `+${gap}` : gap) : "—"}
              </span>
            </div>
          </div>
          <ul className="mock-recent-list">
            {recent.map((m) => (
              <li key={m.id}>
                <span className="mock-recent-name">{m.name}</span>
                <span className="mock-recent-total">{examTotal(m)} 分</span>
                <span className="mock-recent-date">{m.date}</span>
              </li>
            ))}
          </ul>
          <p className="hint">
            各科近 3 次平均见上方「成绩趋势」，可切换科目查看单科走势。
          </p>
        </>
      )}
    </section>
  );
}
