import type { AppStore } from "../store";
import { makeLog, newId, severityOf } from "./service";
import {
  SOURCE_TIER,
  type InfoSource,
  type Resource,
  type ResourceCategory,
  type SourceCheckResult,
  type UpdateEntry,
} from "./types";

/* =========================================================================
 * 同步服务（前端编排）
 *
 * 流程（§9）：
 *   检查官网 → 读取页面 → 提取标题/发布时间/正文与附件 → 计算 contentHash
 *   → 与当前版本比较：
 *        无变化 → 不处理
 *        有变化 → 创建新版本 → 标记 NEED_REVIEW → 写更新日志（待确认）
 *   任何失败 → 记录同步失败，保留最后一次成功数据（§36）
 *
 * 硬约束：本文件不会把任何东西直接写成 CURRENT。CURRENT 只能通过
 * service.confirmUpdate()（人工点击「确认更新」）产生。
 * ========================================================================= */

export type SyncTrigger = "AUTO" | "MANUAL" | "SIMULATE";

export type SyncSummary = {
  at: string;
  trigger: SyncTrigger;
  checked: number;
  unchanged: number;
  changed: number;
  opened: number;
  failed: number;
  skipped: number;
  pendingCount: number;
  notes: string[];
  season: "PEAK" | "NORMAL";
};

type ApiResult = {
  id: string;
  year?: number | null;
  sourceUrl?: string;
  ok: boolean;
  status: number | null;
  finalUrl: string | null;
  finalDomain: string | null;
  officialDomainOk: boolean;
  title: string | null;
  publishedAt: string | null;
  notPublished: boolean;
  blocked: boolean;
  docCount: number | null;
  contentHash: string | null;
  docs: { title: string; url: string; date: string | null }[];
  error: string | null;
  bytes?: number;
  ms?: number;
};

const INTERVAL_MS: Record<string, number> = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
  MANUAL: Number.POSITIVE_INFINITY,
  NEVER: Number.POSITIVE_INFINITY,
};

/** §24 招生季高频同步模式：每年 9–12 月 */
export function isPeakSeason(date: Date = new Date()): boolean {
  const m = date.getMonth() + 1;
  return m >= 9 && m <= 12;
}

export function seasonNote(date: Date = new Date()): string {
  const y = date.getFullYear();
  return isPeakSeason(date)
    ? `招生季高频同步模式已开启（${y} 年 9–12 月）：招生简章 / 专业目录 / 考试科目 / 招生人数 / 推免人数 / 复试政策 / 报名与考试时间发现变化会立即提醒。`
    : "当前为常规同步模式；招生季（9–12 月）会自动切换为高频同步。";
}

/** 需要（且允许）检查的来源 */
export function checkableSources(store: AppStore, sourceIds?: string[]): InfoSource[] {
  return store.sources.filter((s) => {
    if (!s.enabled || !s.url || s.kind === "MANUAL" || s.checkInterval === "NEVER") return false;
    if (sourceIds && sourceIds.length) return sourceIds.includes(s.id);
    return true;
  });
}

export function dueSources(store: AppStore, now: Date = new Date(), sourceIds?: string[]): InfoSource[] {
  const peak = isPeakSeason(now);
  return checkableSources(store, sourceIds).filter((s) => {
    if (peak) return true;
    if (!s.lastCheckedAt) return true;
    const elapsed = now.getTime() - new Date(s.lastCheckedAt).getTime();
    return elapsed >= (INTERVAL_MS[s.checkInterval] ?? INTERVAL_MS.WEEKLY);
  });
}

function sortDocs(docs: ApiResult["docs"]): ApiResult["docs"] {
  return [...docs].sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
}

function categoryForSource(source: InfoSource): ResourceCategory {
  if (source.kind === "YEAR_CATALOG") return "MAJOR_CATALOG";
  const name = source.sourceName;
  if (name.includes("复试分数线")) return "RETEST_LINE";
  if (name.includes("参考书")) return "TUTOR_DIRECTION";
  if (name.includes("考试大纲")) return "EXAM_SUBJECT";
  if (name.includes("报录")) return "APPLY_RATIO";
    if (name.includes("政策")) return "OFFICIAL_POLICY";
  if (name.includes("简章目录") || name.includes("招生简章")) return "ADMISSION_GUIDE";
  if (name.includes("下载")) return "OFFICIAL_POLICY";
  return "OFFICIAL_POLICY";
}

function isOfficialType(source: InfoSource): boolean {
  return SOURCE_TIER[source.sourceType] <= 4;
}

function buildChangeList(
  source: InfoSource,
  r: ApiResult,
): string[] {
  const changes: string[] = [];
  changes.push("页面正文摘要发生变化（contentHash 不同）");
  if (source.lastDocCount != null && r.docCount != null && source.lastDocCount !== r.docCount) {
    changes.push(`页面条目数 ${source.lastDocCount} → ${r.docCount}`);
  }
  const newest = sortDocs(r.docs)[0];
  if (newest?.title) {
    changes.push(`当前最新条目：${newest.title}${newest.date ? `（${newest.date}）` : ""}`);
  }
  if (source.lastTitle && r.title && r.title !== source.lastTitle) {
    changes.push(`页面标题变化：${source.lastTitle} → ${r.title}`);
  }
  if (!r.officialDomainOk) {
    changes.push(`⚠ 页面最终跳转到非官方域名：${r.finalDomain ?? "未知"}，请人工核对后再确认`);
  }
  return changes;
}

const IMPORTANT_DOC_RE =
  /(招生简章|专业目录|招生章程|招生人数|推免|复试|录取|分数线|考试大纲|报名|专项计划)/;

/** 统一维护来源的最后检查状态（内容不变或忽略变更时使用） */
function touchSource(
  store: AppStore,
  source: InfoSource,
  r: ApiResult,
  at: string,
  status: SourceCheckResult["status"],
): AppStore {
  return {
    ...store,
    sources: store.sources.map((s) =>
      s.id === source.id
        ? {
            ...s,
            lastCheckedAt: at,
            lastSuccessAt: at,
            syncStatus: status === "NOT_MODIFIED" ? ("NOT_MODIFIED" as const) : ("OK" as const),
            lastContentHash: r.contentHash,
            lastDocCount: r.docCount,
            lastTitle: r.title,
            lastError: null,
            lastFinalDomain: r.finalDomain,
            updatedAt: at,
          }
        : s,
    ),
  };
}

type Verdict = {
  store: AppStore;
  kind: "unchanged" | "changed" | "opened" | "failed" | "skipped";
  result: SourceCheckResult;
};

/**
 * 处理单个来源的抓取结果：更新来源状态 + 必要时创建待确认版本。
 * 注意：这里绝不修改任何资料的 CURRENT 状态。
 */
function applyResult(
  store: AppStore,
  source: InfoSource,
  r: ApiResult,
  trigger: SyncTrigger,
  at: string,
): Verdict {
  const checkedResult: SourceCheckResult = {
    sourceId: source.id,
    checkedAt: at,
    status: r.ok ? (r.contentHash === source.lastContentHash ? "NOT_MODIFIED" : "CHANGED") : "FAILED",
    finalUrl: r.finalUrl,
    finalDomain: r.finalDomain,
    officialDomainOk: r.officialDomainOk,
    title: r.title,
    publishedAt: r.publishedAt,
    docCount: r.docCount,
    contentHash: r.contentHash,
    changed: false,
    notPublished: r.notPublished,
    error: r.error,
    docs: r.docs,
  };

  /* ---------- 失败：保留旧数据，只记录失败 ---------- */
  if (!r.ok) {
    const sources = store.sources.map((s) =>
      s.id === source.id
        ? {
            ...s,
            lastCheckedAt: at,
            lastFailureAt: at,
            lastError: r.error ?? "未知错误",
            syncStatus: "FAILED" as const,
            lastFinalDomain: r.finalDomain,
            updatedAt: at,
          }
        : s,
    );
    const storeFailed: AppStore = {
      ...store,
      sources,
      updateLog: [
        ...store.updateLog,
        makeLog({
          title: `同步失败：${source.sourceName}`,
          category: categoryForSource(source),
          sourceId: source.id,
          sourceUrl: source.url,
          changeType: "FAILED",
          changes: [r.error ?? "未知错误", `最后成功同步：${source.lastSuccessAt ?? "无记录"}`, "旧数据继续使用，未被覆盖"],
          trigger,
          severity: "INFO",
          confirmStatus: "AUTO",
          schoolId: source.schoolId || null,
          detail: "同步失败不删除、不修改任何已有资料（§36）",
          at,
        }),
      ],
    };
    return { store: storeFailed, kind: "failed", result: { ...checkedResult, changed: false } };
  }

  /* ---------- 首次检查：只建立基线 ---------- */
  const firstBaseline = source.lastContentHash == null;
  const sameHash = source.lastContentHash === r.contentHash;

  if (firstBaseline || sameHash) {
    return {
      store: touchSource(store, source, r, at, sameHash ? "NOT_MODIFIED" : "OK"),
      kind: "unchanged",
      result: { ...checkedResult, status: sameHash ? "NOT_MODIFIED" : "OK", changed: false },
    };
  }

  /* ---------- 年度目录仍未开放：只更新基线 ----------
   * 目录落地页会带日期/公告小改动，hash 变了但含义没变；
   * 这种「仍未开放」不应被当成「发现官方新资料」，否则资料库会被刷屏。 */
  if (source.kind === "YEAR_CATALOG" && r.notPublished) {
    return {
      store: touchSource(store, source, r, at, "NOT_MODIFIED"),
      kind: "unchanged",
      result: { ...checkedResult, status: "NOT_MODIFIED", changed: false, error: null },
    };
  }

  /* ---------- 有变化：创建待确认版本 ---------- */
  const isCatalog = source.kind === "YEAR_CATALOG" && source.year != null;
  const yearRow = isCatalog
    ? store.schoolYears.find((y) => y.schoolId === source.schoolId && y.year === source.year)
    : undefined;
  const yearOpened = isCatalog && !r.notPublished && (!yearRow || yearRow.status !== "PUBLISHED");

  const changes = buildChangeList(source, r);
  if (yearOpened) {
    changes.unshift(`官网新开放 ${source.year} 年招生专业目录（原文不再显示「尚未开放」）`);
  }

  const category = categoryForSource(source);
  const linked = store.resources.filter((res) => res.sourceId === source.id && res.status !== "REMOVED");
  const severity = yearOpened ? "CRITICAL" : severityOf(category, "CHANGED");
  const sourceName = source.sourceName;
  const tierNote = isOfficialType(source)
    ? `来源：${sourceName}（官方）`
    : `来源：${sourceName}（非官方，不能覆盖官方资料）`;

  let resources = [...store.resources];
  let resourceVersions = [...store.resourceVersions];
  let logEntry: UpdateEntry;
  let verdictKind: Verdict["kind"] = "changed";

  if (linked.length) {
    // 已有资料 → 新版本 + NEED_REVIEW
    const target = linked[0];
    const nextVersion = target.version + 1;
    const versionId = newId("rv");
    const updated: Resource = {
      ...target,
      version: nextVersion,
      status: "NEED_REVIEW",
      // 关键：不改变 isCurrent，当前正式值保持不变
      isCurrent: target.status === "CURRENT" ? true : false,
      contentHash: r.contentHash,
      publishedAt: r.publishedAt ?? target.publishedAt,
      sourceUrl: r.finalUrl ?? target.sourceUrl,
      currentVersionId: versionId,
      updatedAt: at,
    };
    resources = resources.map((res) => (res.id === target.id ? updated : res));
    resourceVersions = [
      ...resourceVersions,
      {
        id: versionId,
        resourceId: target.id,
        version: nextVersion,
        title: updated.title,
        publishedAt: updated.publishedAt,
        sourceUrl: updated.sourceUrl,
        contentHash: r.contentHash,
        changeSummary: changes,
        changeType: "SYNC_DETECTED",
        snapshot: {
          title: updated.title,
          category: updated.category,
          subject: updated.subject,
          year: updated.year,
          version: nextVersion,
          status: "NEED_REVIEW",
          publishedAt: updated.publishedAt,
          sourceUrl: updated.sourceUrl,
          facts: updated.facts,
          description: updated.description,
        },
        createdAt: at,
      },
    ];
    logEntry = makeLog({
      title: `检测到更新：${target.title}`,
      category: target.category,
      resourceId: target.id,
      versionId,
      oldVersion: target.version,
      newVersion: nextVersion,
      sourceId: source.id,
      sourceUrl: updated.sourceUrl,
      changeType: yearOpened ? "YEAR_OPENED" : "CHANGED",
      changes,
      trigger,
      severity,
      confirmStatus: "PENDING",
      detail: `${tierNote}。新版本已创建为「待确认」，未覆盖当前正式信息；确认后才会设为当前版本。`,
      schoolId: target.schoolId,
      majorCode: target.majorCode,
      at,
    });
  } else {
    // 没有已关联的资料 → 分两种情况：
    //  ① 年度目录新开放 / 出现「招生类重要文件」→ 建草稿（待确认）
    //  ② 普通页面（首页公告、新闻）有更新 → 只写更新日志提醒，不自动建资料
    //     （否则每天变动的新闻页会把资料库刷屏）
    const newest = sortDocs(r.docs)[0];
    const importantDoc = !!newest && IMPORTANT_DOC_RE.test(newest.title);
    if (!yearOpened && !importantDoc) {
      const logOnly: UpdateEntry = makeLog({
        title: `检测到页面更新：${source.sourceName}`,
        category,
        sourceId: source.id,
        sourceUrl: r.finalUrl ?? source.url,
        changeType: "CHANGED",
        changes,
        trigger,
        severity: "INFO",
        confirmStatus: "AUTO",
        detail: `${tierNote}。仅记录提醒：未自动创建资料（避免日常公告刷屏）。如需要请到资料中心据此新建一条资料。`,
        schoolId: source.schoolId || null,
        at,
      });
      return {
        store: {
          ...touchSource(store, source, r, at, "NOT_MODIFIED"),
          updateLog: [...store.updateLog, logOnly],
        },
        kind: "unchanged",
        result: { ...checkedResult, status: "CHANGED", changed: false, docs: r.docs },
      };
    }

    const title = isCatalog
      ? `电子科技大学 ${source.year} 年招收攻读硕士学位研究生专业目录`
      : `${source.sourceName}${r.title ? ` · ${r.title}` : ""}${newest?.title ? ` · ${newest.title}` : ""}`;
    const resourceId = newId("res");
    const versionId = newId("rv");
    const newResource: Resource = {
      id: resourceId,
      title: title.slice(0, 120),
      category,
      subject: "official",
      schoolId: source.schoolId || null,
      majorCode: null,
      year: isCatalog ? (source.year ?? null) : null,
      version: 1,
      sourceId: source.id,
      sourceUrl: r.finalUrl ?? source.url,
      filePath: null,
      fileType: null,
      fileSize: null,
      description: `由同步检测到官方页面出现新内容。具体数字（招生人数 / 复试线 / 考试科目等）必须在官方页面核实后手工填写，系统不会自动填任何数字。`,
      publishedAt: r.publishedAt,
      effectiveFrom: null,
      effectiveTo: null,
      status: "NEED_REVIEW",
      isOfficial: isOfficialType(source),
      isCurrent: false,
      contentHash: r.contentHash,
      tags: [source.sourceName, String(source.year ?? ""), "待确认"].filter(Boolean),
      facts: [],
      favorite: false,
      currentVersionId: versionId,
      usageStage: "未开始",
      progress: 0,
      createdAt: at,
      updatedAt: at,
    };
    resources = [...resources, newResource];
    resourceVersions = [
      ...resourceVersions,
      {
        id: versionId,
        resourceId,
        version: 1,
        title: newResource.title,
        publishedAt: newResource.publishedAt,
        sourceUrl: newResource.sourceUrl,
        contentHash: r.contentHash,
        changeSummary: changes,
        changeType: "SYNC_DETECTED",
        snapshot: {
          title: newResource.title,
          category: newResource.category,
          subject: newResource.subject,
          year: newResource.year,
          version: 1,
          status: "NEED_REVIEW",
          publishedAt: newResource.publishedAt,
          sourceUrl: newResource.sourceUrl,
          facts: [],
          description: newResource.description,
        },
        createdAt: at,
      },
    ];
    logEntry = makeLog({
      title: `发现官方新资料：${newResource.title}`,
      category,
      resourceId,
      versionId,
      newVersion: 1,
      sourceId: source.id,
      sourceUrl: newResource.sourceUrl,
      changeType: yearOpened ? "YEAR_OPENED" : "NEW",
      changes,
      trigger,
      severity,
      confirmStatus: "PENDING",
      detail: `${tierNote}。已建为草稿（待确认），确认后才会成为当前正式资料。`,
      schoolId: source.schoolId || null,
      at,
    });
    verdictKind = yearOpened ? "opened" : "changed";
  }

  const sources = store.sources.map((s) =>
    s.id === source.id
      ? {
          ...s,
          lastCheckedAt: at,
          lastSuccessAt: at,
          syncStatus: "CHANGED" as const,
          lastContentHash: r.contentHash,
          lastDocCount: r.docCount,
          lastTitle: r.title,
          lastError: null,
          lastFinalDomain: r.finalDomain,
          updatedAt: at,
        }
      : s,
  );

  // 年度目录开放时同步更新年度档案状态（仍标注证据来源）
  const schoolYears =
    yearOpened && source.year != null
      ? store.schoolYears.map((y) =>
          y.schoolId === source.schoolId && y.year === source.year
            ? {
                ...y,
                status: "PUBLISHED" as const,
                note: "同步检测到官网已开放该年度招生专业目录；具体数据请在官方系统核实后填写。",
                evidenceUrl: r.finalUrl ?? y.evidenceUrl,
                evidenceText: (r.title ?? "").slice(0, 120),
                sourceId: source.id,
                verifiedLevel: "OFFICIAL" as const,
                updatedAt: at,
              }
            : y,
        )
      : store.schoolYears;

  return {
    store: {
      ...store,
      sources,
      schoolYears,
      resources,
      resourceVersions,
      updateLog: [...store.updateLog, logEntry],
    },
    kind: verdictKind,
    result: { ...checkedResult, status: "CHANGED", changed: true },
  };
}

function countPending(store: AppStore): number {
  return store.updateLog.filter((e) => e.confirmStatus === "PENDING").length;
}

export function summarize(store: AppStore, trigger: SyncTrigger, at: string, notes: string[] = []): SyncSummary {
  const results = Object.values(store.syncState.results);
  const lastRun = results.filter((r) => r.checkedAt === at);
  return {
    at,
    trigger,
    checked: lastRun.length,
    unchanged: lastRun.filter((r) => r.status === "NOT_MODIFIED" || r.status === "OK").length,
    changed: lastRun.filter((r) => r.status === "CHANGED").length,
    opened: lastRun.filter((r) => r.status === "CHANGED" && r.changed && r.notPublished === false).length,
    failed: lastRun.filter((r) => r.status === "FAILED").length,
    skipped: 0,
    pendingCount: countPending(store),
    notes,
    season: isPeakSeason(new Date(at)) ? "PEAK" : "NORMAL",
  };
}

/** 真正执行同步：调用 /api/sync（服务端抓取），再把结果落到本地库 */
export async function runSync(
  store: AppStore,
  opts: { trigger: SyncTrigger; sourceIds?: string[]; onlyDue?: boolean },
): Promise<{ store: AppStore; summary: SyncSummary }> {
  const at = new Date().toISOString();
  const targets = (opts.onlyDue ? dueSources(store, new Date(at), opts.sourceIds) : checkableSources(store, opts.sourceIds)).slice(0, 12);
  const notes: string[] = [seasonNote(new Date(at))];

  if (!targets.length) {
    const next: AppStore = {
      ...store,
      syncState: { ...store.syncState, lastRunAt: at, lastRunTrigger: opts.trigger, results: store.syncState.results },
    };
    notes.push("没有需要检查的来源（可能都未到期或已禁用）。");
    return { store: next, summary: summarize(next, opts.trigger, at, notes) };
  }

  let apiResults: ApiResult[] = [];
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targets: targets.map((t) => ({
          id: t.id,
          url: t.url,
          officialDomain: t.officialDomain,
          kind: t.kind,
          year: t.year,
        })),
      }),
    });
    if (!res.ok) throw new Error(`同步接口返回 HTTP ${res.status}`);
    const data = (await res.json()) as { results?: ApiResult[] };
    apiResults = Array.isArray(data.results) ? data.results : [];
  } catch (e) {
    const msg = (e as Error).message || "同步接口不可用";
    notes.push(`同步接口调用失败：${msg}（本地数据未做任何修改）`);
    apiResults = targets.map((t) => ({
      id: t.id,
      ok: false,
      status: null,
      finalUrl: null,
      finalDomain: null,
      officialDomainOk: false,
      title: null,
      publishedAt: null,
      notPublished: false,
      blocked: false,
      docCount: null,
      contentHash: null,
      docs: [],
      error: `无法连接本地同步接口：${msg}`,
    }));
  }

  let next = store;
  const results: Record<string, SourceCheckResult> = { ...store.syncState.results };
  let changed = 0;
  let opened = 0;
  let failed = 0;

  for (const target of targets) {
    const api = apiResults.find((r) => r.id === target.id);
    const source = next.sources.find((s) => s.id === target.id);
    if (!source) continue;
    if (!api) {
      results[target.id] = {
        sourceId: target.id,
        checkedAt: at,
        status: "SKIPPED",
        finalUrl: null,
        finalDomain: null,
        officialDomainOk: false,
        title: null,
        publishedAt: null,
        docCount: null,
        contentHash: null,
        changed: false,
        notPublished: false,
        error: "接口未返回该来源结果",
        docs: [],
      };
      continue;
    }
    const verdict = applyResult(next, source, api, opts.trigger, at);
    next = verdict.store;
    results[target.id] = verdict.result;
    if (verdict.kind === "changed") changed += 1;
    if (verdict.kind === "opened") opened += 1;
    if (verdict.kind === "failed") failed += 1;
  }

  const anySuccess = Object.values(results).some(
    (r) => r.checkedAt === at && r.status !== "FAILED" && r.status !== "SKIPPED",
  );

  next = {
    ...next,
    syncState: {
      lastRunAt: at,
      lastSuccessAt: anySuccess ? at : next.syncState.lastSuccessAt,
      lastRunTrigger: opts.trigger,
      results,
    },
  };

  return { store: next, summary: summarize(next, opts.trigger, at, notes) };
}

/* ------------------------------------------------------------------ */
/* 模拟检测（离线演示 / 自测用；所有产物都明确标注【模拟】）              */
/* ------------------------------------------------------------------ */

export type SimScenario = "year-opened" | "catalog-changed" | "third-party" | "failure";

export const SIM_SCENARIOS: { id: SimScenario; label: string; hint: string }[] = [
  { id: "year-opened", label: "官网开放 2028 招生目录", hint: "官方来源，最高优先级 → 可直接确认" },
  { id: "catalog-changed", label: "专业目录内容变化", hint: "官方来源 → 新版本待确认（不覆盖当前值）" },
  { id: "third-party", label: "第三方声称科目变更", hint: "低优先级来源 → 确认会被阻止（§11）" },
  { id: "failure", label: "官网抓取失败", hint: "记录失败并保留旧数据（§36）" },
];

function simSource(store: AppStore, scenario: SimScenario): InfoSource {
  if (scenario === "third-party") {
    const id = "src-sim-third-party";
    const existing = store.sources.find((s) => s.id === id);
    if (existing) return existing;
    const created: InfoSource = {
      id,
      schoolId: "school-uestc",
      sourceName: "【模拟】某考研机构公众号",
      sourceType: "OTHER",
      url: "https://example.com/sim/third-party",
      officialDomain: "",
      description: "仅用于演示「第三方消息不能覆盖官方信息」的模拟来源。",
      enabled: false,
      lastCheckedAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      syncStatus: "IDLE",
      checkInterval: "NEVER",
      kind: "DOC_LIST",
      year: null,
      lastContentHash: null,
      lastDocCount: null,
      lastTitle: null,
      lastError: null,
      lastFinalDomain: null,
      isSeed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return created;
  }
  const id = scenario === "year-opened" ? "src-uestc-catalog-2028" : "src-uestc-catalog-2026";
  return (
    store.sources.find((s) => s.id === id) ??
    store.sources.find((s) => s.kind === "YEAR_CATALOG")!
  );
}

/**
 * 模拟一次检测：不联网，直接把「假设的抓取结果」喂给同一套检测逻辑，
 * 用来验证 版本创建 / 待确认 / 阻止低优先级覆盖 / 失败保留 这四条链路。
 */
export function simulateSync(
  store: AppStore,
  scenario: SimScenario,
): { store: AppStore; summary: SyncSummary; scenario: SimScenario } {
  const at = new Date().toISOString();
  let base = store;

  if (scenario === "third-party" && !store.sources.some((s) => s.id === "src-sim-third-party")) {
    base = { ...store, sources: [...store.sources, simSource(store, scenario)] };
  }

  const source = simSource(base, scenario);
  if (!source) {
    return { store, summary: summarize(store, "SIMULATE", at, ["没有可用于模拟的来源"]), scenario };
  }

  /* ---- 第三方消息场景：把「小道消息」登记为官方资料的候选变更，但阻止其生效（§11） ---- */
  if (scenario === "third-party") {
    const target =
      base.resources.find((r) => r.id === "res-uestc-catalog-2026" && r.status !== "REMOVED") ??
      base.resources.find((r) => r.isOfficial && r.status === "CURRENT");
    if (!target) {
      return { store, summary: summarize(store, "SIMULATE", at, ["没有可用的官方资料作为对照"]), scenario };
    }
    const nextVersion = target.version + 1;
    const versionId = newId("rv");
    const changes = [
      "【模拟】某第三方账号称「初试科目可能有调整」",
      "官方页面未发布任何相关通知（未核实）",
      "⚠ 该消息来源优先级为 6，不能覆盖官方信息",
    ];
    const updated: Resource = {
      ...target,
      version: nextVersion,
      status: "NEED_REVIEW",
      currentVersionId: versionId,
      updatedAt: at,
    };
    const entry = makeLog({
      title: `第三方消息，待官方确认：${target.title}`,
      category: target.category,
      resourceId: target.id,
      versionId,
      oldVersion: target.version,
      newVersion: nextVersion,
      sourceId: source.id,
      sourceUrl: source.url,
      changeType: "CHANGED",
      changes,
      trigger: "SIMULATE",
      severity: "INFO",
      confirmStatus: "PENDING",
      detail: `【模拟场景：third-party】来源：${source.sourceName}（第三方，优先级 ${SOURCE_TIER[source.sourceType]}）。第三方消息不能更新「当前考试科目」，确认按钮会被系统阻止；提供官方页面后重新检查即可。`,
      schoolId: target.schoolId,
      majorCode: target.majorCode,
      at,
    });

    const next: AppStore = {
      ...base,
      resources: base.resources.map((r) => (r.id === target.id ? updated : r)),
      resourceVersions: [
        ...base.resourceVersions,
        {
          id: versionId,
          resourceId: target.id,
          version: nextVersion,
          title: updated.title,
          publishedAt: updated.publishedAt,
          sourceUrl: source.url,
          contentHash: `sim-third-party-${at}`,
          changeSummary: changes,
          changeType: "SYNC_DETECTED",
          snapshot: {
            title: updated.title,
            category: updated.category,
            subject: updated.subject,
            year: updated.year,
            version: nextVersion,
            status: "NEED_REVIEW",
            publishedAt: updated.publishedAt,
            sourceUrl: updated.sourceUrl,
            facts: updated.facts,
            description: updated.description,
          },
          createdAt: at,
        },
      ],
      updateLog: [...base.updateLog, entry],
      syncState: {
        lastRunAt: at,
        lastSuccessAt: at,
        lastRunTrigger: "SIMULATE",
        results: base.syncState.results,
      },
    };
    return {
      store: next,
      summary: summarize(next, "SIMULATE", at, [
        "【模拟】第三方消息已登记为待确认，但不会影响官方资料。",
        "【模拟】不会写入任何编造的招生人数、复试线或考试科目数字。",
      ]),
      scenario,
    };
  }

  const fakeDocs = [{ title: "【模拟】官网公告：招生工作安排更新", url: source.url, date: at.slice(0, 10) }];
  const fakeResult: ApiResult =
    scenario === "failure"
      ? {
          id: source.id,
          ok: false,
          status: 202,
          finalUrl: source.url,
          finalDomain: new URL(source.url).host,
          officialDomainOk: false,
          title: null,
          publishedAt: null,
          notPublished: false,
          blocked: true,
          docCount: null,
          contentHash: null,
          docs: [],
          error: "【模拟】页面疑似被安全策略拦截（HTTP 202），已保留上一次成功数据",
        }
      : {
          id: source.id,
          ok: true,
          status: 200,
          finalUrl: source.url,
          finalDomain: new URL(source.url).host,
          // 走到这里的只剩官方来源场景（third-party 已在上方单独处理）
          officialDomainOk: true,
          title:
            scenario === "year-opened"
              ? `电子科技大学${source.year}年招收攻读硕士学位研究生专业目录`
              : source.lastTitle ?? "【模拟】页面标题",
          publishedAt: at.slice(0, 10),
          notPublished: false,
          blocked: false,
          docCount: (source.lastDocCount ?? 3) + 1,
          contentHash: `sim-${scenario}-${at}`,
          docs: fakeDocs,
          error: null,
        };

  const verdict = applyResult(base, { ...source, lastContentHash: source.lastContentHash ?? "baseline" }, fakeResult, "SIMULATE", at);

  let next = verdict.store;
  next = {
    ...next,
    syncState: {
      lastRunAt: at,
      lastSuccessAt: verdict.kind === "failed" ? next.syncState.lastSuccessAt : at,
      lastRunTrigger: "SIMULATE",
      results: { ...next.syncState.results, [source.id]: verdict.result },
    },
    updateLog: next.updateLog.map((e) =>
      e.at === at ? { ...e, trigger: "SIMULATE" as const, detail: `【模拟场景：${scenario}】${e.detail}` } : e,
    ),
  };

  const notes = [
    "【模拟】本次未联网，结果仅用于验证「检测 → 新版本 → 待确认」链路。",
    "【模拟】不会写入任何编造的招生人数、复试线或考试科目数字。",
  ];
  return { store: next, summary: summarize(next, "SIMULATE", at, notes), scenario };
}
