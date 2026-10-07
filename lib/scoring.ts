import { SUBJECTS, type SubjectId } from "./plan";
import type { Goals, MockExam } from "./types";

export const TARGET_TIERS: { key: string; label: string; value: number }[] = [
  { key: "safety", label: "保底目标", value: 365 },
  { key: "main", label: "主目标", value: 375 },
  { key: "sprint", label: "冲刺目标", value: 385 },
];

export const MAIN_TARGET = 375;

export const DEFAULT_GOALS: Goals = {
  politics: 70,
  english: 70,
  math: 120,
  cs408: 115,
};

/** 各科满分（101 政治 / 201 英语一 100 分，301 数学一 / 408 各 150 分） */
export const SUBJECT_MAX: Record<SubjectId, number> = {
  politics: 100,
  english: 100,
  math: 150,
  cs408: 150,
};

export function clampGoal(subject: SubjectId, value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_GOALS[subject];
  return Math.max(0, Math.min(SUBJECT_MAX[subject], Math.round(n)));
}

export function clampGoals(raw: Partial<Goals> | null | undefined): Goals {
  const out: Goals = { ...DEFAULT_GOALS };
  if (!raw || typeof raw !== "object") return out;
  for (const s of SUBJECTS) {
    const v = (raw as Partial<Goals>)[s.id];
    if (v !== undefined && v !== null) out[s.id] = clampGoal(s.id, v);
  }
  return out;
}

export function goalsTotal(goals: Goals): number {
  return SUBJECTS.reduce((n, s) => n + goals[s.id], 0);
}

export function examTotal(m: MockExam): number {
  return m.politics + m.english + m.math + m.cs408;
}

export function sortByDateAsc(mocks: MockExam[]): MockExam[] {
  return [...mocks].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function recentFirst(mocks: MockExam[]): MockExam[] {
  return sortByDateAsc(mocks).reverse();
}

export function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export type SubjectStat = {
  subject: SubjectId;
  name: string;
  color: string;
  target: number;
  last: number | null;
  avg3: number | null;
  gap: number | null;
  completion: number;
};

export function subjectStats(mocks: MockExam[], goals: Goals): SubjectStat[] {
  const sorted = sortByDateAsc(mocks);
  return SUBJECTS.map((s) => {
    const target = goals[s.id];
    const scores = sorted.map((m) => m[s.id]);
    const last = scores.length ? scores[scores.length - 1] : null;
    const lastN = scores.slice(-3);
    const avg3 = lastN.length ? Math.round(avg(lastN)) : null;
    const gap = avg3 == null ? null : target - avg3;
    const completion =
      avg3 == null || target <= 0 ? 0 : Math.max(0, Math.round((avg3 / target) * 100));
    return {
      subject: s.id,
      name: s.name,
      color: s.color,
      target,
      last,
      avg3,
      gap,
      completion,
    };
  });
}

export type AnalysisResult = {
  count: number;
  latestTotal: number | null;
  prediction: number | null;
  weakest: SubjectStat | null;
  strongest: SubjectStat | null;
  biggestGap: SubjectStat | null;
  improving: boolean;
  overallDelta: number;
  declining: SubjectId[];
};

export function predictionFrom(mocks: MockExam[]): { value: number | null; count: number } {
  const sorted = sortByDateAsc(mocks);
  if (!sorted.length) return { value: null, count: 0 };
  const totals = sorted.map(examTotal);
  const value = Math.round(avg(totals.slice(-3)));
  return { value, count: sorted.length };
}

export function analyze(mocks: MockExam[], goals: Goals): AnalysisResult {
  const sorted = sortByDateAsc(mocks);
  const count = sorted.length;
  if (!count) {
    return {
      count: 0,
      latestTotal: null,
      prediction: null,
      weakest: null,
      strongest: null,
      biggestGap: null,
      improving: false,
      overallDelta: 0,
      declining: [],
    };
  }

  const stats = subjectStats(mocks, goals).filter((s) => s.avg3 != null);
  const ranked = [...stats].sort((a, b) => a.completion - b.completion);
  const weakest = ranked[0] ?? null;
  const strongest = ranked[ranked.length - 1] ?? null;
  const biggestGap =
    [...stats].sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0] ?? null;

  const totals = sorted.map(examTotal);
  const latestTotal = totals[totals.length - 1];
  const prevAvg = totals.length > 1 ? avg(totals.slice(-4, -1)) : latestTotal;
  const overallDelta = Math.round(latestTotal - prevAvg);
  const improving = overallDelta > 0;

  const declining: SubjectId[] = [];
  if (count >= 2) {
    for (const s of SUBJECTS) {
      const scores = sorted.map((m) => m[s.id]);
      const last = scores[scores.length - 1];
      const prev = avg(scores.slice(-4, -1));
      if (last < prev - 2) declining.push(s.id);
    }
  }

  return {
    count,
    latestTotal,
    prediction: Math.round(avg(totals.slice(-3))),
    weakest,
    strongest,
    biggestGap,
    improving,
    overallDelta,
    declining,
  };
}
