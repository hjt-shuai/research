import type { SubjectId } from "./plan";
import { linkedTaskProgress, type LinkedProgress } from "./kpTasks";
import type { MasteryMap, MasteryState, StudyStatus } from "./types";

export type KpNode = { id: string; name: string; children?: KpNode[] };

export const KNOWLEDGE: Record<SubjectId, KpNode[]> = {
  math: [
    { id: "math-calc", name: "高等数学" },
    { id: "math-linalg", name: "线性代数" },
    { id: "math-prob", name: "概率论与数理统计" },
  ],
  english: [
    { id: "en-vocab", name: "词汇" },
    { id: "en-longsent", name: "长难句" },
    { id: "en-reading", name: "阅读" },
    { id: "en-translation", name: "翻译" },
    { id: "en-cloze", name: "完型" },
    { id: "en-writing", name: "作文" },
  ],
  cs408: [
    {
      id: "408-ds",
      name: "数据结构",
      children: [
        { id: "408-ds-linear", name: "线性表" },
        { id: "408-ds-stack", name: "栈、队列与数组" },
        { id: "408-ds-tree", name: "树与二叉树" },
        { id: "408-ds-graph", name: "图" },
        { id: "408-ds-search", name: "查找" },
        { id: "408-ds-sort", name: "排序" },
      ],
    },
    {
      id: "408-co",
      name: "计算机组成原理",
      children: [
        { id: "408-co-data", name: "数据的表示与运算" },
        { id: "408-co-mem", name: "存储系统" },
        { id: "408-co-instr", name: "指令系统" },
        { id: "408-co-cpu", name: "中央处理器" },
        { id: "408-co-bus", name: "总线与输入输出" },
      ],
    },
    {
      id: "408-os",
      name: "操作系统",
      children: [
        { id: "408-os-process", name: "进程与线程" },
        { id: "408-os-schedule", name: "处理机调度" },
        { id: "408-os-sync", name: "同步与互斥" },
        { id: "408-os-mem", name: "内存管理" },
        { id: "408-os-file", name: "文件系统" },
        { id: "408-os-io", name: "输入输出管理" },
      ],
    },
    {
      id: "408-net",
      name: "计算机网络",
      children: [
        { id: "408-net-arch", name: "体系结构" },
        { id: "408-net-phy", name: "物理层" },
        { id: "408-net-link", name: "数据链路层" },
        { id: "408-net-net", name: "网络层" },
        { id: "408-net-trans", name: "传输层" },
        { id: "408-net-app", name: "应用层" },
      ],
    },
  ],
  politics: [
    { id: "pol-marx", name: "马克思主义基本原理" },
    { id: "pol-mao", name: "毛泽东思想和中国特色社会主义理论体系" },
    { id: "pol-history", name: "中国近现代史纲要" },
    { id: "pol-ethics", name: "思想道德与法治" },
    { id: "pol-current", name: "形势与政策 / 时政" },
  ],
};

export function leavesOf(nodes: KpNode[]): KpNode[] {
  const out: KpNode[] = [];
  for (const n of nodes) {
    if (n.children && n.children.length) out.push(...leavesOf(n.children));
    else out.push(n);
  }
  return out;
}

export const KP_INDEX: Record<string, KpNode> = (() => {
  const map: Record<string, KpNode> = {};
  const walk = (nodes: KpNode[]) => {
    for (const n of nodes) {
      map[n.id] = n;
      if (n.children) walk(n.children);
    }
  };
  for (const key of Object.keys(KNOWLEDGE) as SubjectId[]) walk(KNOWLEDGE[key]);
  return map;
})();

export function kpName(id: string): string {
  return KP_INDEX[id]?.name ?? id;
}

export function defaultMastery(): MasteryState {
  return { status: "not-started", taskDone: false, accuracy: null, weak: false };
}

const STATUS_SCORE: Record<StudyStatus, number> = {
  "not-started": 0,
  learning: 50,
  mastered: 100,
};

/**
 * 掌握度 = 任务完成度 + 学习状态 + 测试正确率 的综合。
 * 「任务完成度」优先取关联月度任务的完成比例（勾了月度任务就自动带上），
 * 手动勾选“任务已完成”视为 100%。
 */
export function computeMastery(
  m?: MasteryState,
  linked?: LinkedProgress | null,
): number {
  if (!m && !linked?.ratio) return 0;
  const state = m ?? defaultMastery();
  const manualScore = state.taskDone ? 100 : 0;
  const autoScore = linked?.ratio != null ? linked.ratio * 100 : 0;
  const taskScore = Math.max(manualScore, autoScore);
  const statusScore = STATUS_SCORE[state.status] ?? 0;
  if (state.accuracy == null) {
    return Math.round(taskScore * 0.5 + statusScore * 0.5);
  }
  return Math.round(taskScore * 0.4 + statusScore * 0.3 + state.accuracy * 0.3);
}

type DoneMap = Record<string, boolean>;

export function kpMastery(
  kpId: string,
  map: MasteryMap,
  done: DoneMap = {},
): number {
  return computeMastery(map[kpId], linkedTaskProgress(kpId, done));
}

export function nodeMastery(
  node: KpNode,
  map: MasteryMap,
  done: DoneMap = {},
): number {
  if (node.children && node.children.length) {
    const vals = leavesOf(node.children).map((leaf) =>
      kpMastery(leaf.id, map, done),
    );
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return kpMastery(node.id, map, done);
}

export function subjectMastery(
  subject: SubjectId,
  map: MasteryMap,
  done: DoneMap = {},
): number {
  const leaves = leavesOf(KNOWLEDGE[subject]);
  if (!leaves.length) return 0;
  const total = leaves.reduce(
    (sum, leaf) => sum + kpMastery(leaf.id, map, done),
    0,
  );
  return Math.round(total / leaves.length);
}

export function weakPoints(
  map: MasteryMap,
  done: DoneMap = {},
): { id: string; name: string; mastery: number }[] {
  return Object.keys(map)
    .filter((id) => map[id]?.weak)
    .map((id) => ({ id, name: kpName(id), mastery: kpMastery(id, map, done) }))
    .sort((a, b) => a.mastery - b.mastery);
}
