export type SubjectId = "math" | "english" | "cs408" | "politics";

export const SUBJECTS: {
  id: SubjectId;
  name: string;
  short: string;
  color: string;
}[] = [
  { id: "math", name: "数学（一）", short: "数一", color: "var(--sub-math)" },
  { id: "english", name: "英语（一）", short: "英语", color: "var(--sub-english)" },
  { id: "cs408", name: "计算机学科专业基础 408", short: "408", color: "var(--sub-408)" },
  { id: "politics", name: "思想政治理论", short: "政治", color: "var(--sub-politics)" },
];

export const SUBJECT_NAME: Record<SubjectId, string> = {
  math: "数学（一）",
  english: "英语（一）",
  cs408: "408",
  politics: "政治",
};

export type Task = {
  subject: SubjectId;
  text: string;
};

export type MonthPlan = {
  id: string;
  label: string;
  phase: string;
  core: SubjectId;
  tasks: Task[];
};

export type PhaseDef = { name: string; detail: string; goals: string[] };

export const PHASES: PhaseDef[] = [
  {
    name: "基础起步",
    detail: "2026.10 – 2026.12",
    goals: ["数学高数基础", "数据结构入门", "英语词汇积累"],
  },
  {
    name: "基础强化",
    detail: "2027.01 – 2027.02",
    goals: ["数学全线铺开", "408 组成原理", "英语精读真题"],
  },
  {
    name: "强化阶段",
    detail: "2027.03 – 2027.06",
    goals: ["数学强化", "408 第一轮完成", "英语真题", "政治启动"],
  },
  {
    name: "暑期冲刺",
    detail: "2027.07 – 2027.08",
    goals: ["数学强刷题", "408 真题分章", "政治 1000 题"],
  },
  {
    name: "提高模考",
    detail: "2027.09 – 2027.11",
    goals: ["真题套卷模考", "作文定稿", "政治背诵"],
  },
  {
    name: "临考冲刺",
    detail: "2027.12",
    goals: ["模考回归错题", "肖四背诵", "调整作息"],
  },
];

export const PLAN: MonthPlan[] = [
  {
    id: "2026-10",
    label: "2026 年 10 月",
    phase: "基础起步",
    core: "math",
    tasks: [
      { subject: "math", text: "高数基础：极限、导数与微分，配套基础网课过一遍" },
      { subject: "english", text: "每天背 50 个考研单词，开始整理长难句笔记" },
      { subject: "cs408", text: "数据结构：线性表、栈与队列（王道视频 + 选择题）" },
    ],
  },
  {
    id: "2026-11",
    label: "2026 年 11 月",
    phase: "基础起步",
    core: "math",
    tasks: [
      { subject: "math", text: "高数基础：不定积分、定积分、中值定理与导数应用" },
      { subject: "english", text: "单词第二轮；2005–2010 年真题阅读精读" },
      { subject: "cs408", text: "数据结构：树与二叉树、图" },
    ],
  },
  {
    id: "2026-12",
    label: "2026 年 12 月",
    phase: "基础起步",
    core: "cs408",
    tasks: [
      { subject: "math", text: "高数基础收尾；线代入门（行列式、矩阵）" },
      { subject: "english", text: "真题阅读继续精读，整理错题本" },
      { subject: "cs408", text: "数据结构：查找与排序，完成王道章节选择题" },
      { subject: "politics", text: "期末周适当减量，保持每日单词与数学手感" },
    ],
  },
  {
    id: "2027-01",
    label: "2027 年 1 月（寒假）",
    phase: "基础强化",
    core: "math",
    tasks: [
      { subject: "math", text: "线代：向量、线性方程组、特征值与二次型；概率论入门" },
      { subject: "english", text: "单词第三轮；长难句与翻译专题" },
      { subject: "cs408", text: "计算机组成原理：数据表示与运算、存储系统" },
    ],
  },
  {
    id: "2027-02",
    label: "2027 年 2 月（寒假）",
    phase: "基础强化",
    core: "cs408",
    tasks: [
      { subject: "math", text: "概率论收尾；高数强化全书（第一轮）" },
      { subject: "english", text: "真题阅读 2010–2015 精做" },
      { subject: "cs408", text: "组成原理：指令系统、CPU、流水线" },
      { subject: "politics", text: "了解考试大纲与题型，暂不系统复习" },
    ],
  },
  {
    id: "2027-03",
    label: "2027 年 3 月",
    phase: "强化阶段",
    core: "math",
    tasks: [
      { subject: "math", text: "强化全书：高数部分（极限、一元微分、积分）" },
      { subject: "english", text: "真题阅读 + 完型、新题型专项" },
      { subject: "cs408", text: "操作系统：进程与线程、处理机调度、同步与互斥" },
      { subject: "politics", text: "马原基础网课（哲学部分）" },
    ],
  },
  {
    id: "2027-04",
    label: "2027 年 4 月",
    phase: "强化阶段",
    core: "math",
    tasks: [
      { subject: "math", text: "强化全书：线代 + 概率" },
      { subject: "english", text: "真题阅读 2016–2020" },
      { subject: "cs408", text: "操作系统：内存管理、文件系统、I/O" },
      { subject: "politics", text: "马原：政治经济学与科学社会主义" },
    ],
  },
  {
    id: "2027-05",
    label: "2027 年 5 月",
    phase: "强化阶段",
    core: "cs408",
    tasks: [
      { subject: "math", text: "强化收尾，整理各章错题本" },
      { subject: "english", text: "真题二刷 + 翻译训练" },
      { subject: "cs408", text: "计算机网络：物理层、数据链路层、网络层" },
      { subject: "politics", text: "马原收尾 + 毛中特基础" },
    ],
  },
  {
    id: "2027-06",
    label: "2027 年 6 月",
    phase: "强化阶段",
    core: "cs408",
    tasks: [
      { subject: "math", text: "660 / 1000 题刷题第一轮" },
      { subject: "english", text: "真题二刷；作文素材积累" },
      { subject: "cs408", text: "计算机网络：传输层、应用层；408 第一轮收尾" },
      { subject: "politics", text: "毛中特 + 史纲" },
    ],
  },
  {
    id: "2027-07",
    label: "2027 年 7 月（暑期）",
    phase: "暑期冲刺",
    core: "math",
    tasks: [
      { subject: "math", text: "强化冲刺：880 / 强化课程，专项突破" },
      { subject: "english", text: "真题三刷；搭建作文框架" },
      { subject: "cs408", text: "408 真题分章练习（2010–2015）" },
      { subject: "politics", text: "1000 题第一轮（马原、毛中特）" },
    ],
  },
  {
    id: "2027-08",
    label: "2027 年 8 月（暑期）",
    phase: "暑期冲刺",
    core: "cs408",
    tasks: [
      { subject: "math", text: "强化题集 + 第一轮真题套卷" },
      { subject: "english", text: "真题精做 2021–2024；完型新题型专题" },
      { subject: "cs408", text: "408 真题（2016–2022）+ 错题整理" },
      { subject: "politics", text: "1000 题二刷" },
    ],
  },
  {
    id: "2027-09",
    label: "2027 年 9 月",
    phase: "提高模考",
    core: "math",
    tasks: [
      { subject: "math", text: "近 10 年真题套卷 + 错题复盘" },
      { subject: "english", text: "真题复盘；大小作文模板" },
      { subject: "cs408", text: "408 真题（2023–2025）+ 错题" },
      { subject: "politics", text: "1000 题三刷；时政关注" },
    ],
  },
  {
    id: "2027-10",
    label: "2027 年 10 月",
    phase: "提高模考",
    core: "math",
    tasks: [
      { subject: "math", text: "冲刺卷与模拟卷（如张宇 8 套卷）" },
      { subject: "english", text: "作文成稿背诵；真题模考" },
      { subject: "cs408", text: "王道模拟题 + 查漏补缺" },
      { subject: "politics", text: "强化背诵 + 肖八" },
    ],
  },
  {
    id: "2027-11",
    label: "2027 年 11 月",
    phase: "提高模考",
    core: "cs408",
    tasks: [
      { subject: "math", text: "模拟套卷 + 查漏补缺，保持做题手感" },
      { subject: "english", text: "作文定稿；限时模考" },
      { subject: "cs408", text: "真题三刷 + 模拟" },
      { subject: "politics", text: "肖八刷题 + 肖四主观题背诵" },
    ],
  },
  {
    id: "2027-12",
    label: "2027 年 12 月（考前）",
    phase: "临考冲刺",
    core: "politics",
    tasks: [
      { subject: "math", text: "回归错题与基础公式，适度模考" },
      { subject: "english", text: "作文与真题错题回顾" },
      { subject: "cs408", text: "错题与本笔记回顾，保持手感" },
      { subject: "politics", text: "肖四主观题背诵；打印准考证、踩点、调整作息" },
    ],
  },
];

export const TOTAL_TASKS = PLAN.reduce((n, m) => n + m.tasks.length, 0);
