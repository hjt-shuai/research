import {
  LEGACY_EXAM_KEY,
  LEGACY_TASKS_KEY,
  STORE_KEY,
  applySeedsIfEmpty,
  createDefaultStore,
  normalizeStore,
  type AppStore,
} from "./store";

export function loadStoreWithMigration(): AppStore {
  if (typeof window === "undefined") return createDefaultStore();

  try {
    const existing = window.localStorage.getItem(STORE_KEY);
    if (existing) {
      // v1/v2/v3 → v4 的兼容升级在 normalizeStore 内完成（含内置资料库注入）
      return normalizeStore(JSON.parse(existing));
    }
  } catch {
    // continue to legacy
  }

  const store = applySeedsIfEmpty(createDefaultStore());

  try {
    const tasksRaw = window.localStorage.getItem(LEGACY_TASKS_KEY);
    if (tasksRaw) {
      const tasks = JSON.parse(tasksRaw) as Record<string, boolean>;
      if (tasks && typeof tasks === "object") {
        store.tasks = { ...tasks };
      }
    }
  } catch {
    // ignore
  }

  try {
    const examRaw = window.localStorage.getItem(LEGACY_EXAM_KEY);
    if (examRaw) {
      const parsed = JSON.parse(examRaw) as string;
      if (typeof parsed === "string" && parsed) {
        store.examDate = parsed;
        // 旧版有单独日期键，说明是用户自己设过的
        store.examDateUserSet = true;
      }
    }
  } catch {
    // ignore
  }

  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  return store;
}
