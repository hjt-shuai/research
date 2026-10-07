"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadStoreWithMigration } from "@/lib/migrate";
import {
  bumpStudyLog,
  MINUTES_PER_TASK,
  setManualMinutes as withManualMinutes,
} from "@/lib/streak";
import { localDateKey } from "@/lib/progress";
import { pickTodayTaskIds } from "@/lib/todayTasks";
import { writeStoreToStorage, type AppStore } from "@/lib/store";
import { clampGoals } from "@/lib/scoring";
import type { Goals, MasteryState, MockExam } from "@/lib/types";
import { defaultMastery } from "@/lib/knowledge";

type AppStoreContextValue = {
  loaded: boolean;
  store: AppStore;
  setTaskDone: (id: string, value: boolean) => void;
  toggleTask: (id: string) => void;
  resetTasks: () => void;
  setExamDate: (date: string, userSet?: boolean) => void;
  addMock: (exam: Omit<MockExam, "id">) => void;
  removeMock: (id: string) => void;
  updateMastery: (kpId: string, patch: Partial<MasteryState>) => void;
  setGoals: (goals: Goals) => void;
  setTodayMinutes: (minutes: number) => void;
  replaceStore: (next: AppStore) => void;
  /** 通用不可变更新入口：资料中心 / 情报库 / 真题库共用（唯一写入点仍然是这里） */
  apply: (updater: (s: AppStore) => AppStore) => void;
  todayIds: string[];
};

/** 勾选/取消任务：同时维护当天的学习记录（每项任务按 30 分钟估算） */
function applyTaskDone(s: AppStore, id: string, value: boolean): AppStore {
  const was = !!s.tasks[id];
  if (was === value) return s;
  const dateKey = localDateKey();
  const delta = value ? MINUTES_PER_TASK : -MINUTES_PER_TASK;
  return {
    ...s,
    tasks: { ...s.tasks, [id]: value },
    studyLog: bumpStudyLog(s.studyLog, dateKey, value ? 1 : -1, delta),
  };
}

const AppStoreContext = createContext<AppStoreContextValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<AppStore | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setStore(loadStoreWithMigration());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !store) return;
    writeStoreToStorage(store);
  }, [store, loaded]);

  const persist = useCallback((updater: (s: AppStore) => AppStore) => {
    setStore((prev) => (prev ? updater(prev) : prev));
  }, []);

  const setTaskDone = useCallback(
    (id: string, value: boolean) => {
      persist((s) => applyTaskDone(s, id, value));
    },
    [persist],
  );

  const toggleTask = useCallback(
    (id: string) => {
      persist((s) => applyTaskDone(s, id, !s.tasks[id]));
    },
    [persist],
  );

  const resetTasks = useCallback(() => {
    persist((s) => ({ ...s, tasks: {} }));
  }, [persist]);

  const setExamDate = useCallback(
    (date: string, userSet = true) => {
      persist((s) => ({
        ...s,
        examDate: date,
        examDateUserSet: userSet,
      }));
    },
    [persist],
  );

  const addMock = useCallback(
    (exam: Omit<MockExam, "id">) => {
      persist((s) => ({
        ...s,
        mocks: [...s.mocks, { ...exam, id: crypto.randomUUID() }],
      }));
    },
    [persist],
  );

  const removeMock = useCallback(
    (id: string) => {
      persist((s) => ({
        ...s,
        mocks: s.mocks.filter((m) => m.id !== id),
      }));
    },
    [persist],
  );

  const updateMastery = useCallback(
    (kpId: string, patch: Partial<MasteryState>) => {
      persist((s) => {
        const cur = s.mastery[kpId] ?? defaultMastery();
        return {
          ...s,
          mastery: {
            ...s.mastery,
            [kpId]: { ...cur, ...patch },
          },
        };
      });
    },
    [persist],
  );

  const setGoals = useCallback(
    (goals: Goals) => {
      persist((s) => ({ ...s, goals: clampGoals(goals) }));
    },
    [persist],
  );

  const setTodayMinutes = useCallback(
    (minutes: number) => {
      persist((s) => ({
        ...s,
        manualMinutes: withManualMinutes(s.manualMinutes, localDateKey(), minutes),
      }));
    },
    [persist],
  );

  const replaceStore = useCallback((next: AppStore) => {
    setStore(next);
  }, []);

  const todayIds = useMemo(() => {
    if (!store) return [];
    const ids = pickTodayTaskIds(store.tasks, store.mastery, store.today);
    const dateKey = localDateKey();
    if (!store.today || store.today.date !== dateKey) {
      return ids;
    }
    return store.today.ids.length ? store.today.ids : ids;
  }, [store]);

  useEffect(() => {
    if (!store || !loaded) return;
    const dateKey = localDateKey();
    const ids = pickTodayTaskIds(store.tasks, store.mastery, store.today);
    if (store.today?.date === dateKey && store.today.ids.join() === ids.join()) {
      return;
    }
    persist((s) => ({ ...s, today: { date: dateKey, ids } }));
  }, [store?.tasks, store?.mastery, loaded, persist]);

  const value = useMemo((): AppStoreContextValue | null => {
    if (!store) return null;
    return {
      loaded,
      store,
      setTaskDone,
      toggleTask,
      resetTasks,
      setExamDate,
      addMock,
      removeMock,
      updateMastery,
      setGoals,
      setTodayMinutes,
      replaceStore,
      apply: persist,
      todayIds,
    };
  }, [
    store,
    loaded,
    setTaskDone,
    toggleTask,
    resetTasks,
    setExamDate,
    addMock,
    removeMock,
    updateMastery,
    setGoals,
    setTodayMinutes,
    replaceStore,
    persist,
    todayIds,
  ]);

  if (!value) {
    return (
      <div className="app">
        <p className="hint">加载本地数据…</p>
      </div>
    );
  }

  return (
    <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
  );
}

export function useAppStore(): AppStoreContextValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}
