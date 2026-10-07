"use client";

import { useEffect, useMemo, useState } from "react";
import { PLAN, SUBJECTS, SUBJECT_NAME } from "@/lib/plan";
import { currentMonthKey, monthProgress, phaseNameOfMonth } from "@/lib/progress";
import { useAppStore } from "./AppStoreProvider";
import TaskResources from "./TaskResources";

type Scope = "phase" | "all";

export default function MonthTasks() {
  const { store, toggleTask } = useAppStore();
  const done = store.tasks;
  const [currentMonth, setCurrentMonth] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("phase");

  useEffect(() => {
    setCurrentMonth(currentMonthKey());
  }, []);

  // 首屏（未挂载）时固定用第一个月，保证服务端与客户端渲染一致，挂载后再校正到真实月份
  const activeMonthId = useMemo(() => {
    if (currentMonth && PLAN.some((m) => m.id === currentMonth)) {
      return currentMonth;
    }
    if (currentMonth) {
      return PLAN.find((m) => m.id >= currentMonth)?.id ?? PLAN[PLAN.length - 1].id;
    }
    return PLAN[0].id;
  }, [currentMonth]);

  const activePhase = activeMonthId ? phaseNameOfMonth(activeMonthId) : "";
  const visibleMonths = useMemo(
    () => (scope === "all" ? PLAN : PLAN.filter((m) => m.phase === activePhase)),
    [scope, activePhase],
  );

  const hiddenCount = PLAN.length - visibleMonths.length;

  return (
    <section className="plan" id="months" aria-label="月度任务">
      <div className="section-head-row">
        <h2 className="section-title">月度任务</h2>
        <div className="scope-switch" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={scope === "phase"}
            className={scope === "phase" ? "is-active" : ""}
            onClick={() => setScope("phase")}
          >
            当前阶段
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "all"}
            className={scope === "all" ? "is-active" : ""}
            onClick={() => setScope("all")}
          >
            全部月份
          </button>
        </div>
      </div>
      <p className="section-note">
        {scope === "phase"
          ? `当前显示：${activePhase}（${visibleMonths.length} 个月）${hiddenCount > 0 ? `，另有 ${hiddenCount} 个月的计划可切换「全部月份」查看` : ""}`
          : "已展开 2026.10 – 2027.12 全部月份计划。"}
      </p>

      <div className="months">
        {visibleMonths.map((month) => {
          const stat = monthProgress(month.id, done);
          const isCurrent = currentMonth === month.id;
          return (
            <article
              className={`card month${isCurrent ? " is-current" : ""}`}
              key={month.id}
            >
              <header className="month-head">
                <div className="month-head-main">
                  <h3>{month.label}</h3>
                  <span className="phase-tag">{month.phase}</span>
                  {isCurrent && <span className="now-tag">当前</span>}
                </div>
                <span className="month-count">
                  {stat.done}/{stat.total} · {stat.pct}%
                </span>
              </header>
              <div className="month-bar" aria-hidden>
                <span style={{ width: `${stat.pct}%` }} />
              </div>
              <ul className="task-list">
                {month.tasks.map((task, i) => {
                  const id = `${month.id}-${i}`;
                  const isDone = !!done[id];
                  return (
                    <li key={id}>
                      <label className={`task${isDone ? " done" : ""}`}>
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => toggleTask(id)}
                        />
                        <span
                          className="task-tag"
                          style={{
                            background: SUBJECTS.find((s) => s.id === task.subject)
                              ?.color,
                          }}
                        >
                          {SUBJECT_NAME[task.subject]}
                        </span>
                        <span className="task-text">{task.text}</span>
                      </label>
                      <TaskResources taskId={id} />
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
