"use client";

import Link from "next/link";
import { KNOWLEDGE, nodeMastery, subjectMastery } from "@/lib/knowledge";
import { SUBJECTS, type SubjectId } from "@/lib/plan";
import { useAppStore } from "./AppStoreProvider";

function ModuleBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="mastery-row">
      <span className="mastery-row-label">{label}</span>
      <span className="mastery-row-bar">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="mastery-row-pct">{pct}%</span>
    </div>
  );
}

export default function MasteryOverview() {
  const { store } = useAppStore();
  const map = store.mastery;
  const done = store.tasks;

  return (
    <section className="mastery-overview" aria-label="知识掌握度">
      <div className="section-head-row">
        <h2 className="section-title">知识掌握度</h2>
        <Link className="text-link" href="/knowledge">
          查看详情 →
        </Link>
      </div>
      <p className="section-note">
        掌握度 = 关联月度任务完成度 + 学习状态 + 测试正确率。勾选月度任务会自动计入对应知识点。
      </p>
      <div className="mastery-grid">
        {SUBJECTS.map((s) => {
          const nodes = KNOWLEDGE[s.id];
          const overall = subjectMastery(s.id, map, done);
          return (
            <article className="card mastery-card" key={s.id}>
              <header className="mastery-card-head">
                <span className="subject-dot" style={{ background: s.color }} />
                <h3>{s.short}</h3>
                <span className="mastery-overall">{overall}%</span>
              </header>
              {nodes.map((n) => (
                <ModuleBar
                  key={n.id}
                  label={n.name}
                  pct={nodeMastery(n, map, done)}
                />
              ))}
              <Link className="text-link small" href={`/knowledge?subject=${s.id}`}>
                编辑 {s.short}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
