"use client";

import {
  consecutiveDays,
  formatHours,
  manualForDate,
  minutesThisWeek,
  minutesToday,
  monthStudyDays,
} from "@/lib/streak";
import { localDateKey } from "@/lib/progress";
import { useAppStore } from "./AppStoreProvider";

export default function StudyStreak() {
  const { store, setTodayMinutes } = useAppStore();
  const manual = store.manualMinutes;
  const todayKey = localDateKey();
  const streak = consecutiveDays(store.studyLog);
  const monthDays = monthStudyDays(store.studyLog);
  const todayMin = minutesToday(store.studyLog, manual);
  const weekMin = minutesThisWeek(store.studyLog, manual);
  const todayManual = manualForDate(manual, todayKey);

  return (
    <section className="card study-streak" aria-label="连续学习">
      <h2 className="section-title">学习记录</h2>
      <div className="streak-grid">
        <div>
          <p className="streak-label">连续学习</p>
          <p className="streak-value">{streak} 天</p>
        </div>
        <div>
          <p className="streak-label">本月学习天数</p>
          <p className="streak-value">{monthDays} 天</p>
        </div>
        <div>
          <p className="streak-label">今日学习时长</p>
          <p className="streak-value">{formatHours(todayMin)} 小时</p>
        </div>
        <div>
          <p className="streak-label">本周学习时长</p>
          <p className="streak-value">{formatHours(weekMin)} 小时</p>
        </div>
      </div>
      <label className="manual-minutes">
        今日额外时长（分钟）
        <input
          type="number"
          min={0}
          max={1440}
          step={10}
          value={todayManual || ""}
          placeholder="0"
          onChange={(e) => setTodayMinutes(Number(e.target.value) || 0)}
        />
      </label>
      <p className="hint">
        完成任意任务即计为当日学习；每项任务默认计 30 分钟，额外时长按日期分开记录，
        不会累加到其它日期。
      </p>
    </section>
  );
}
