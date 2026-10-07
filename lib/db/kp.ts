import type { QuestionSubject } from "./types";

/**
 * 题库知识点树（严格按备考口径拆分）。
 * masteryId 指向 lib/knowledge.ts 里已有的掌握度知识点，用于把「错题」与
 * 「知识掌握度」打通；没有对应项时留空（不硬凑）。
 */
export type KpNode = {
  id: string;
  name: string;
  children?: KpNode[];
  /** 对应 lib/knowledge.ts 的掌握度知识点 id */
  masteryId?: string;
};

export type KpTree = { subject: QuestionSubject; label: string; roots: KpNode[] };

export const QUESTION_KP: KpTree[] = [
  {
    subject: "CS_408",
    label: "408 计算机学科专业基础",
    roots: [
      {
        id: "q408-ds",
        name: "数据结构",
        children: [
          { id: "q408-ds-linear", name: "线性表", masteryId: "408-ds-linear" },
          { id: "q408-ds-stack", name: "栈和队列", masteryId: "408-ds-stack" },
          { id: "q408-ds-tree", name: "树", masteryId: "408-ds-tree" },
          { id: "q408-ds-graph", name: "图", masteryId: "408-ds-graph" },
          { id: "q408-ds-search", name: "查找", masteryId: "408-ds-search" },
          { id: "q408-ds-sort", name: "排序", masteryId: "408-ds-sort" },
        ],
      },
      {
        id: "q408-co",
        name: "计算机组成原理",
        children: [
          { id: "q408-co-data", name: "数据表示", masteryId: "408-co-data" },
          { id: "q408-co-cpu", name: "CPU", masteryId: "408-co-cpu" },
          { id: "q408-co-instr", name: "指令系统", masteryId: "408-co-instr" },
          { id: "q408-co-mem", name: "存储系统", masteryId: "408-co-mem" },
          { id: "q408-co-io", name: "I/O", masteryId: "408-co-bus" },
        ],
      },
      {
        id: "q408-os",
        name: "操作系统",
        children: [
          { id: "q408-os-process", name: "进程线程", masteryId: "408-os-process" },
          { id: "q408-os-schedule", name: "CPU 调度", masteryId: "408-os-schedule" },
          { id: "q408-os-sync", name: "同步互斥", masteryId: "408-os-sync" },
          { id: "q408-os-deadlock", name: "死锁" },
          { id: "q408-os-mem", name: "内存", masteryId: "408-os-mem" },
          { id: "q408-os-file", name: "文件系统", masteryId: "408-os-file" },
          { id: "q408-os-io", name: "I/O", masteryId: "408-os-io" },
        ],
      },
      {
        id: "q408-net",
        name: "计算机网络",
        children: [
          { id: "q408-net-phy", name: "物理层", masteryId: "408-net-phy" },
          { id: "q408-net-link", name: "数据链路层", masteryId: "408-net-link" },
          { id: "q408-net-net", name: "网络层", masteryId: "408-net-net" },
          { id: "q408-net-trans", name: "传输层", masteryId: "408-net-trans" },
          { id: "q408-net-app", name: "应用层", masteryId: "408-net-app" },
        ],
      },
    ],
  },
  {
    subject: "MATH_1",
    label: "数学一",
    roots: [
      { id: "qmath-calc", name: "高等数学", masteryId: "math-calc" },
      { id: "qmath-linalg", name: "线性代数", masteryId: "math-linalg" },
      { id: "qmath-prob", name: "概率论", masteryId: "math-prob" },
      { id: "qmath-basic", name: "基础课程" },
      { id: "qmath-strong", name: "强化课程" },
      { id: "qmath-660", name: "660 题" },
      { id: "qmath-other", name: "其他题库" },
      { id: "qmath-real", name: "历年真题" },
      { id: "qmath-mock", name: "模拟卷" },
    ],
  },
  {
    subject: "ENGLISH_1",
    label: "英语一",
    roots: [
      { id: "qen-vocab", name: "单词", masteryId: "en-vocab" },
      { id: "qen-longsent", name: "长难句", masteryId: "en-longsent" },
      { id: "qen-reading", name: "阅读", masteryId: "en-reading" },
      { id: "qen-translation", name: "翻译", masteryId: "en-translation" },
      { id: "qen-cloze", name: "完型", masteryId: "en-cloze" },
      { id: "qen-newtype", name: "新题型" },
      { id: "qen-writing", name: "作文", masteryId: "en-writing" },
      { id: "qen-real", name: "历年真题" },
      { id: "qen-mock", name: "模拟题" },
    ],
  },
  {
    subject: "POLITICS",
    label: "政治",
    roots: [
      { id: "qpol-marx", name: "马原", masteryId: "pol-marx" },
      { id: "qpol-mao", name: "毛中特", masteryId: "pol-mao" },
      { id: "qpol-history", name: "史纲", masteryId: "pol-history" },
      { id: "qpol-ethics", name: "思修", masteryId: "pol-ethics" },
      { id: "qpol-current", name: "时政", masteryId: "pol-current" },
      { id: "qpol-1000", name: "1000 题" },
      { id: "qpol-xiao8", name: "肖八" },
      { id: "qpol-xiao4", name: "肖四" },
      { id: "qpol-mock", name: "模拟卷" },
    ],
  },
];

export const KP_INDEX: Record<string, { id: string; name: string; subject: QuestionSubject; masteryId?: string; parent?: string }> =
  (() => {
    const map: Record<
      string,
      { id: string; name: string; subject: QuestionSubject; masteryId?: string; parent?: string }
    > = {};
    for (const tree of QUESTION_KP) {
      const walk = (nodes: KpNode[], parent?: string) => {
        for (const n of nodes) {
          map[n.id] = { id: n.id, name: n.name, subject: tree.subject, masteryId: n.masteryId, parent };
          if (n.children) walk(n.children, n.id);
        }
      };
      walk(tree.roots);
    }
    return map;
  })();

export function kpLabel(id: string): string {
  const node = KP_INDEX[id];
  if (!node) return id || "未标注";
  const parent = node.parent ? KP_INDEX[node.parent] : undefined;
  return parent ? `${parent.name} · ${node.name}` : node.name;
}

export function kpOptions(subject: QuestionSubject): { id: string; label: string }[] {
  const tree = QUESTION_KP.find((t) => t.subject === subject);
  if (!tree) return [];
  const out: { id: string; label: string }[] = [];
  for (const root of tree.roots) {
    if (root.children?.length) {
      for (const child of root.children) {
        out.push({ id: child.id, label: `${root.name} · ${child.name}` });
      }
    } else {
      out.push({ id: root.id, label: root.name });
    }
  }
  return out;
}

/** 由知识点 id 找到掌握度知识点 id（用于与首页掌握度联动） */
export function masteryIdOf(kpId: string): string | null {
  return KP_INDEX[kpId]?.masteryId ?? null;
}

/** 由掌握度知识点 id 反查题库知识点（用于掌握度详情里跳真题） */
export function kpIdOfMastery(masteryId: string): string | null {
  for (const [id, node] of Object.entries(KP_INDEX)) {
    if (node.masteryId === masteryId) return id;
  }
  return null;
}
