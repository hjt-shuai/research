"use client";

import { SUBJECT_NAME, SUBJECTS } from "@/lib/plan";
import { ALL_TASKS } from "@/lib/progress";
import { todayDoneCount } from "@/lib/todayTasks";
import { useAppStore } from "./AppStoreProvider";

export default function TodayTasks() {
  const { store, toggleTask, todayIds } = useAppStore();
  const done = todayDoneCount(todayIds, store.tasks);
  const total = todayIds.length;

  const tasks = todayIds
    .map((id) => ALL_TASKS.find((t) => t.id === id))
    .filter(Boolean);

  return (
    <section className="card today-tasks" aria-label="今日任务">
      <div className="section-head-row">
        <h2 className="section-title">今日任务</h2>
        <span className="today-count">
          今日完成 {done} / {total}
        </span>
      </div>
      <ul className="task-list">
        {tasks.map((task) => {
          if (!task) return null;
          const isDone = !!store.tasks[task.id];
          const color = SUBJECTS.find((s) => s.id === task.subject)?.color;
          return (
            <li key={task.id}>
              <label className={`task${isDone ? " done" : ""}`}>
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => toggleTask(task.id)}
                />
                <span className="task-tag" style={{ background: color }}>
                  {SUBJECT_NAME[task.subject]}
                </span>
                <span className="task-text">{task.text}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {total === 0 && <p className="hint">当前月份任务已全部完成，真棒！</p>}
    </section>
  );
}
