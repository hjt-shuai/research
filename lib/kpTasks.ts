import { ALL_TASKS, type PlanTaskRef } from "./progress";

/**
 * 知识点 ↔ 月度任务 关联表。
 *
 * 作用：让「知识掌握度」里的“任务完成度”自动取自月度任务勾选，
 * 避免同一个学习动作在两个地方各勾一次。
 * 规则：
 *   - 章节专项任务只挂在对应知识点上；
 *   - 真题套卷 / 模拟卷 / 错题回顾这类综合性任务，同时计入该科目的各模块。
 */

/** 408 综合任务：真题分章、套卷、错题整理、第一轮收尾 */
const M408_ALL = [
  "2027-06-2",
  "2027-07-2",
  "2027-08-2",
  "2027-09-2",
  "2027-10-2",
  "2027-11-2",
  "2027-12-2",
];

/** 数学综合任务：强化题集、真题套卷、冲刺模拟、错题回归 */
const MATH_ALL = [
  "2027-06-0",
  "2027-07-0",
  "2027-08-0",
  "2027-09-0",
  "2027-10-0",
  "2027-11-0",
  "2027-12-0",
];

export const KP_TASKS: Record<string, string[]> = {
  // ---------- 数学（301） ----------
  "math-calc": [
    "2026-10-0",
    "2026-11-0",
    "2026-12-0",
    "2027-02-0",
    "2027-03-0",
    "2027-05-0",
    ...MATH_ALL,
  ],
  "math-linalg": ["2026-12-0", "2027-01-0", "2027-04-0", ...MATH_ALL],
  "math-prob": ["2027-01-0", "2027-02-0", "2027-04-0", ...MATH_ALL],

  // ---------- 英语一（201） ----------
  "en-vocab": ["2026-10-1", "2026-11-1", "2026-12-3", "2027-01-1"],
  "en-longsent": ["2026-10-1", "2027-01-1"],
  "en-reading": [
    "2026-11-1",
    "2026-12-1",
    "2027-02-1",
    "2027-03-1",
    "2027-04-1",
    "2027-05-1",
    "2027-06-1",
    "2027-07-1",
    "2027-08-1",
    "2027-09-1",
    "2027-10-1",
    "2027-11-1",
    "2027-12-1",
  ],
  "en-translation": ["2027-01-1", "2027-05-1"],
  "en-cloze": ["2027-03-1", "2027-08-1"],
  "en-writing": [
    "2027-06-1",
    "2027-07-1",
    "2027-09-1",
    "2027-10-1",
    "2027-11-1",
    "2027-12-1",
  ],

  // ---------- 408 计算机学科专业基础 ----------
  "408-ds-linear": ["2026-10-2", ...M408_ALL],
  "408-ds-stack": ["2026-10-2", ...M408_ALL],
  "408-ds-tree": ["2026-11-2", ...M408_ALL],
  "408-ds-graph": ["2026-11-2", ...M408_ALL],
  "408-ds-search": ["2026-12-2", ...M408_ALL],
  "408-ds-sort": ["2026-12-2", ...M408_ALL],

  "408-co-data": ["2027-01-2", ...M408_ALL],
  "408-co-mem": ["2027-01-2", ...M408_ALL],
  "408-co-instr": ["2027-02-2", ...M408_ALL],
  "408-co-cpu": ["2027-02-2", ...M408_ALL],
  "408-co-bus": ["2027-02-2", ...M408_ALL],

  "408-os-process": ["2027-03-2", ...M408_ALL],
  "408-os-schedule": ["2027-03-2", ...M408_ALL],
  "408-os-sync": ["2027-03-2", ...M408_ALL],
  "408-os-mem": ["2027-04-2", ...M408_ALL],
  "408-os-file": ["2027-04-2", ...M408_ALL],
  "408-os-io": ["2027-04-2", ...M408_ALL],

  "408-net-arch": ["2027-05-2", ...M408_ALL],
  "408-net-phy": ["2027-05-2", ...M408_ALL],
  "408-net-link": ["2027-05-2", ...M408_ALL],
  "408-net-net": ["2027-05-2", ...M408_ALL],
  "408-net-trans": [...M408_ALL],
  "408-net-app": [...M408_ALL],

  // ---------- 政治（101） ----------
  "pol-marx": [
    "2027-03-3",
    "2027-04-3",
    "2027-05-3",
    "2027-07-3",
    "2027-08-3",
    "2027-09-3",
    "2027-10-3",
    "2027-11-3",
    "2027-12-3",
  ],
  "pol-mao": [
    "2027-05-3",
    "2027-06-3",
    "2027-07-3",
    "2027-08-3",
    "2027-09-3",
    "2027-10-3",
    "2027-11-3",
    "2027-12-3",
  ],
  "pol-history": [
    "2027-06-3",
    "2027-08-3",
    "2027-09-3",
    "2027-10-3",
    "2027-11-3",
    "2027-12-3",
  ],
  "pol-ethics": ["2027-09-3", "2027-10-3", "2027-11-3", "2027-12-3"],
  "pol-current": [
    "2027-02-3",
    "2027-09-3",
    "2027-10-3",
    "2027-11-3",
    "2027-12-3",
  ],
};

const TASK_INDEX: Record<string, PlanTaskRef> = (() => {
  const map: Record<string, PlanTaskRef> = {};
  for (const t of ALL_TASKS) map[t.id] = t;
  return map;
})();

/** 关联到该知识点的月度任务（去重，并自动忽略计划里已不存在的任务 id） */
export function taskIdsForKp(kpId: string): string[] {
  const out: string[] = [];
  for (const id of KP_TASKS[kpId] ?? []) {
    if (TASK_INDEX[id] === undefined) continue;
    if (out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

export function taskRef(id: string): PlanTaskRef | null {
  return TASK_INDEX[id] ?? null;
}

export type LinkedProgress = { done: number; total: number; ratio: number | null };

/** 该知识点关联任务的完成情况；没有关联任务时 ratio 为 null */
export function linkedTaskProgress(
  kpId: string,
  done: Record<string, boolean>,
): LinkedProgress {
  const ids = taskIdsForKp(kpId);
  if (!ids.length) return { done: 0, total: 0, ratio: null };
  const doneCount = ids.filter((id) => done[id]).length;
  return { done: doneCount, total: ids.length, ratio: doneCount / ids.length };
}
