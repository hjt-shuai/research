import { PLAN, type SubjectId } from "./plan";

export type PlanTaskRef = {
  id: string;
  monthId: string;
  subject: SubjectId;
  text: string;
};

export function taskId(monthId: string, index: number): string {
  return `${monthId}-${index}`;
}

export function allTasks(): PlanTaskRef[] {
  const out: PlanTaskRef[] = [];
  for (const month of PLAN) {
    month.tasks.forEach((task, i) => {
      out.push({
        id: taskId(month.id, i),
        monthId: month.id,
        subject: task.subject,
        text: task.text,
      });
    });
  }
  return out;
}

export const ALL_TASKS = allTasks();
export const TOTAL_TASKS = ALL_TASKS.length;

export type SubjectProgress = { done: number; total: number; pct: number };

export function subjectProgress(
  done: Record<string, boolean>,
): Record<SubjectId, SubjectProgress> {
  const stats: Record<SubjectId, SubjectProgress> = {
    math: { done: 0, total: 0, pct: 0 },
    english: { done: 0, total: 0, pct: 0 },
    cs408: { done: 0, total: 0, pct: 0 },
    politics: { done: 0, total: 0, pct: 0 },
  };
  for (const t of ALL_TASKS) {
    stats[t.subject].total += 1;
    if (done[t.id]) stats[t.subject].done += 1;
  }
  for (const key of Object.keys(stats) as SubjectId[]) {
    const s = stats[key];
    s.pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  }
  return stats;
}

export function overallProgress(done: Record<string, boolean>): SubjectProgress {
  let d = 0;
  for (const t of ALL_TASKS) if (done[t.id]) d += 1;
  return {
    done: d,
    total: TOTAL_TASKS,
    pct: TOTAL_TASKS ? Math.round((d / TOTAL_TASKS) * 100) : 0,
  };
}

export function monthProgress(
  monthId: string,
  done: Record<string, boolean>,
): SubjectProgress {
  const tasks = ALL_TASKS.filter((t) => t.monthId === monthId);
  const d = tasks.filter((t) => done[t.id]).length;
  return {
    done: d,
    total: tasks.length,
    pct: tasks.length ? Math.round((d / tasks.length) * 100) : 0,
  };
}

export function phaseNameOfMonth(monthId: string): string {
  return PLAN.find((m) => m.id === monthId)?.phase ?? "";
}

export function phaseProgress(
  done: Record<string, boolean>,
): Record<string, SubjectProgress> {
  const out: Record<string, SubjectProgress> = {};
  for (const t of ALL_TASKS) {
    const phase = phaseNameOfMonth(t.monthId);
    if (!out[phase]) out[phase] = { done: 0, total: 0, pct: 0 };
    out[phase].total += 1;
    if (done[t.id]) out[phase].done += 1;
  }
  for (const key of Object.keys(out)) {
    const s = out[key];
    s.pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  }
  return out;
}

export function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function currentMonthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthPlanById(monthId: string) {
  return PLAN.find((m) => m.id === monthId) ?? null;
}

export function currentMonthPlan(d: Date = new Date()) {
  const key = currentMonthKey(d);
  return (
    monthPlanById(key) ??
    (PLAN.find((m) => m.id >= key) ?? PLAN[PLAN.length - 1])
  );
}
