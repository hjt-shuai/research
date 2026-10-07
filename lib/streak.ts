import type { ManualMinutes, StudyLog } from "./types";
import { localDateKey } from "./progress";

export const MINUTES_PER_TASK = 30;

export function isStudyDay(log: { minutes: number; tasks: number } | undefined): boolean {
  if (!log) return false;
  return log.tasks >= 1 || log.minutes > 0;
}

export function consecutiveDays(studyLog: StudyLog, now: Date = new Date()): number {
  let count = 0;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  for (;;) {
    const key = localDateKey(d);
    if (!isStudyDay(studyLog[key])) break;
    count += 1;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

export function monthStudyDays(
  studyLog: StudyLog,
  now: Date = new Date(),
): number {
  const y = now.getFullYear();
  const m = now.getMonth();
  let n = 0;
  for (const [key, log] of Object.entries(studyLog)) {
    const [yy, mm] = key.split("-").map(Number);
    if (yy === y && mm - 1 === m && isStudyDay(log)) n += 1;
  }
  return n;
}

export function manualForDate(manual: ManualMinutes, dateKey: string): number {
  return manual[dateKey] ?? 0;
}

/** 今日手动补时：只取今天的记录，不把别的日期带进来 */
export function minutesToday(
  studyLog: StudyLog,
  manual: ManualMinutes,
  now: Date = new Date(),
): number {
  const key = localDateKey(now);
  return (studyLog[key]?.minutes ?? 0) + manualForDate(manual, key);
}

export function minutesThisWeek(
  studyLog: StudyLog,
  manual: ManualMinutes,
  now: Date = new Date(),
): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diff);

  let total = 0;
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const key = localDateKey(d);
    total += (studyLog[key]?.minutes ?? 0) + manualForDate(manual, key);
  }
  return total;
}

/** 写入某一天的手动补时；0 表示删除该天记录 */
export function setManualMinutes(
  manual: ManualMinutes,
  dateKey: string,
  minutes: number,
): ManualMinutes {
  const next = { ...manual };
  const rounded = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  if (!rounded) delete next[dateKey];
  else next[dateKey] = rounded;
  return next;
}

export function formatHours(minutes: number): string {
  if (minutes <= 0) return "0";
  const h = minutes / 60;
  return h < 10 ? h.toFixed(1) : String(Math.round(h));
}

export function bumpStudyLog(
  studyLog: StudyLog,
  dateKey: string,
  tasksDelta: number,
  minutesDelta: number,
): StudyLog {
  const prev = studyLog[dateKey] ?? { minutes: 0, tasks: 0 };
  return {
    ...studyLog,
    [dateKey]: {
      tasks: Math.max(0, prev.tasks + tasksDelta),
      minutes: Math.max(0, prev.minutes + minutesDelta),
    },
  };
}
