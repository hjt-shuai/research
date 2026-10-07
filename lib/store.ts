import { localDateKey } from "./progress";
import { DEFAULT_GOALS, clampGoals } from "./scoring";
import { seedResourceVersions, seedResources, seedSchoolYears, seedSchools, seedSources } from "./db/seed";
import type {
  CheckInterval,
  ChangeType,
  ConfirmStatus,
  FactOrigin,
  InfoSource,
  Question,
  Resource,
  ResourceCategory,
  ResourceFact,
  ResourceStatus,
  ResourceSubject,
  ResourceVersion,
  School,
  SchoolYearData,
  SchoolYearStatus,
  Severity,
  SourceCheckResult,
  SourceKind,
  SourceType,
  SyncState,
  SyncStatus,
  UpdateEntry,
  UsageStage,
  UserFile,
} from "./db/types";
import type {
  Goals,
  ManualMinutes,
  MasteryMap,
  MasteryState,
  MockExam,
  StudyLog,
  StudyStatus,
  TodayState,
} from "./types";

export const STORE_KEY = "kaoyan.store";
export const LEGACY_TASKS_KEY = "kaoyan.tasks";
export const LEGACY_EXAM_KEY = "kaoyan.examDate";

export const DEFAULT_EXAM_DATE = "2027-12-25T08:30";
/**
 * v1 → v2：单键存储
 * v2 → v3：手动补时改为按日期记录
 * v3 → v4：新增资料中心 / 情报库 / 真题库 / 更新中心（纯新增字段，旧数据原样保留）
 */
export const STORE_VERSION = 4;

const STUDY_STATUSES: StudyStatus[] = ["not-started", "learning", "mastered"];
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type AppStore = {
  version: number;
  /* ---------- 原有备考数据（v1–v3，字段与语义保持不变） ---------- */
  tasks: Record<string, boolean>;
  examDate: string;
  examDateUserSet: boolean;
  goals: Goals;
  mocks: MockExam[];
  mastery: MasteryMap;
  studyLog: StudyLog;
  today: TodayState | null;
  manualMinutes: ManualMinutes;

  /* ---------- v4：情报与资料库 ---------- */
  schools: School[];
  schoolYears: SchoolYearData[];
  sources: InfoSource[];
  resources: Resource[];
  resourceVersions: ResourceVersion[];
  questions: Question[];
  updateLog: UpdateEntry[];
  syncState: SyncState;
  /** 月度任务 → 资料 id 绑定（§30） */
  taskResources: Record<string, string[]>;
  /** 用户上传文件的元数据（文件本体存 IndexedDB） */
  userFiles: UserFile[];
};

export function createEmptySyncState(): SyncState {
  return { lastRunAt: null, lastSuccessAt: null, lastRunTrigger: null, results: {} };
}

export function createDefaultStore(): AppStore {
  return {
    version: STORE_VERSION,
    tasks: {},
    examDate: DEFAULT_EXAM_DATE,
    examDateUserSet: false,
    goals: { ...DEFAULT_GOALS },
    mocks: [],
    mastery: {},
    studyLog: {},
    today: null,
    manualMinutes: {},
    schools: [],
    schoolYears: [],
    sources: [],
    resources: [],
    resourceVersions: [],
    questions: [],
    updateLog: [],
    syncState: createEmptySyncState(),
    taskResources: {},
    userFiles: [],
  };
}

/* ------------------------------ 小工具 ------------------------------ */

function num(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function numOrNull(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  return num(v, min, max);
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function isoNow(): string {
  return new Date().toISOString();
}

/* ------------------------------ 原有数据校验 ------------------------------ */

/** 只保留 true 的键：旧数据里可能出现 false/null，空键会污染完成率统计 */
function sanitizeTasks(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === true) out[k] = true;
  }
  return out;
}

function sanitizeIdListMap(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue;
    const ids = v.filter((x): x is string => typeof x === "string");
    if (ids.length) out[k] = ids;
  }
  return out;
}

function sanitizeMocks(raw: unknown): MockExam[] {
  if (!Array.isArray(raw)) return [];
  const out: MockExam[] = [];
  raw.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const o = item as Record<string, unknown>;
    const politics = num(o.politics, 0, 100);
    const english = num(o.english, 0, 100);
    const math = num(o.math, 0, 150);
    const cs408 = num(o.cs408, 0, 150);
    if (politics == null || english == null || math == null || cs408 == null) return;
    const date = str(o.date) || localDateKey();
    const name = str(o.name).trim() || `模考 ${i + 1}`;
    const id = str(o.id) || `mock-${date}-${i}-${out.length}`;
    out.push({ id, name, date, politics, english, math, cs408 });
  });
  return out;
}

function sanitizeMastery(raw: unknown): MasteryMap {
  if (!raw || typeof raw !== "object") return {};
  const out: MasteryMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const status = oneOf<StudyStatus>(o.status, STUDY_STATUSES, "not-started");
    const state: MasteryState = {
      status,
      taskDone: o.taskDone === true,
      accuracy: numOrNull(o.accuracy, 0, 100),
      weak: o.weak === true,
    };
    out[k] = state;
  }
  return out;
}

function sanitizeStudyLog(raw: unknown): StudyLog {
  if (!raw || typeof raw !== "object") return {};
  const out: StudyLog = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!DATE_KEY_RE.test(k) || !v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    out[k] = {
      minutes: num(o.minutes, 0, 24 * 60) ?? 0,
      tasks: num(o.tasks, 0, 999) ?? 0,
    };
  }
  return out;
}

function sanitizeManualMinutes(raw: unknown): ManualMinutes {
  if (!raw || typeof raw !== "object") return {};
  const out: ManualMinutes = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!DATE_KEY_RE.test(k)) continue;
    const minutes = num(v, 0, 24 * 60);
    if (minutes != null && minutes > 0) out[k] = minutes;
  }
  return out;
}

function sanitizeToday(raw: unknown): TodayState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.date !== "string" || !Array.isArray(o.ids)) return null;
  return { date: o.date, ids: o.ids.filter((id): id is string => typeof id === "string") };
}

/* ------------------------------ v4 数据校验 ------------------------------ */

const SOURCE_TYPES: SourceType[] = [
  "OFFICIAL_ADMISSION",
  "OFFICIAL_SCHOOL",
  "OFFICIAL_COLLEGE",
  "CHSI",
  "MOE",
  "COURSE",
  "BOOK",
  "USER_UPLOAD",
  "OTHER",
];
const SYNC_STATUSES: SyncStatus[] = ["IDLE", "OK", "NOT_MODIFIED", "CHANGED", "FAILED", "SKIPPED"];
const CHECK_INTERVALS: CheckInterval[] = ["DAILY", "WEEKLY", "MONTHLY", "MANUAL", "NEVER"];
const SOURCE_KINDS: SourceKind[] = ["DOC_LIST", "YEAR_CATALOG", "MANUAL"];

function sanitizeSources(raw: unknown): InfoSource[] {
  if (!Array.isArray(raw)) return [];
  const out: InfoSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = str(o.id);
    if (!id) continue;
    out.push({
      id,
      schoolId: str(o.schoolId),
      sourceName: str(o.sourceName, "未命名来源"),
      sourceType: oneOf<SourceType>(o.sourceType, SOURCE_TYPES, "OTHER"),
      url: str(o.url),
      officialDomain: str(o.officialDomain),
      description: str(o.description),
      enabled: bool(o.enabled, true),
      lastCheckedAt: strOrNull(o.lastCheckedAt),
      lastSuccessAt: strOrNull(o.lastSuccessAt),
      lastFailureAt: strOrNull(o.lastFailureAt),
      syncStatus: oneOf<SyncStatus>(o.syncStatus, SYNC_STATUSES, "IDLE"),
      checkInterval: oneOf<CheckInterval>(o.checkInterval, CHECK_INTERVALS, "WEEKLY"),
      kind: oneOf<SourceKind>(o.kind, SOURCE_KINDS, "DOC_LIST"),
      year: numOrNull(o.year, 2000, 2100),
      lastContentHash: strOrNull(o.lastContentHash),
      lastDocCount: numOrNull(o.lastDocCount, 0, 100000),
      lastTitle: strOrNull(o.lastTitle),
      lastError: strOrNull(o.lastError),
      lastFinalDomain: strOrNull(o.lastFinalDomain),
      isSeed: bool(o.isSeed, false),
      createdAt: str(o.createdAt) || isoNow(),
      updatedAt: str(o.updatedAt) || isoNow(),
    });
  }
  return out;
}

const RESOURCE_STATUSES: ResourceStatus[] = [
  "DRAFT",
  "CURRENT",
  "ARCHIVED",
  "EXPIRED",
  "REMOVED",
  "NEED_REVIEW",
];
const RESOURCE_SUBJECTS: ResourceSubject[] = ["math", "english", "cs408", "politics", "official", "general"];
const RESOURCE_CATEGORIES: ResourceCategory[] = [
  "OFFICIAL_POLICY",
  "ADMISSION_GUIDE",
  "MAJOR_CATALOG",
  "EXAM_SUBJECT",
  "PLAN_ENROLL",
  "RECOMMENDED_QUOTA",
  "RETEST_LINE",
  "ADMISSION_LIST",
  "APPLY_RATIO",
  "RETEST_RULE",
  "TUITION_DURATION",
  "TUTOR_DIRECTION",
  "MATH_1",
  "ENGLISH_1",
  "CS_408",
  "POLITICS",
  "REAL_PAPER",
  "MOCK_PAPER",
  "WRONG_BOOK",
  "STUDY_NOTE",
  "MY_UPLOAD",
];
const USAGE_STAGE_VALUES: UsageStage[] = ["未开始", "基础", "强化", "真题", "冲刺", "已完成"];
const FACT_ORIGINS: FactOrigin[] = ["OFFICIAL", "THIRD_PARTY", "USER", "UNKNOWN"];
const CHANGE_TYPES: ChangeType[] = ["NEW", "CHANGED", "NO_CHANGE", "FAILED", "YEAR_OPENED"];
const CONFIRM_STATUSES: ConfirmStatus[] = ["PENDING", "CONFIRMED", "REJECTED", "AUTO"];
const SEVERITIES: Severity[] = ["INFO", "IMPORTANT", "CRITICAL"];

function sanitizeFacts(raw: unknown): ResourceFact[] {
  if (!Array.isArray(raw)) return [];
  const out: ResourceFact[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const key = str(o.key);
    if (!key) continue;
    const note = str(o.note);
    out.push({
      key,
      value: str(o.value),
      from: oneOf<FactOrigin>(o.from, FACT_ORIGINS, "UNKNOWN"),
      ...(note ? { note } : {}),
    });
  }
  return out;
}

function sanitizeResources(raw: unknown): Resource[] {
  if (!Array.isArray(raw)) return [];
  const out: Resource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = str(o.id);
    const title = str(o.title);
    if (!id || !title) continue;
    out.push({
      id,
      title,
      category: oneOf<ResourceCategory>(o.category, RESOURCE_CATEGORIES, "STUDY_NOTE"),
      subject: oneOf<ResourceSubject>(o.subject, RESOURCE_SUBJECTS, "general"),
      schoolId: strOrNull(o.schoolId),
      majorCode: strOrNull(o.majorCode),
      year: numOrNull(o.year, 1990, 2100),
      version: num(o.version, 1, 999) ?? 1,
      sourceId: strOrNull(o.sourceId),
      sourceUrl: str(o.sourceUrl),
      filePath: strOrNull(o.filePath),
      fileType: strOrNull(o.fileType),
      fileSize: numOrNull(o.fileSize, 0, 5_000_000_000),
      description: str(o.description),
      publishedAt: strOrNull(o.publishedAt),
      effectiveFrom: strOrNull(o.effectiveFrom),
      effectiveTo: strOrNull(o.effectiveTo),
      status: oneOf<ResourceStatus>(o.status, RESOURCE_STATUSES, "CURRENT"),
      isOfficial: bool(o.isOfficial, false),
      isCurrent: bool(o.isCurrent, true),
      contentHash: strOrNull(o.contentHash),
      tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === "string") : [],
      facts: sanitizeFacts(o.facts),
      favorite: bool(o.favorite, false),
      currentVersionId: strOrNull(o.currentVersionId),
      usageStage: oneOf<UsageStage>(o.usageStage, USAGE_STAGE_VALUES, "未开始"),
      progress: num(o.progress, 0, 100) ?? 0,
      createdAt: str(o.createdAt) || isoNow(),
      updatedAt: str(o.updatedAt) || isoNow(),
    });
  }
  return out;
}

function sanitizeResourceVersions(raw: unknown): ResourceVersion[] {
  if (!Array.isArray(raw)) return [];
  const out: ResourceVersion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = str(o.id);
    const resourceId = str(o.resourceId);
    if (!id || !resourceId) continue;
    const snap = (o.snapshot && typeof o.snapshot === "object" ? o.snapshot : {}) as Record<string, unknown>;
    out.push({
      id,
      resourceId,
      version: num(o.version, 1, 999) ?? 1,
      title: str(o.title),
      publishedAt: strOrNull(o.publishedAt),
      sourceUrl: str(o.sourceUrl),
      contentHash: strOrNull(o.contentHash),
      changeSummary: Array.isArray(o.changeSummary)
        ? o.changeSummary.filter((t): t is string => typeof t === "string")
        : [],
      changeType: oneOf(
        o.changeType,
        ["CREATED", "SYNC_DETECTED", "MANUAL_EDIT", "STATUS_CHANGE", "IMPORTED"] as const,
        "MANUAL_EDIT",
      ),
      snapshot: {
        title: str(snap.title),
        category: oneOf<ResourceCategory>(snap.category, RESOURCE_CATEGORIES, "STUDY_NOTE"),
        subject: oneOf<ResourceSubject>(snap.subject, RESOURCE_SUBJECTS, "general"),
        year: numOrNull(snap.year, 1990, 2100),
        version: num(snap.version, 1, 999) ?? 1,
        status: oneOf<ResourceStatus>(snap.status, RESOURCE_STATUSES, "CURRENT"),
        publishedAt: strOrNull(snap.publishedAt),
        sourceUrl: str(snap.sourceUrl),
        facts: sanitizeFacts(snap.facts),
        description: str(snap.description),
      },
      createdAt: str(o.createdAt) || isoNow(),
    });
  }
  return out;
}

function sanitizeSchools(raw: unknown): School[] {
  if (!Array.isArray(raw)) return [];
  const out: School[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = str(o.id);
    const name = str(o.name);
    if (!id || !name) continue;
    const links = Array.isArray(o.officialLinks)
      ? (o.officialLinks as unknown[])
          .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
          .map((l) => ({ label: str(l.label), url: str(l.url) }))
          .filter((l) => l.url)
      : [];
    const fieldSources: School["fieldSources"] = {};
    if (o.fieldSources && typeof o.fieldSources === "object") {
      for (const [k, v] of Object.entries(o.fieldSources as Record<string, unknown>)) {
        if (!v || typeof v !== "object") continue;
        const f = v as Record<string, unknown>;
        fieldSources[k] = { sourceId: strOrNull(f.sourceId), url: str(f.url), note: str(f.note) };
      }
    }
    out.push({
      id,
      name,
      code: str(o.code),
      province: str(o.province),
      admissionUrl: str(o.admissionUrl),
      collegeUrl: str(o.collegeUrl),
      majorName: str(o.majorName),
      majorCode: str(o.majorCode),
      studyMode: str(o.studyMode),
      duration: str(o.duration),
      tuition: str(o.tuition),
      examSubjects: str(o.examSubjects),
      planEnroll: str(o.planEnroll),
      recommendedQuota: str(o.recommendedQuota),
      retestLine: str(o.retestLine),
      admissionCount: str(o.admissionCount),
      minScore: str(o.minScore),
      avgScore: str(o.avgScore),
      retestRatio: str(o.retestRatio),
      retestSubjects: str(o.retestSubjects),
      machineTest: str(o.machineTest),
      directions: str(o.directions),
      tutorDirections: str(o.tutorDirections),
      officialLinks: links,
      isTarget: bool(o.isTarget, false),
      fieldSources,
      createdAt: str(o.createdAt) || isoNow(),
      updatedAt: str(o.updatedAt) || isoNow(),
    });
  }
  return out;
}

function sanitizeSchoolYears(raw: unknown): SchoolYearData[] {
  if (!Array.isArray(raw)) return [];
  const out: SchoolYearData[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const schoolId = str(o.schoolId);
    const year = numOrNull(o.year, 1990, 2100);
    if (!schoolId || year == null) continue;
    const key = `${schoolId}:${year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: str(o.id) || `sy-${schoolId}-${year}`,
      schoolId,
      year,
      majorCode: str(o.majorCode),
      status: oneOf<SchoolYearStatus>(o.status, ["PUBLISHED", "PENDING", "UNKNOWN"] as const, "UNKNOWN"),
      examSubjects: str(o.examSubjects),
      planEnroll: str(o.planEnroll),
      recommendedQuota: str(o.recommendedQuota),
      retestLine: str(o.retestLine),
      admissionCount: str(o.admissionCount),
      minScore: str(o.minScore),
      avgScore: str(o.avgScore),
      note: str(o.note),
      evidenceUrl: str(o.evidenceUrl),
      evidenceText: str(o.evidenceText),
      sourceId: strOrNull(o.sourceId),
      verifiedLevel: oneOf<FactOrigin>(o.verifiedLevel, FACT_ORIGINS, "UNKNOWN"),
      createdAt: str(o.createdAt) || isoNow(),
      updatedAt: str(o.updatedAt) || isoNow(),
    });
  }
  return out;
}

function sanitizeQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return [];
  const out: Question[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = str(o.id);
    if (!id) continue;
    out.push({
      id,
      year: numOrNull(o.year, 1990, 2100),
      subject: oneOf(o.subject, ["MATH_1", "ENGLISH_1", "CS_408", "POLITICS"] as const, "CS_408"),
      examType: oneOf(o.examType, ["REAL", "MOCK", "CHAPTER"] as const, "REAL"),
      paper: str(o.paper),
      section: str(o.section),
      questionNumber: str(o.questionNumber),
      questionType: oneOf(
        o.questionType,
        ["CHOICE", "FILL", "SHORT", "COMPUTATION", "ALGORITHM", "ESSAY", "OTHER"] as const,
        "CHOICE",
      ),
      knowledgePoint: str(o.knowledgePoint),
      difficulty: num(o.difficulty, 0, 5) ?? 3,
      sourceId: strOrNull(o.sourceId),
      sourceUrl: str(o.sourceUrl),
      userFileId: strOrNull(o.userFileId),
      correctAnswer: str(o.correctAnswer),
      userAnswer: str(o.userAnswer),
      isWrong: bool(o.isWrong, false),
      wrongCount: num(o.wrongCount, 0, 999) ?? 0,
      mastery: num(o.mastery, 0, 100) ?? 0,
      note: str(o.note),
      createdAt: str(o.createdAt) || isoNow(),
      updatedAt: str(o.updatedAt) || isoNow(),
    });
  }
  return out;
}

function sanitizeUpdateLog(raw: unknown): UpdateEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: UpdateEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = str(o.id);
    if (!id) continue;
    out.push({
      id,
      at: str(o.at) || isoNow(),
      schoolId: strOrNull(o.schoolId),
      majorCode: strOrNull(o.majorCode),
      resourceId: strOrNull(o.resourceId),
      versionId: strOrNull(o.versionId),
      category:
        o.category == null
          ? null
          : oneOf<ResourceCategory>(o.category, RESOURCE_CATEGORIES, "OFFICIAL_POLICY"),
      title: str(o.title),
      oldVersion: numOrNull(o.oldVersion, 0, 999),
      newVersion: numOrNull(o.newVersion, 0, 999),
      changeType: oneOf<ChangeType>(o.changeType, CHANGE_TYPES, "NO_CHANGE"),
      changes: Array.isArray(o.changes) ? o.changes.filter((c): c is string => typeof c === "string") : [],
      sourceId: strOrNull(o.sourceId),
      sourceUrl: str(o.sourceUrl),
      trigger: oneOf(o.trigger, ["AUTO", "MANUAL", "SIMULATE", "USER_EDIT"] as const, "AUTO"),
      severity: oneOf<Severity>(o.severity, SEVERITIES, "INFO"),
      confirmStatus: oneOf<ConfirmStatus>(o.confirmStatus, CONFIRM_STATUSES, "AUTO"),
      detail: str(o.detail),
    });
  }
  return out.slice(-500);
}

function sanitizeSyncState(raw: unknown): SyncState {
  const base = createEmptySyncState();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const results: Record<string, SourceCheckResult> = {};
  if (o.results && typeof o.results === "object") {
    for (const [k, v] of Object.entries(o.results as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const r = v as Record<string, unknown>;
      results[k] = {
        sourceId: str(r.sourceId) || k,
        checkedAt: str(r.checkedAt) || isoNow(),
        status: oneOf<SyncStatus>(r.status, SYNC_STATUSES, "IDLE"),
        finalUrl: strOrNull(r.finalUrl),
        finalDomain: strOrNull(r.finalDomain),
        officialDomainOk: bool(r.officialDomainOk, false),
        title: strOrNull(r.title),
        publishedAt: strOrNull(r.publishedAt),
        docCount: numOrNull(r.docCount, 0, 100000),
        contentHash: strOrNull(r.contentHash),
        changed: bool(r.changed, false),
        notPublished: bool(r.notPublished, false),
        error: strOrNull(r.error),
        docs: Array.isArray(r.docs)
          ? (r.docs as unknown[])
              .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
              .slice(0, 40)
              .map((d) => ({ title: str(d.title), url: str(d.url), date: strOrNull(d.date) }))
          : [],
      };
    }
  }
  return {
    lastRunAt: strOrNull(o.lastRunAt),
    lastSuccessAt: strOrNull(o.lastSuccessAt),
    lastRunTrigger:
      o.lastRunTrigger == null
        ? null
        : oneOf(o.lastRunTrigger, ["AUTO", "MANUAL", "SIMULATE"] as const, "MANUAL"),
    results,
  };
}

function sanitizeUserFiles(raw: unknown): UserFile[] {
  if (!Array.isArray(raw)) return [];
  const out: UserFile[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = str(o.id);
    if (!id) continue;
    out.push({
      id,
      name: str(o.name, "未命名文件"),
      mime: str(o.mime),
      size: num(o.size, 0, 5_000_000_000) ?? 0,
      stored: bool(o.stored, false),
      resourceId: strOrNull(o.resourceId),
      createdAt: str(o.createdAt) || isoNow(),
    });
  }
  return out;
}

/* ------------------------------ 注入内置数据 ------------------------------ */

/**
 * 仅在「完全没有资料库」时注入内置来源 / 院校档案 / 起始资料。
 * 判断依据用 sources + schools（用户即使删光资料也不会被反复注入）。
 */
export function applySeedsIfEmpty(store: AppStore): AppStore {
  if (store.sources.length || store.schools.length) return store;
  const resources = seedResources();
  return {
    ...store,
    sources: seedSources(),
    schools: seedSchools(),
    schoolYears: seedSchoolYears(),
    resources,
    resourceVersions: seedResourceVersions(resources),
  };
}

/** 手动恢复内置数据：按 id 补齐缺失项，已有项一律不动 */
export function restoreSeeds(store: AppStore): AppStore {
  const haveSource = new Set(store.sources.map((s) => s.id));
  const haveSchool = new Set(store.schools.map((s) => s.id));
  const haveYear = new Set(store.schoolYears.map((s) => `${s.schoolId}:${s.year}`));
  const haveResource = new Set(store.resources.map((s) => s.id));
  const newResources = seedResources().filter((r) => !haveResource.has(r.id));
  return {
    ...store,
    sources: [...store.sources, ...seedSources().filter((s) => !haveSource.has(s.id))],
    schools: [...store.schools, ...seedSchools().filter((s) => !haveSchool.has(s.id))],
    schoolYears: [
      ...store.schoolYears,
      ...seedSchoolYears().filter((s) => !haveYear.has(`${s.schoolId}:${s.year}`)),
    ],
    resources: [...store.resources, ...newResources],
    resourceVersions: [...store.resourceVersions, ...seedResourceVersions(newResources)],
  };
}

/* ------------------------------ 主入口 ------------------------------ */

/**
 * 把任意来源（旧版本 localStorage / 导入的 JSON / 内置数据）规整成当前结构。
 * 未知字段忽略，缺失字段取默认值：v1/v2/v3 数据都能继续读取。
 */
export function normalizeStore(raw: unknown, todayKey: string = localDateKey()): AppStore {
  const base = createDefaultStore();
  if (!raw || typeof raw !== "object") return applySeedsIfEmpty(base);
  const o = raw as Record<string, unknown> & Partial<AppStore>;

  const manualMinutes = sanitizeManualMinutes(o.manualMinutes);
  // v2 及更早：studyMinutesManual 是全局数字，没有日期信息，迁移时记到今天
  const legacyManual = num((o as { studyMinutesManual?: unknown }).studyMinutesManual, 0, 24 * 60);
  if (!Object.keys(manualMinutes).length && legacyManual) {
    manualMinutes[todayKey] = legacyManual;
  }

  const store: AppStore = {
    version: STORE_VERSION,
    tasks: sanitizeTasks(o.tasks),
    examDate: typeof o.examDate === "string" && o.examDate ? o.examDate : base.examDate,
    examDateUserSet: o.examDateUserSet === true,
    goals: clampGoals(o.goals as Partial<Goals> | undefined),
    mocks: sanitizeMocks(o.mocks),
    mastery: sanitizeMastery(o.mastery),
    studyLog: sanitizeStudyLog(o.studyLog),
    today: sanitizeToday(o.today),
    manualMinutes,
    schools: sanitizeSchools(o.schools),
    schoolYears: sanitizeSchoolYears(o.schoolYears),
    sources: sanitizeSources(o.sources),
    resources: sanitizeResources(o.resources),
    resourceVersions: sanitizeResourceVersions(o.resourceVersions),
    questions: sanitizeQuestions(o.questions),
    updateLog: sanitizeUpdateLog(o.updateLog),
    syncState: sanitizeSyncState(o.syncState),
    taskResources: sanitizeIdListMap(o.taskResources),
    userFiles: sanitizeUserFiles(o.userFiles),
  };

  return applySeedsIfEmpty(store);
}

export function readStoreFromStorage(): AppStore {
  if (typeof window === "undefined") return createDefaultStore();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      return normalizeStore(JSON.parse(raw));
    }
  } catch {
    // fall through to default
  }
  return applySeedsIfEmpty(createDefaultStore());
}

export function writeStoreToStorage(store: AppStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // storage full or unavailable
  }
}
