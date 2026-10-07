import type { AppStore } from "../store";
import { KP_INDEX, kpLabel, masteryIdOf } from "./kp";
import {
  SOURCE_TIER,
  type FactOrigin,
  type InfoSource,
  type Question,
  type Resource,
  type ResourceCategory,
  type ResourceFact,
  type ResourceStatus,
  type ResourceSubject,
  type ResourceVersion,
  type School,
  type SchoolYearData,
  type Severity,
  type UpdateEntry,
  type ConfirmStatus,
} from "./types";

/* =========================================================================
 * 服务层（纯函数）：输入 store → 输出新 store
 * 说明：所有写操作都是不可变更新，便于 AppStoreProvider 统一持久化，
 *      也保证「历史版本永不删除」「CURRENT 不被自动覆盖」这两条硬约束。
 * ========================================================================= */

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rand}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** 官方且有年度口径的分类：同一分类只保留一个 CURRENT，新版本启用时旧版本自动归档 */
const YEAR_SCOPED_CATEGORIES: ResourceCategory[] = [
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
];

/** §39：这些字段的任何更新都必须人工确认 */
const SENSITIVE_CATEGORIES: ResourceCategory[] = [
  "EXAM_SUBJECT",
  "PLAN_ENROLL",
  "RECOMMENDED_QUOTA",
  "RETEST_LINE",
  "MAJOR_CATALOG",
  "ADMISSION_GUIDE",
  "APPLY_RATIO",
  "ADMISSION_LIST",
];

export function isYearScoped(r: Pick<Resource, "isOfficial" | "category">): boolean {
  return r.isOfficial && YEAR_SCOPED_CATEGORIES.includes(r.category);
}

export function isSensitiveCategory(c: ResourceCategory | null | undefined): boolean {
  return !!c && SENSITIVE_CATEGORIES.includes(c);
}

export function severityOf(category: ResourceCategory | null, changeType: string): Severity {
  if (changeType === "YEAR_OPENED") return "CRITICAL";
  if (!category) return "INFO";
  if (isSensitiveCategory(category)) return "CRITICAL";
  if (category === "RETEST_RULE" || category === "TUITION_DURATION" || category === "TUTOR_DIRECTION") {
    return "IMPORTANT";
  }
  return "INFO";
}

/* ------------------------------ 版本控制 ------------------------------ */

export function snapshotOf(r: Resource): ResourceVersion["snapshot"] {
  return {
    title: r.title,
    category: r.category,
    subject: r.subject,
    year: r.year,
    version: r.version,
    status: r.status,
    publishedAt: r.publishedAt,
    sourceUrl: r.sourceUrl,
    facts: r.facts,
    description: r.description,
  };
}

export type VersionInput = {
  changeType: ResourceVersion["changeType"];
  changeSummary: string[];
  title?: string;
  publishedAt?: string | null;
  sourceUrl?: string;
  contentHash?: string | null;
  /** 版本记录里的字段快照（默认取当前资源快照） */
  snapshot?: ResourceVersion["snapshot"];
};

function makeVersion(r: Resource, version: number, input: VersionInput): ResourceVersion {
  return {
    id: newId("rv"),
    resourceId: r.id,
    version,
    title: input.title ?? r.title,
    publishedAt: input.publishedAt ?? r.publishedAt,
    sourceUrl: input.sourceUrl ?? r.sourceUrl,
    contentHash: input.contentHash ?? r.contentHash,
    changeSummary: input.changeSummary,
    changeType: input.changeType,
    snapshot: input.snapshot ?? snapshotOf(r),
    createdAt: nowIso(),
  };
}

/* ------------------------------ 资料 CRUD ------------------------------ */

export type ResourceInput = {
  id?: string;
  title: string;
  category: ResourceCategory;
  subject: ResourceSubject;
  year: number | null;
  schoolId?: string | null;
  majorCode?: string | null;
  sourceId?: string | null;
  sourceUrl?: string;
  description?: string;
  publishedAt?: string | null;
  isOfficial?: boolean;
  status?: ResourceStatus;
  tags?: string[];
  facts?: ResourceFact[];
  filePath?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  usageStage?: Resource["usageStage"];
};

export function createResource(
  store: AppStore,
  input: ResourceInput,
): { store: AppStore; resource: Resource } {
  const ts = nowIso();
  const resource: Resource = {
    id: input.id ?? newId("res"),
    title: input.title.trim() || "未命名资料",
    category: input.category,
    subject: input.subject,
    schoolId: input.schoolId ?? null,
    majorCode: input.majorCode ?? null,
    year: input.year,
    version: 1,
    sourceId: input.sourceId ?? null,
    sourceUrl: input.sourceUrl ?? "",
    filePath: input.filePath ?? null,
    fileType: input.fileType ?? null,
    fileSize: input.fileSize ?? null,
    description: input.description ?? "",
    publishedAt: input.publishedAt ?? null,
    effectiveFrom: null,
    effectiveTo: null,
    // 用户新增默认草稿（除非显式指定）；官方资料由同步流程产生并停在 NEED_REVIEW
    status: input.status ?? "DRAFT",
    isOfficial: input.isOfficial ?? false,
    isCurrent: (input.status ?? "DRAFT") === "CURRENT",
    contentHash: null,
    tags: input.tags ?? [],
    facts: input.facts ?? [],
    favorite: false,
    currentVersionId: null,
    usageStage: input.usageStage ?? "未开始",
    progress: 0,
    createdAt: ts,
    updatedAt: ts,
  };
  const version = makeVersion(resource, 1, { changeType: "CREATED", changeSummary: ["创建资料"] });
  resource.currentVersionId = version.id;

  return {
    store: {
      ...store,
      resources: [...store.resources, resource],
      resourceVersions: [...store.resourceVersions, version],
    },
    resource,
  };
}

export function updateResource(
  store: AppStore,
  id: string,
  patch: Partial<ResourceInput>,
  changeSummary: string[] = ["手动编辑"],
): AppStore {
  const resource = store.resources.find((r) => r.id === id);
  if (!resource) return store;

  const nextVersion = resource.version + 1;
  const updated: Resource = {
    ...resource,
    ...patch,
    title: patch.title !== undefined ? patch.title.trim() || resource.title : resource.title,
    version: nextVersion,
    updatedAt: nowIso(),
  };

  const version = makeVersion(updated, nextVersion, {
    changeType: "MANUAL_EDIT",
    changeSummary: changeSummary.length ? changeSummary : ["手动编辑"],
    snapshot: snapshotOf(updated),
  });
  updated.currentVersionId = version.id;

  return {
    ...store,
    resources: store.resources.map((r) => (r.id === id ? updated : r)),
    resourceVersions: [...store.resourceVersions, version],
  };
}

/** 只改元信息（收藏/进度/阶段/标签），不产生新版本 */
export function patchResourceMeta(store: AppStore, id: string, patch: Partial<Resource>): AppStore {
  return {
    ...store,
    resources: store.resources.map((r) =>
      r.id === id ? { ...r, ...patch, id: r.id, updatedAt: nowIso() } : r,
    ),
  };
}

export function toggleFavorite(store: AppStore, id: string): AppStore {
  const r = store.resources.find((x) => x.id === id);
  if (!r) return store;
  return patchResourceMeta(store, id, { favorite: !r.favorite });
}

/** 软删除：只改状态，历史版本与元数据全部保留（§44.11） */
export function softDeleteResource(store: AppStore, id: string): AppStore {
  const r = store.resources.find((x) => x.id === id);
  if (!r) return store;
  const version = makeVersion({ ...r, status: "REMOVED", version: r.version + 1 }, r.version + 1, {
    changeType: "STATUS_CHANGE",
    changeSummary: ["资料被删除（历史版本保留）"],
    snapshot: { ...snapshotOf(r), status: "REMOVED" },
  });
  return {
    ...store,
    resources: store.resources.map((x) =>
      x.id === id
        ? { ...x, status: "REMOVED", isCurrent: false, version: r.version + 1, currentVersionId: version.id, updatedAt: nowIso() }
        : x,
    ),
    resourceVersions: [...store.resourceVersions, version],
    updateLog: [
      ...store.updateLog,
      makeLog({
        title: `删除资料：${r.title}`,
        category: r.category,
        resourceId: r.id,
        sourceId: r.sourceId,
        sourceUrl: r.sourceUrl,
        changeType: "CHANGED",
        changes: ["资料状态 → 已删除（历史版本保留，可恢复）"],
        trigger: "USER_EDIT",
        severity: "INFO",
        confirmStatus: "AUTO",
      }),
    ],
  };
}

export function restoreResource(store: AppStore, id: string): AppStore {
  const r = store.resources.find((x) => x.id === id);
  if (!r) return store;
  return patchResourceMeta(store, id, { status: "ARCHIVED", isCurrent: false });
}

/**
 * 把某个资料设为 CURRENT（§22 / §39）。
 * 官方年度口径资料：同分类的旧 CURRENT 自动转为 ARCHIVED（历史不删除）。
 */
export function promoteToCurrent(store: AppStore, id: string): AppStore {
  const target = store.resources.find((r) => r.id === id);
  if (!target) return store;

  // §11：第三方 / 非官方来源不能覆盖官方口径的敏感类目
  const guard = promotionGuard(target);
  if (!guard.allowed) {
    return {
      ...store,
      updateLog: [
        ...store.updateLog,
        makeLog({
          title: `拒绝设为当前有效：${target.title}`,
          category: target.category,
          resourceId: target.id,
          sourceId: target.sourceId,
          sourceUrl: target.sourceUrl,
          changeType: "CHANGED",
          changes: ["非官方来源，不能作为官方类目的当前有效值"],
          trigger: "USER_EDIT",
          severity: "INFO",
          confirmStatus: "REJECTED",
          detail: guard.reason,
          schoolId: target.schoolId,
          majorCode: target.majorCode,
        }),
      ],
    };
  }

  const ts = nowIso();
  const archiveSiblings = isYearScoped(target);
  const archivedIds: string[] = [];

  const resources = store.resources.map((r) => {
    if (r.id === id) {
      return { ...r, status: "CURRENT" as ResourceStatus, isCurrent: true, updatedAt: ts };
    }
    if (
      archiveSiblings &&
      r.status === "CURRENT" &&
      r.category === target.category &&
      (r.schoolId ?? "") === (target.schoolId ?? "") &&
      (r.majorCode ?? "") === (target.majorCode ?? "")
    ) {
      archivedIds.push(r.id);
      return { ...r, status: "ARCHIVED" as ResourceStatus, isCurrent: false, updatedAt: ts };
    }
    return r;
  });

  const logs: UpdateEntry[] = [
    makeLog({
      title: `启用为当前版本：${target.title}`,
      category: target.category,
      resourceId: target.id,
      versionId: target.currentVersionId,
      newVersion: target.version,
      sourceId: target.sourceId,
      sourceUrl: target.sourceUrl,
      changeType: "CHANGED",
      changes: [`版本 v${target.version} 设为当前有效`],
      trigger: "USER_EDIT",
      severity: severityOf(target.category, "CHANGED"),
      confirmStatus: "CONFIRMED",
      schoolId: target.schoolId,
      majorCode: target.majorCode,
    }),
  ];

  for (const oldId of archivedIds) {
    const old = store.resources.find((r) => r.id === oldId);
    if (!old) continue;
    logs.push(
      makeLog({
        title: `归档旧版本：${old.title}`,
        category: old.category,
        resourceId: old.id,
        oldVersion: old.version,
        sourceId: old.sourceId,
        sourceUrl: old.sourceUrl,
        changeType: "CHANGED",
        changes: ["新版本启用，旧版本转为已归档（数据保留）"],
        trigger: "USER_EDIT",
        severity: "INFO",
        confirmStatus: "AUTO",
        schoolId: old.schoolId,
        majorCode: old.majorCode,
      }),
    );
  }

  return { ...store, resources, updateLog: [...store.updateLog, ...logs] };
}

export function archiveResource(store: AppStore, id: string): AppStore {
  return patchResourceMeta(store, id, { status: "ARCHIVED", isCurrent: false });
}

/* ------------------------------ 更新日志 ------------------------------ */

export function makeLog(input: {
  title: string;
  category: ResourceCategory | null;
  resourceId?: string | null;
  versionId?: string | null;
  oldVersion?: number | null;
  newVersion?: number | null;
  changes: string[];
  sourceId: string | null;
  sourceUrl: string;
  changeType: UpdateEntry["changeType"];
  trigger: UpdateEntry["trigger"];
  severity: Severity;
  confirmStatus: ConfirmStatus;
  detail?: string;
  schoolId?: string | null;
  majorCode?: string | null;
  at?: string;
}): UpdateEntry {
  return {
    id: newId("log"),
    at: input.at ?? nowIso(),
    schoolId: input.schoolId ?? null,
    majorCode: input.majorCode ?? null,
    resourceId: input.resourceId ?? null,
    versionId: input.versionId ?? null,
    category: input.category,
    title: input.title,
    oldVersion: input.oldVersion ?? null,
    newVersion: input.newVersion ?? null,
    changeType: input.changeType,
    changes: input.changes,
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    trigger: input.trigger,
    severity: input.severity,
    confirmStatus: input.confirmStatus,
    detail: input.detail ?? "",
  };
}

export function pendingUpdates(store: AppStore): UpdateEntry[] {
  return [...store.updateLog].filter((e) => e.confirmStatus === "PENDING").reverse();
}

export type ConfirmGuard = { allowed: boolean; reason: string };

/** §11：非官方来源不能成为官方类目（考试科目/招生人数/复试线…）的「当前有效」值 */
export function promotionGuard(resource: Pick<Resource, "isOfficial" | "category">): ConfirmGuard {
  if (!resource.isOfficial && isSensitiveCategory(resource.category)) {
    return {
      allowed: false,
      reason:
        "非官方来源的资料不能设为官方类目（考试科目 / 招生人数 / 专业代码 / 复试线等）的当前有效值。请先拿到官方页面确认，再登记为官方资料。",
    };
  }
  return { allowed: true, reason: "" };
}

/** §11 / §39：低优先级来源不能覆盖高优先级来源；敏感字段必须人工确认 */
export function canConfirm(store: AppStore, entry: UpdateEntry): ConfirmGuard {
  if (entry.confirmStatus !== "PENDING") return { allowed: false, reason: "该记录无需再次确认" };
  if (!entry.resourceId) return { allowed: true, reason: "" };

  const resource = store.resources.find((r) => r.id === entry.resourceId);
  if (!resource) return { allowed: true, reason: "" };

  const entrySource = entry.sourceId ? store.sources.find((s) => s.id === entry.sourceId) : null;
  const currentSource = resource.sourceId ? store.sources.find((s) => s.id === resource.sourceId) : null;

  if (entrySource && currentSource && entrySource.id !== currentSource.id) {
    const entryTier = SOURCE_TIER[entrySource.sourceType];
    const currentTier = SOURCE_TIER[currentSource.sourceType];
    if (entryTier > currentTier) {
      return {
        allowed: false,
        reason: `来源优先级不足：「${entrySource.sourceName}」低于当前来源「${currentSource.sourceName}」。第三方消息不能覆盖官方信息，请先获得官方页面确认。`,
      };
    }
  }
  return { allowed: true, reason: "" };
}

/** 确认更新：把待确认版本提升为当前值 */
export function confirmUpdate(store: AppStore, entryId: string): AppStore {
  const entry = store.updateLog.find((e) => e.id === entryId);
  if (!entry) return store;
  const guard = canConfirm(store, entry);
  if (!guard.allowed) return store;

  const ts = nowIso();
  const markConfirmed = (s: AppStore): AppStore => ({
    ...s,
    updateLog: s.updateLog.map((e) => (e.id === entryId ? { ...e, confirmStatus: "CONFIRMED" as ConfirmStatus } : e)),
  });

  if (!entry.resourceId) {
    return markConfirmed({
      ...store,
      updateLog: store.updateLog.map((e) =>
        e.id === entryId ? { ...e, confirmStatus: "CONFIRMED" as ConfirmStatus, detail: `${e.detail}（已确认）` } : e,
      ),
    });
  }

  const resource = store.resources.find((r) => r.id === entry.resourceId);
  if (!resource) return markConfirmed(store);

  const version = entry.versionId
    ? store.resourceVersions.find((v) => v.id === entry.versionId)
    : [...store.resourceVersions].reverse().find((v) => v.resourceId === resource.id);

  const snap = version?.snapshot;
  const updated: Resource = snap
    ? {
        ...resource,
        title: snap.title || resource.title,
        category: snap.category,
        subject: snap.subject,
        year: snap.year,
        publishedAt: snap.publishedAt,
        sourceUrl: snap.sourceUrl || resource.sourceUrl,
        facts: snap.facts.length ? snap.facts : resource.facts,
        description: snap.description || resource.description,
        version: version ? version.version : resource.version,
        currentVersionId: version?.id ?? resource.currentVersionId,
        contentHash: version?.contentHash ?? resource.contentHash,
        status: "CURRENT",
        isCurrent: true,
        updatedAt: ts,
      }
    : { ...resource, status: "CURRENT", isCurrent: true, updatedAt: ts };

  const withResource: AppStore = {
    ...store,
    resources: store.resources.map((r) => (r.id === updated.id ? updated : r)),
  };

  // 官方年度资料：启用新版本时归档同分类旧版本
  const promoted = promoteToCurrent(withResource, updated.id);

  return markConfirmed({
    ...promoted,
    updateLog: promoted.updateLog.map((e) =>
      e.id === entryId
        ? { ...e, confirmStatus: "CONFIRMED" as ConfirmStatus, detail: `${e.detail}（已人工确认并启用）` }
        : e,
    ),
  });
}

export function rejectUpdate(store: AppStore, entryId: string): AppStore {
  const entry = store.updateLog.find((e) => e.id === entryId);
  if (!entry) return store;
  const ts = nowIso();
  const resources = entry.resourceId
    ? store.resources.map((r) => {
        if (r.id !== entry.resourceId) return r;
        // 被忽略的自动检测结果：不进 CURRENT；如果它还没有正式版本，转归档保留痕迹
        if (r.status === "CURRENT") return r;
        return { ...r, status: "ARCHIVED" as ResourceStatus, isCurrent: false, updatedAt: ts };
      })
    : store.resources;

  return {
    ...store,
    resources,
    updateLog: store.updateLog.map((e) =>
      e.id === entryId
        ? { ...e, confirmStatus: "REJECTED" as ConfirmStatus, detail: `${e.detail}（已忽略，当前正式信息保持不变）` }
        : e,
    ),
  };
}

/* ------------------------------ 检索与筛选 ------------------------------ */

export type ResourceFilter = {
  tab?: string;
  keyword?: string;
  year?: number | "all";
  subject?: ResourceSubject | "all";
  category?: ResourceCategory | "all";
  sourceId?: string | "all";
  status?: ResourceStatus | "all";
  officialOnly?: boolean;
  favoritesOnly?: boolean;
  schoolId?: string | "all";
};

const TAB_CATEGORIES: Record<string, ResourceCategory[]> = {
  OFFICIAL: [
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
  ],
  MATH_1: ["MATH_1"],
  ENGLISH_1: ["ENGLISH_1"],
  CS_408: ["CS_408"],
  POLITICS: ["POLITICS"],
  REAL_PAPER: ["REAL_PAPER"],
  MOCK_PAPER: ["MOCK_PAPER"],
  SCHOOL: ["ADMISSION_GUIDE", "MAJOR_CATALOG", "RETEST_LINE", "ADMISSION_LIST", "TUTOR_DIRECTION"],
};

export function tabCategories(tab: string): ResourceCategory[] | null {
  return TAB_CATEGORIES[tab] ?? null;
}

export function filterResources(
  resources: Resource[],
  sources: InfoSource[],
  filter: ResourceFilter,
): Resource[] {
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const keyword = (filter.keyword ?? "").trim().toLowerCase();
  const cats = filter.tab ? tabCategories(filter.tab) : null;

  return resources
    .filter((r) => {
      if (filter.tab === "LATEST") {
        // 最新更新页签：只看近期有变更的资料
        return r.status !== "REMOVED";
      }
      return r.status !== "REMOVED";
    })
    .filter((r) => {
      if (filter.officialOnly && !r.isOfficial && filter.tab !== "MY_UPLOAD") return false;
      if (filter.favoritesOnly && !r.favorite) return false;
      if (filter.tab === "MY_UPLOAD") return r.category === "MY_UPLOAD" || !!r.filePath;
      if (filter.tab === "OFFICIAL" && !r.isOfficial) return false;
      if (cats && !cats.includes(r.category)) return false;

      if (filter.year && filter.year !== "all" && r.year !== filter.year) return false;
      if (filter.subject && filter.subject !== "all" && r.subject !== filter.subject) return false;
      if (filter.category && filter.category !== "all" && r.category !== filter.category) return false;
      if (filter.status && filter.status !== "all" && r.status !== filter.status) return false;
      if (filter.schoolId && filter.schoolId !== "all" && r.schoolId !== filter.schoolId) return false;
      if (filter.sourceId && filter.sourceId !== "all" && r.sourceId !== filter.sourceId) return false;

      if (keyword) {
        const source = r.sourceId ? sourceById.get(r.sourceId) : undefined;
        const haystack = [
          r.title,
          r.description,
          r.tags.join(" "),
          r.facts.map((f) => `${f.key} ${f.value}`).join(" "),
          source?.sourceName ?? "",
          String(r.year ?? ""),
          r.majorCode ?? "",
        ]
          .join(" ")
          .toLowerCase();
        // 支持「408 操作系统」这种多词查询
        const terms = keyword.split(/\s+/).filter(Boolean);
        if (!terms.every((t) => haystack.includes(t))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const t = (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt);
      if (t !== 0) return t;
      return b.year != null && a.year != null ? b.year - a.year : 0;
    });
}

export function versionsOf(store: AppStore, resourceId: string): ResourceVersion[] {
  return store.resourceVersions
    .filter((v) => v.resourceId === resourceId)
    .sort((a, b) => b.version - a.version);
}

/* ------------------------------ 院校情报 ------------------------------ */

export function addSchool(
  store: AppStore,
  input: {
    id?: string;
    name: string;
    code?: string;
    province?: string;
    admissionUrl?: string;
    collegeUrl?: string;
    majorName?: string;
    majorCode?: string;
  },
): { store: AppStore; school: School } {
  const ts = nowIso();
  const school: School = {
    id: input.id ?? newId("school"),
    name: input.name.trim() || "未命名学校",
    code: input.code?.trim() ?? "",
    province: input.province?.trim() ?? "",
    admissionUrl: input.admissionUrl?.trim() ?? "",
    collegeUrl: input.collegeUrl?.trim() ?? "",
    majorName: input.majorName?.trim() ?? "",
    majorCode: input.majorCode?.trim() ?? "",
    studyMode: "",
    duration: "",
    tuition: "",
    examSubjects: "",
    planEnroll: "",
    recommendedQuota: "",
    retestLine: "",
    admissionCount: "",
    minScore: "",
    avgScore: "",
    retestRatio: "",
    retestSubjects: "",
    machineTest: "",
    directions: "",
    tutorDirections: "",
    officialLinks: [],
    isTarget: false,
    fieldSources: {},
    createdAt: ts,
    updatedAt: ts,
  };
  const links = [
    input.admissionUrl?.trim() ? { label: "研究生招生网", url: input.admissionUrl.trim() } : null,
    input.collegeUrl?.trim() ? { label: "学院官网", url: input.collegeUrl.trim() } : null,
  ].filter((x): x is { label: string; url: string } => x !== null);
  school.officialLinks = links;

  return { store: { ...store, schools: [...store.schools, school] }, school };
}

export function updateSchool(store: AppStore, id: string, patch: Partial<School>): AppStore {
  return {
    ...store,
    schools: store.schools.map((s) => (s.id === id ? { ...s, ...patch, id: s.id, updatedAt: nowIso() } : s)),
  };
}

export function updateSchoolYear(
  store: AppStore,
  id: string,
  patch: Partial<SchoolYearData>,
): AppStore {
  return {
    ...store,
    schoolYears: store.schoolYears.map((y) =>
      y.id === id ? { ...y, ...patch, id: y.id, schoolId: y.schoolId, year: y.year, updatedAt: nowIso() } : y,
    ),
  };
}

export function addSchoolYear(store: AppStore, schoolId: string, year: number): AppStore {
  if (store.schoolYears.some((y) => y.schoolId === schoolId && y.year === year)) return store;
  const ts = nowIso();
  const row: SchoolYearData = {
    id: newId("sy"),
    schoolId,
    year,
    majorCode: "",
    status: "UNKNOWN",
    examSubjects: "",
    planEnroll: "",
    recommendedQuota: "",
    retestLine: "",
    admissionCount: "",
    minScore: "",
    avgScore: "",
    note: "",
    evidenceUrl: "",
    evidenceText: "",
    sourceId: null,
    verifiedLevel: "UNKNOWN",
    createdAt: ts,
    updatedAt: ts,
  };
  return { ...store, schoolYears: [...store.schoolYears, row] };
}

export type TrendPoint = { year: number; value: number | null; label: string };

/**
 * 年度趋势：没有任何数据时返回 value=null（界面显示「暂无数据」），
 * 绝不把缺失年份当成 0（§21）。
 */
export function trendSeries(
  rows: SchoolYearData[],
  schoolId: string,
  field: "retestLine" | "planEnroll" | "admissionCount" | "recommendedQuota",
  years: number[],
): TrendPoint[] {
  return years.map((year) => {
    const row = rows.find((r) => r.schoolId === schoolId && r.year === year);
    const raw = row ? row[field] : "";
    const parsed = parseScore(raw);
    return { year, value: parsed, label: raw || "" };
  });
}

/** 从「2026: 320」这类文本里提取第一个数字；提取不到就返回 null */
function parseScore(raw: string): number | null {
  if (!raw) return null;
  const m = raw.replace(/[，,]/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

export function yearsOf(rows: SchoolYearData[], schoolId: string): number[] {
  return rows.filter((r) => r.schoolId === schoolId).map((r) => r.year).sort((a, b) => a - b);
}

/* ------------------------------ 真题 / 错题 ------------------------------ */

export type QuestionInput = Omit<Question, "id" | "createdAt" | "updatedAt"> & { id?: string };

export function addQuestion(store: AppStore, input: QuestionInput): { store: AppStore; question: Question } {
  const ts = nowIso();
  const question: Question = { ...input, id: input.id ?? newId("q"), createdAt: ts, updatedAt: ts };
  return { store: { ...store, questions: [...store.questions, question] }, question };
}

export function updateQuestion(store: AppStore, id: string, patch: Partial<Question>): AppStore {
  return {
    ...store,
    questions: store.questions.map((q) => (q.id === id ? { ...q, ...patch, id: q.id, updatedAt: nowIso() } : q)),
  };
}

export function markWrong(store: AppStore, id: string, userAnswer = ""): AppStore {
  const q = store.questions.find((x) => x.id === id);
  if (!q) return store;
  return updateQuestion(store, id, {
    isWrong: true,
    wrongCount: q.wrongCount + 1,
    userAnswer: userAnswer || q.userAnswer,
    mastery: Math.max(0, q.mastery - 10),
  });
}

/** 重做正确：错误标记取消、掌握度提升（保留 wrongCount 作为历史） */
export function markFixed(store: AppStore, id: string): AppStore {
  const q = store.questions.find((x) => x.id === id);
  if (!q) return store;
  return updateQuestion(store, id, { isWrong: false, mastery: Math.min(100, q.mastery + 25) });
}

export type WrongStat = { kpId: string; label: string; count: number; subject: Question["subject"] };

export function wrongStats(questions: Question[]): WrongStat[] {
  const map = new Map<string, WrongStat>();
  for (const q of questions) {
    if (!q.isWrong) continue;
    const key = q.knowledgePoint || "unknown";
    const item = map.get(key) ?? {
      kpId: key,
      label: key === "unknown" ? "未标注知识点" : kpLabel(key),
      count: 0,
      subject: q.subject,
    };
    item.count += q.wrongCount > 0 ? q.wrongCount : 1;
    map.set(key, item);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export type KpRecommendation = {
  kpId: string;
  kpLabel: string;
  teaching: Resource[];
  realPapers: Resource[];
  others: Resource[];
};

/**
 * §31 错题 → 资料联动：按知识点匹配教材、真题与其它资料。
 * 匹配顺序：知识点标签 → 父级知识点标签 → 同科真题/模拟题。
 */
export function recommendForKp(store: AppStore, kpId: string): KpRecommendation {
  const node = KP_INDEX[kpId];
  const parentId = node?.parent ?? null;
  const subject = node?.subject ?? null;
  const masteryId = masteryIdOf(kpId);
  const keys = [kpId, parentId, masteryId].filter((x): x is string => !!x);

  const visible = store.resources.filter((r) => r.status !== "REMOVED");
  const hit = (r: Resource) => keys.some((k) => r.tags.includes(k));

  const tagged = visible.filter(hit);
  const subjectOf = (s: Question["subject"]): Resource["subject"] =>
    s === "CS_408" ? "cs408" : s === "MATH_1" ? "math" : s === "ENGLISH_1" ? "english" : "politics";

  const teaching = tagged
    .filter((r) => r.category === "CS_408" || r.category === "MATH_1" || r.category === "ENGLISH_1" || r.category === "POLITICS")
    .slice(0, 4);
  const realPapers = tagged.filter((r) => r.category === "REAL_PAPER").slice(0, 4);
  const others = tagged
    .filter((r) => !teaching.includes(r) && !realPapers.includes(r))
    .slice(0, 4);

  if (subject && realPapers.length === 0) {
    const fallback = visible
      .filter((r) => r.category === "REAL_PAPER" && r.subject === subjectOf(subject))
      .slice(0, 3);
    realPapers.push(...fallback);
  }

  return { kpId, kpLabel: kpLabel(kpId), teaching, realPapers, others };
}

/* ------------------------------ 任务 ↔ 资料绑定 ------------------------------ */

export function bindResourceToTask(store: AppStore, taskId: string, resourceId: string): AppStore {
  const cur = store.taskResources[taskId] ?? [];
  if (cur.includes(resourceId)) return store;
  return { ...store, taskResources: { ...store.taskResources, [taskId]: [...cur, resourceId] } };
}

export function unbindResourceFromTask(store: AppStore, taskId: string, resourceId: string): AppStore {
  const cur = store.taskResources[taskId] ?? [];
  const next = cur.filter((id) => id !== resourceId);
  const taskResources = { ...store.taskResources };
  if (next.length) taskResources[taskId] = next;
  else delete taskResources[taskId];
  return { ...store, taskResources };
}

export function resourcesOfTask(store: AppStore, taskId: string): Resource[] {
  const ids = store.taskResources[taskId] ?? [];
  return ids
    .map((id) => store.resources.find((r) => r.id === id))
    .filter((r): r is Resource => !!r && r.status !== "REMOVED");
}

/* ------------------------------ 统计 ------------------------------ */

export type LibraryStats = {
  total: number;
  official: number;
  mine: number;
  needReview: number;
  favorites: number;
  byCategory: { category: ResourceCategory; count: number }[];
};

export function libraryStats(store: AppStore): LibraryStats {
  const visible = store.resources.filter((r) => r.status !== "REMOVED");
  const map = new Map<ResourceCategory, number>();
  for (const r of visible) map.set(r.category, (map.get(r.category) ?? 0) + 1);
  return {
    total: visible.length,
    official: visible.filter((r) => r.isOfficial).length,
    mine: visible.filter((r) => r.category === "MY_UPLOAD" || !!r.filePath).length,
    needReview: visible.filter((r) => r.status === "NEED_REVIEW" || r.status === "DRAFT").length,
    favorites: visible.filter((r) => r.favorite).length,
    byCategory: [...map.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function factOriginLabelOf(r: Resource): FactOrigin {
  if (r.isOfficial) return "OFFICIAL";
  return r.filePath ? "USER" : "UNKNOWN";
}
