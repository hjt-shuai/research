"use client";

import { DEFAULT_GOALS, subjectStats } from "@/lib/scoring";
import { useAppStore } from "./AppStoreProvider";

export default function SubjectScoreCards() {
  const { store } = useAppStore();
  const stats = subjectStats(store.mocks, store.goals ?? DEFAULT_GOALS);
  const hasData = store.mocks.length > 0;

  return (
    <section className="subject-scores" aria-label="各科当前成绩">
      <h2 className="section-title">各科当前成绩</h2>
      <div className="subject-scores-grid">
        {stats.map((s) => (
          <article className="card subject-score-card" key={s.subject}>
            <header className="subject-score-head">
              <span className="subject-dot" style={{ background: s.color }} />
              <h3>{s.name}</h3>
            </header>
            <p className="subject-score-target">{s.target} 目标</p>
            {hasData ? (
              <>
                <dl className="subject-score-dl">
                  <div>
                    <dt>最近一次</dt>
                    <dd>{s.last ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>近 3 次平均</dt>
                    <dd>{s.avg3 ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>距离目标</dt>
                    <dd>{s.gap ?? "—"}</dd>
                  </div>
                </dl>
                <div className="subject-bar" aria-hidden>
                  <span
                    style={{ width: `${s.completion}%`, background: s.color }}
                  />
                </div>
                <p className="subject-score-pct">完成度 {s.completion}%</p>
              </>
            ) : (
              <p className="hint">暂无模考数据</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
