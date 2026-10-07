"use client";

import { PHASES } from "@/lib/plan";
import { phaseProgress } from "@/lib/progress";
import { useAppStore } from "./AppStoreProvider";

export default function PhaseCards() {
  const { store } = useAppStore();
  const phases = phaseProgress(store.tasks);

  return (
    <section className="phase-cards" aria-label="备考阶段">
      <h2 className="section-title">六阶段备考计划</h2>
      <div className="phase-cards-grid">
        {PHASES.map((p) => {
          const st = phases[p.name] ?? { done: 0, total: 0, pct: 0 };
          const remaining = st.total - st.done;
          return (
            <article className="card phase-card" key={p.name}>
              <header>
                <h3>{p.name}</h3>
                <p className="phase-card-range">{p.detail}</p>
              </header>
              <ul className="phase-goals">
                {p.goals.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
              <div className="overall-bar" role="progressbar" aria-valuenow={st.pct}>
                <span style={{ width: `${st.pct}%` }} />
              </div>
              <p className="phase-card-stat">
                完成 {st.pct}% · 剩余 {remaining} 项任务
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
