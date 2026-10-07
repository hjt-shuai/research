import type { SubjectId } from "./plan";
import { ALL_TASKS, currentMonthPlan, localDateKey } from "./progress";
import type { MasteryMap } from "./types";
import { weakPoints } from "./knowledge";

const MAX_TODAY = 5;
const MIN_TODAY = 3;

function weakSubjectSet(
  mastery: MasteryMap,
  done: Record<string, boolean>,
): Set<SubjectId> {
  const weak = weakPoints(mastery, done);
  const subjects = new Set<SubjectId>();
  for (const w of weak) {
    if (w.id.startsWith("408-")) subjects.add("cs408");
    else if (w.id.startsWith("math-")) subjects.add("math");
    else if (w.id.startsWith("en-")) subjects.add("english");
    else if (w.id.startsWith("pol-")) subjects.add("politics");
  }
  return subjects;
}

export function pickTodayTaskIds(
  done: Record<string, boolean>,
  mastery: MasteryMap,
  today: { date: string; ids: string[] } | null,
  now: Date = new Date(),
): string[] {
  const dateKey = localDateKey(now);
  if (today && today.date === dateKey && today.ids.length >= MIN_TODAY) {
    return today.ids.filter((id) => ALL_TASKS.some((t) => t.id === id));
  }

  const month = currentMonthPlan(now);
  const monthTasks = ALL_TASKS.filter((t) => t.monthId === month.id);
  const incomplete = monthTasks.filter((t) => !done[t.id]);
  const weakSubs = weakSubjectSet(mastery, done);

  const scored = incomplete.map((t) => {
    let score = 0;
    if (weakSubs.has(t.subject)) score += 10;
    return { id: t.id, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const picked: string[] = [];
  for (const s of scored) {
    if (picked.length >= MAX_TODAY) break;
    picked.push(s.id);
  }

  if (picked.length < MIN_TODAY) {
    for (const t of ALL_TASKS) {
      if (picked.length >= MIN_TODAY) break;
      if (!done[t.id] && !picked.includes(t.id)) picked.push(t.id);
    }
  }

  return picked.slice(0, MAX_TODAY);
}

export function todayDoneCount(
  ids: string[],
  done: Record<string, boolean>,
): number {
  return ids.filter((id) => done[id]).length;
}
