import type { SubjectId } from "../plan";

/* =========================================================================
 * 资料中心 / 情报库 / 真题库 数据类型
 * 原则：
 *  1. 每一条「事实」（招生人数、复试线、考试科目、学制…）都必须带来源与
 *     可信等级，禁止凭空生成；
 *  2. 年份独立管理，同一份资料按年份与版本分开存放，历史版本永不删除；
 *  3. 自动同步只创建 NEED_REVIEW 版本，绝不自动覆盖 CURRENT 正式值。
 * ========================================================================= */

/* ---------------------------- 信息源 ---------------------------- */

export type SourceType =
  | "OFFICIAL_ADMISSION"
  | "OFFICIAL_SCHOOL"
  | "OFFICIAL_COLLEGE"
  | "CHSI"
  | "MOE"
  | "COURSE"
  | "BOOK"
  | "USER_UPLOAD"
  | "OTHER";

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  OFFICIAL_ADMISSION: "招生单位官方招生网",
  OFFICIAL_SCHOOL: "学校官网",
  OFFICIAL_COLLEGE: "学院官方页面",
  CHSI: "中国研究生招生信息网",
  MOE: "教育部",
  COURSE: "课程 / 网课",
  BOOK: "教材 / 图书",
  USER_UPLOAD: "我自己上传",
  OTHER: "其他公开资料",
};

/** 可信度优先级：数字越小越权威（§11 低级来源不能覆盖高级来源） */
export const SOURCE_TIER: Record<SourceType, number> = {
  OFFICIAL_ADMISSION: 1,
  OFFICIAL_COLLEGE: 2,
  OFFICIAL_SCHOOL: 2,
  CHSI: 3,
  MOE: 4,
  COURSE: 5,
  BOOK: 5,
  OTHER: 6,
  USER_UPLOAD: 6,
};

export type SyncStatus = "IDLE" | "OK" | "NOT_MODIFIED" | "CHANGED" | "FAILED" | "SKIPPED";

export const SYNC_STATUS_LABEL: Record<SyncStatus, string> = {
  IDLE: "未检查",
  OK: "正常",
  NOT_MODIFIED: "无变化",
  CHANGED: "发现更新",
  FAILED: "同步失败",
  SKIPPED: "跳过",
};

export type CheckInterval = "DAILY" | "WEEKLY" | "MONTHLY" | "MANUAL" | "NEVER";

export const CHECK_INTERVAL_LABEL: Record<CheckInterval, string> = {
  DAILY: "每日检查",
  WEEKLY: "每周检查",
  MONTHLY: "每月检查",
  MANUAL: "仅手动",
  NEVER: "不自动更新",
};

export type InfoSource = {
  id: string;
  schoolId: string;
  sourceName: string;
  sourceType: SourceType;
  url: string;
  officialDomain: string;
  description: string;
  enabled: boolean;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  syncStatus: SyncStatus;
  checkInterval: CheckInterval;
  /** 抓取方式：文档列表页 / 年度招生目录页 */
  kind: SourceKind;
  /** 该来源覆盖的年份（招生目录类来源用） */
  year: number | null;
  lastContentHash: string | null;
  lastDocCount: number | null;
  lastTitle: string | null;
  lastError: string | null;
  /** 最近一次抓取实际落到的域名（§37 跳转域名记录） */
  lastFinalDomain: string | null;
  isSeed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SourceKind = "DOC_LIST" | "YEAR_CATALOG" | "MANUAL";

/* ---------------------------- 资料 ---------------------------- */

export type ResourceStatus =
  | "DRAFT"
  | "CURRENT"
  | "ARCHIVED"
  | "EXPIRED"
  | "REMOVED"
  | "NEED_REVIEW";

export const RESOURCE_STATUS_LABEL: Record<ResourceStatus, string> = {
  DRAFT: "草稿",
  CURRENT: "当前有效",
  ARCHIVED: "已归档",
  EXPIRED: "已过期",
  REMOVED: "已删除",
  NEED_REVIEW: "待确认",
};

export type ResourceCategory =
  | "OFFICIAL_POLICY"
  | "ADMISSION_GUIDE"
  | "MAJOR_CATALOG"
  | "EXAM_SUBJECT"
  | "PLAN_ENROLL"
  | "RECOMMENDED_QUOTA"
  | "RETEST_LINE"
  | "ADMISSION_LIST"
  | "APPLY_RATIO"
  | "RETEST_RULE"
  | "TUITION_DURATION"
  | "TUTOR_DIRECTION"
  | "MATH_1"
  | "ENGLISH_1"
  | "CS_408"
  | "POLITICS"
  | "REAL_PAPER"
  | "MOCK_PAPER"
  | "WRONG_BOOK"
  | "STUDY_NOTE"
  | "MY_UPLOAD";

export const RESOURCE_CATEGORY_LABEL: Record<ResourceCategory, string> = {
  OFFICIAL_POLICY: "官方政策",
  ADMISSION_GUIDE: "招生简章",
  MAJOR_CATALOG: "专业目录",
  EXAM_SUBJECT: "考试科目",
  PLAN_ENROLL: "招生人数",
  RECOMMENDED_QUOTA: "推免人数",
  RETEST_LINE: "复试线",
  ADMISSION_LIST: "拟录取名单",
  APPLY_RATIO: "报录数据",
  RETEST_RULE: "复试办法",
  TUITION_DURATION: "学费 / 学制",
  TUTOR_DIRECTION: "导师 / 研究方向",
  MATH_1: "数学一",
  ENGLISH_1: "英语一",
  CS_408: "408",
  POLITICS: "政治",
  REAL_PAPER: "历年真题",
  MOCK_PAPER: "模拟题",
  WRONG_BOOK: "错题",
  STUDY_NOTE: "学习笔记",
  MY_UPLOAD: "我的资料",
};

/** 资料中心顶部页签（§27） */
export type ResourceTab =
  | "OFFICIAL"
  | "MATH_1"
  | "ENGLISH_1"
  | "CS_408"
  | "POLITICS"
  | "REAL_PAPER"
  | "MOCK_PAPER"
  | "SCHOOL"
  | "LATEST";

/** 资料归属科目（含「公共/官方」） */
export type ResourceSubject = SubjectId | "official" | "general";

export const RESOURCE_SUBJECT_LABEL: Record<ResourceSubject, string> = {
  math: "数学一",
  english: "英语一",
  cs408: "408",
  politics: "政治",
  official: "官方信息",
  general: "通用",
};

/** 需要人工确认才能提升为 CURRENT 的敏感字段（§39） */
export const SENSITIVE_FIELDS = [
  "考试科目",
  "招生人数",
  "专业代码",
  "学习方式",
  "学制",
  "复试线",
  "报名条件",
] as const;

export type Resource = {
  id: string;
  title: string;
  category: ResourceCategory;
  subject: ResourceSubject;
  schoolId: string | null;
  majorCode: string | null;
  year: number | null;
  version: number;
  sourceId: string | null;
  sourceUrl: string;
  filePath: string | null;
  fileType: string | null;
  fileSize: number | null;
  description: string;
  publishedAt: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  status: ResourceStatus;
  isOfficial: boolean;
  isCurrent: boolean;
  contentHash: string | null;
  /** 知识点 / 关键词标签，用于任务绑定与错题关联 */
  tags: string[];
  /** 摘要要点（考试科目、招生人数等结构化事实，每条都可追溯来源） */
  facts: ResourceFact[];
  favorite: boolean;
  /** 当前版本记录 id */
  currentVersionId: string | null;
  usageStage: UsageStage;
  progress: number;
  createdAt: string;
  updatedAt: string;
};

export type UsageStage = "未开始" | "基础" | "强化" | "真题" | "冲刺" | "已完成";

export const USAGE_STAGES: UsageStage[] = ["未开始", "基础", "强化", "真题", "冲刺", "已完成"];

export type ResourceFact = {
  key: string;
  value: string;
  /** 该事实的来源（官方页面 / 用户录入 / 第三方） */
  from: FactOrigin;
  note?: string;
};

export type FactOrigin = "OFFICIAL" | "THIRD_PARTY" | "USER" | "UNKNOWN";

export const FACT_ORIGIN_LABEL: Record<FactOrigin, string> = {
  OFFICIAL: "官方",
  THIRD_PARTY: "第三方（待官方确认）",
  USER: "我录入",
  UNKNOWN: "来源未知",
};

export type ResourceVersion = {
  id: string;
  resourceId: string;
  version: number;
  title: string;
  publishedAt: string | null;
  sourceUrl: string;
  contentHash: string | null;
  /** 与上一版相比的变化说明（自动检测或人工填写） */
  changeSummary: string[];
  /** 变化类型 */
  changeType: "CREATED" | "SYNC_DETECTED" | "MANUAL_EDIT" | "STATUS_CHANGE" | "IMPORTED";
  /** 该版本快照（用于历史版本对比，不回写主表） */
  snapshot: ResourceSnapshot;
  createdAt: string;
};

export type ResourceSnapshot = {
  title: string;
  category: ResourceCategory;
  subject: ResourceSubject;
  year: number | null;
  version: number;
  status: ResourceStatus;
  publishedAt: string | null;
  sourceUrl: string;
  facts: ResourceFact[];
  description: string;
};

/* ---------------------------- 学校 / 年度档案 ---------------------------- */

export type School = {
  id: string;
  name: string;
  code: string;
  province: string;
  admissionUrl: string;
  collegeUrl: string;
  majorName: string;
  majorCode: string;
  studyMode: string;
  duration: string;
  tuition: string;
  examSubjects: string;
  planEnroll: string;
  recommendedQuota: string;
  retestLine: string;
  admissionCount: string;
  minScore: string;
  avgScore: string;
  retestRatio: string;
  retestSubjects: string;
  machineTest: string;
  directions: string;
  tutorDirections: string;
  officialLinks: { label: string; url: string }[];
  isTarget: boolean;
  /** 空字段统一显示「暂无官方数据」，禁止用 0 代替 */
  fieldSources: Record<string, { sourceId: string | null; url: string; note: string }>;
  createdAt: string;
  updatedAt: string;
};

export type SchoolYearStatus = "PUBLISHED" | "PENDING" | "UNKNOWN";

export const SCHOOL_YEAR_STATUS_LABEL: Record<SchoolYearStatus, string> = {
  PUBLISHED: "已发布",
  PENDING: "待官方发布",
  UNKNOWN: "待核实",
};

export type SchoolYearData = {
  id: string;
  schoolId: string;
  year: number;
  majorCode: string;
  status: SchoolYearStatus;
  /** 该年度的字段值；空字符串 = 暂无官方数据 */
  examSubjects: string;
  planEnroll: string;
  recommendedQuota: string;
  retestLine: string;
  admissionCount: string;
  minScore: string;
  avgScore: string;
  note: string;
  evidenceUrl: string;
  evidenceText: string;
  sourceId: string | null;
  verifiedLevel: FactOrigin;
  createdAt: string;
  updatedAt: string;
};

/* ---------------------------- 真题 / 错题 ---------------------------- */

export type QuestionSubject = "MATH_1" | "ENGLISH_1" | "CS_408" | "POLITICS";

export const QUESTION_SUBJECT_LABEL: Record<QuestionSubject, string> = {
  MATH_1: "数学一",
  ENGLISH_1: "英语一",
  CS_408: "408",
  POLITICS: "政治",
};

export type QuestionType =
  | "CHOICE"
  | "FILL"
  | "SHORT"
  | "COMPUTATION"
  | "ALGORITHM"
  | "ESSAY"
  | "OTHER";

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  CHOICE: "选择题",
  FILL: "填空题",
  SHORT: "简答题",
  COMPUTATION: "计算题",
  ALGORITHM: "算法设计题",
  ESSAY: "论述 / 作文",
  OTHER: "其他",
};

export type ExamType = "REAL" | "MOCK" | "CHAPTER";

export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  REAL: "历年真题",
  MOCK: "模拟题",
  CHAPTER: "章节练习",
};

export type Question = {
  id: string;
  year: number | null;
  subject: QuestionSubject;
  examType: ExamType;
  paper: string;
  section: string;
  questionNumber: string;
  questionType: QuestionType;
  knowledgePoint: string;
  difficulty: number;
  sourceId: string | null;
  sourceUrl: string;
  userFileId: string | null;
  correctAnswer: string;
  userAnswer: string;
  isWrong: boolean;
  wrongCount: number;
  /** 0-100 掌握度，可用「重做正确」自动提升 */
  mastery: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

/* ---------------------------- 更新日志 / 同步状态 ---------------------------- */

export type ChangeType = "NEW" | "CHANGED" | "NO_CHANGE" | "FAILED" | "YEAR_OPENED";

export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = {
  NEW: "新增资料",
  CHANGED: "检测到更新",
  NO_CHANGE: "无变化",
  FAILED: "检查失败",
  YEAR_OPENED: "年度目录开放",
};

export type ConfirmStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "AUTO";

export const CONFIRM_STATUS_LABEL: Record<ConfirmStatus, string> = {
  PENDING: "待确认",
  CONFIRMED: "已确认",
  REJECTED: "已忽略",
  AUTO: "无需确认",
};

export type Severity = "INFO" | "IMPORTANT" | "CRITICAL";

export type UpdateEntry = {
  id: string;
  at: string;
  schoolId: string | null;
  majorCode: string | null;
  resourceId: string | null;
  versionId: string | null;
  category: ResourceCategory | null;
  title: string;
  oldVersion: number | null;
  newVersion: number | null;
  changeType: ChangeType;
  changes: string[];
  sourceId: string | null;
  sourceUrl: string;
  /** 触发方式：自动同步 / 手动检查 / 模拟检测 / 手动录入 */
  trigger: "AUTO" | "MANUAL" | "SIMULATE" | "USER_EDIT";
  severity: Severity;
  confirmStatus: ConfirmStatus;
  detail: string;
};

export type SourceCheckResult = {
  sourceId: string;
  checkedAt: string;
  status: SyncStatus;
  finalUrl: string | null;
  finalDomain: string | null;
  officialDomainOk: boolean;
  title: string | null;
  publishedAt: string | null;
  docCount: number | null;
  contentHash: string | null;
  changed: boolean;
  notPublished: boolean;
  error: string | null;
  docs: { title: string; url: string; date: string | null }[];
};

export type SyncState = {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastRunTrigger: "AUTO" | "MANUAL" | "SIMULATE" | null;
  results: Record<string, SourceCheckResult>;
};

/* ---------------------------- 我的文件（IndexedDB 元数据） ---------------------------- */

export type UserFile = {
  id: string;
  name: string;
  mime: string;
  size: number;
  /** 是否真的把文件存进了本地 IndexedDB */
  stored: boolean;
  resourceId: string | null;
  createdAt: string;
};

/* ---------------------------- 常量 ---------------------------- */

export const SCHOOL_YEARS = [2024, 2025, 2026, 2027, 2028];
export const CURRENT_PREP_YEAR = 2027;
export const TARGET_YEAR = 2028;

export const TARGET_SCHOOL_ID = "school-uestc";
export const TARGET_MAJOR_CODE = "085404";
export const TARGET_MAJOR_NAME = "计算机技术（全日制专硕）";
