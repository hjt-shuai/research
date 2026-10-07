"use client";

import { SUBJECTS } from "@/lib/plan";
import { overallProgress, subjectProgress } from "@/lib/progress";
import { useAppStore } from "./AppStoreProvider";

export default function StudyProgress() {
  const { store, resetTasks } = useAppStore();
  const done = store.tasks;
  const overall = overallProgress(done);
  const subjectStats = subjectProgress(done);

  const onReset = () => {
    if (overall.done === 0) {
      window.alert("当前没有已勾选的任务。");
      return;
    }
    const ok = window.confirm(
      `确认重置进度？\n\n将取消 ${overall.done} 项已完成任务的勾选。\n模考记录、知识掌握度、目标分都不会受影响。`,
    );
    if (ok) resetTasks();
  };

  return (
    <div className="card progress-card">
      <div className="progress-head">
        <div>
          <p className="eyebrow">整体进度</p>
          <p className="progress-big">
            {overall.done}
            <span> / {overall.total} 项任务</span>
          </p>
        </div>
        <button className="ghost-btn" onClick={onReset} type="button">
          重置进度
        </button>
      </div>

      <div className="overall-bar" role="progressbar" aria-valuenow={overall.pct}>
        <span style={{ width: `${overall.pct}%` }} />
      </div>
      <p className="overall-pct">总体完成率 {overall.pct}%</p>

      <div className="subject-bars">
        {SUBJECTS.map((s) => {
          const st = subjectStats[s.id];
          return (
            <div className="subject-row" key={s.id}>
              <span className="subject-dot" style={{ background: s.color }} />
              <span className="subject-label">
                {s.short} {st.pct}%
              </span>
              <span className="subject-bar">
                <span style={{ width: `${st.pct}%`, background: s.color }} />
              </span>
              <span className="subject-count">
                {st.done}/{st.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
