"use client";

import { useCallback } from "react";
import { useAppStore } from "./AppStoreProvider";
import * as svc from "@/lib/db/service";
import { restoreSeeds } from "@/lib/store";
import {
  runSync,
  simulateSync,
  type SimScenario,
  type SyncSummary,
  type SyncTrigger,
} from "@/lib/db/syncService";
import {
  MAX_INLINE_FILE_BYTES,
  fileTypeOf,
  isAllowedUpload,
  openStoredFile,
  putFile,
  removeFile,
} from "@/lib/db/files";
import type {
  InfoSource,
  Question,
  Resource,
  ResourceCategory,
  ResourceSubject,
  School,
  SchoolYearData,
  UpdateEntry,
} from "@/lib/db/types";

/**
 * 资料中心 / 院校情报 / 真题库 / 更新中心的统一操作入口。
 * 所有写操作都通过 provider 的 apply()（不可变 reducer）落库，
 * 因此刷新页面后数据仍然存在，且历史版本永远保留。
 */
export function useLibrary() {
  const { store, apply, replaceStore } = useAppStore();

  /* ---------------- 资料 ---------------- */

  const createResource = useCallback(
    (input: svc.ResourceInput): string => {
      const id = input.id ?? svc.newId("res");
      apply((s) => svc.createResource(s, { ...input, id }).store);
      return id;
    },
    [apply],
  );

  const editResource = useCallback(
    (id: string, patch: Partial<svc.ResourceInput>, changeSummary?: string[]) => {
      apply((s) => svc.updateResource(s, id, patch, changeSummary));
    },
    [apply],
  );

  const patchMeta = useCallback(
    (id: string, patch: Partial<Resource>) => {
      apply((s) => svc.patchResourceMeta(s, id, patch));
    },
    [apply],
  );

  const toggleFavorite = useCallback((id: string) => apply((s) => svc.toggleFavorite(s, id)), [apply]);
  const deleteResource = useCallback((id: string) => apply((s) => svc.softDeleteResource(s, id)), [apply]);
  const restoreResource = useCallback((id: string) => apply((s) => svc.restoreResource(s, id)), [apply]);
  const promoteResource = useCallback((id: string) => apply((s) => svc.promoteToCurrent(s, id)), [apply]);
  const archiveResource = useCallback((id: string) => apply((s) => svc.archiveResource(s, id)), [apply]);

  /** 上传「我的资料」：文件本体进 IndexedDB，元数据 + 资料记录进本地库 */
  const uploadUserFile = useCallback(
    async (
      file: File,
      meta: { title?: string; category?: ResourceCategory; subject?: ResourceSubject; year?: number | null; tags?: string[] },
    ): Promise<{ ok: boolean; stored: boolean; id: string; message: string }> => {
      if (!isAllowedUpload(file.name)) {
        return {
          ok: false,
          stored: false,
          id: "",
          message: `不支持的文件类型（.${fileTypeOf(file.name) || "未知"}）。支持 PDF / DOCX / XLSX / PPTX / TXT / PNG / JPG。`,
        };
      }
      const fileId = svc.newId("file");
      const tooBig = file.size > MAX_INLINE_FILE_BYTES;
      const stored = tooBig ? false : await putFile(fileId, file);
      const resourceId = svc.newId("res");
      const ts = new Date().toISOString();

      apply((s) => {
        const withMeta = {
          ...s,
          userFiles: [
            ...s.userFiles,
            {
              id: fileId,
              name: file.name,
              mime: file.type || `application/${fileTypeOf(file.name)}`,
              size: file.size,
              stored,
              resourceId,
              createdAt: ts,
            },
          ],
        };
        const { store: next } = svc.createResource(withMeta, {
          id: resourceId,
          title: meta.title?.trim() || file.name,
          category: meta.category ?? "MY_UPLOAD",
          subject: meta.subject ?? "general",
          year: meta.year ?? null,
          description: stored
            ? "我上传的本地文件（仅保存在本机 IndexedDB，不会标记为官方资料）。"
            : `文件体积超过 ${Math.round(MAX_INLINE_FILE_BYTES / 1024 / 1024)}MB，仅登记了元数据（未保存文件本体）。`,
          filePath: stored ? `idb://${fileId}` : null,
          fileType: fileTypeOf(file.name),
          fileSize: file.size,
          isOfficial: false,
          status: "CURRENT",
          tags: [...(meta.tags ?? []), "我的资料"],
        });
        return next;
      });

      return {
        ok: true,
        stored,
        id: resourceId,
        message: stored
          ? `已保存到本机：「${file.name}」（不参与自动更新，也不会被当成官方资料）。`
          : `已登记元数据：「${file.name}」文件过大，未保存文件本体。`,
      };
    },
    [apply],
  );

  const openUserFile = useCallback(async (resourceId: string, download = false) => {
    const res = store.resources.find((r) => r.id === resourceId);
    const fileId = res?.filePath?.startsWith("idb://") ? res.filePath.slice(6) : null;
    if (!fileId) return false;
    return openStoredFile(fileId, download);
  }, [store.resources]);

  const deleteUserFile = useCallback(
    async (resourceId: string) => {
      const meta = store.userFiles.find((f) => f.resourceId === resourceId);
      if (meta) await removeFile(meta.id);
      apply((s) => ({
        ...svc.softDeleteResource(s, resourceId),
        userFiles: s.userFiles.filter((f) => f.resourceId !== resourceId),
      }));
    },
    [apply, store.userFiles],
  );

  /* ---------------- 信息源 ---------------- */

  const addSource = useCallback(
    (input: {
      sourceName: string;
      url: string;
      sourceType: InfoSource["sourceType"];
      schoolId?: string;
      officialDomain?: string;
      description?: string;
      checkInterval?: InfoSource["checkInterval"];
      kind?: InfoSource["kind"];
      year?: number | null;
    }): string => {
      const id = svc.newId("src");
      const ts = new Date().toISOString();
      let domain = input.officialDomain?.trim() ?? "";
      if (!domain) {
        try {
          domain = new URL(input.url).host;
        } catch {
          domain = "";
        }
      }
      const source: InfoSource = {
        id,
        schoolId: input.schoolId ?? "",
        sourceName: input.sourceName.trim() || "未命名来源",
        sourceType: input.sourceType,
        url: input.url.trim(),
        officialDomain: domain,
        description: input.description ?? "",
        enabled: true,
        lastCheckedAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        syncStatus: "IDLE",
        checkInterval: input.checkInterval ?? "WEEKLY",
        kind: input.kind ?? "DOC_LIST",
        year: input.year ?? null,
        lastContentHash: null,
        lastDocCount: null,
        lastTitle: null,
        lastError: null,
        lastFinalDomain: null,
        isSeed: false,
        createdAt: ts,
        updatedAt: ts,
      };
      apply((s) => ({ ...s, sources: [...s.sources, source] }));
      return id;
    },
    [apply],
  );

  const updateSource = useCallback(
    (id: string, patch: Partial<InfoSource>) => {
      apply((s) => ({
        ...s,
        sources: s.sources.map((x) => (x.id === id ? { ...x, ...patch, id: x.id, updatedAt: new Date().toISOString() } : x)),
      }));
    },
    [apply],
  );

  const removeSource = useCallback(
    (id: string) => apply((s) => ({ ...s, sources: s.sources.filter((x) => x.id !== id) })),
    [apply],
  );

  const restoreSeedsAction = useCallback(() => apply((s) => restoreSeeds(s)), [apply]);

  /* ---------------- 院校 ---------------- */

  const addSchool = useCallback(
    (input: Parameters<typeof svc.addSchool>[1]): string => {
      const id = input.id ?? svc.newId("school");
      apply((s) => svc.addSchool(s, { ...input, id }).store);
      return id;
    },
    [apply],
  );

  const editSchool = useCallback(
    (id: string, patch: Partial<School>) => apply((s) => svc.updateSchool(s, id, patch)),
    [apply],
  );

  const editSchoolYear = useCallback(
    (id: string, patch: Partial<SchoolYearData>) => apply((s) => svc.updateSchoolYear(s, id, patch)),
    [apply],
  );

  const ensureSchoolYear = useCallback(
    (schoolId: string, year: number) => apply((s) => svc.addSchoolYear(s, schoolId, year)),
    [apply],
  );

  /* ---------------- 真题 / 错题 ---------------- */

  const addQuestion = useCallback(
    (input: Omit<Question, "id" | "createdAt" | "updatedAt">): string => {
      const id = svc.newId("q");
      apply((s) => svc.addQuestion(s, { ...input, id }).store);
      return id;
    },
    [apply],
  );

  const editQuestion = useCallback(
    (id: string, patch: Partial<Question>) => apply((s) => svc.updateQuestion(s, id, patch)),
    [apply],
  );

  const markWrong = useCallback(
    (id: string, userAnswer?: string) => apply((s) => svc.markWrong(s, id, userAnswer)),
    [apply],
  );

  const markFixed = useCallback((id: string) => apply((s) => svc.markFixed(s, id)), [apply]);

  /* ---------------- 任务 ↔ 资料 ---------------- */

  const bindResource = useCallback(
    (taskId: string, resourceId: string) => apply((s) => svc.bindResourceToTask(s, taskId, resourceId)),
    [apply],
  );

  const unbindResource = useCallback(
    (taskId: string, resourceId: string) => apply((s) => svc.unbindResourceFromTask(s, taskId, resourceId)),
    [apply],
  );

  /* ---------------- 同步 ---------------- */

  const syncNow = useCallback(
    async (opts: { trigger: SyncTrigger; sourceIds?: string[]; onlyDue?: boolean }): Promise<SyncSummary> => {
      const { store: next, summary } = await runSync(store, opts);
      replaceStore(next);
      return summary;
    },
    [store, replaceStore],
  );

  const simulate = useCallback(
    (scenario: SimScenario): SyncSummary => {
      const { store: next, summary } = simulateSync(store, scenario);
      replaceStore(next);
      return summary;
    },
    [store, replaceStore],
  );

  const confirmUpdate = useCallback((entryId: string) => apply((s) => svc.confirmUpdate(s, entryId)), [apply]);
  const rejectUpdate = useCallback((entryId: string) => apply((s) => svc.rejectUpdate(s, entryId)), [apply]);

  const pendingEntries = useCallback((): UpdateEntry[] => svc.pendingUpdates(store), [store]);

  return {
    store,
    /* 资料 */
    createResource,
    editResource,
    patchMeta,
    toggleFavorite,
    deleteResource,
    restoreResource,
    promoteResource,
    archiveResource,
    uploadUserFile,
    openUserFile,
    deleteUserFile,
    /* 来源 */
    addSource,
    updateSource,
    removeSource,
    restoreSeedsAction,
    /* 院校 */
    addSchool,
    editSchool,
    editSchoolYear,
    ensureSchoolYear,
    /* 真题 */
    addQuestion,
    editQuestion,
    markWrong,
    markFixed,
    /* 绑定 */
    bindResource,
    unbindResource,
    /* 同步 */
    syncNow,
    simulate,
    confirmUpdate,
    rejectUpdate,
    pendingEntries,
  };
}
