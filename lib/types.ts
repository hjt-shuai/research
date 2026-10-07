import type { SubjectId } from "./plan";

export type StudyStatus = "not-started" | "learning" | "mastered";

export const STUDY_STATUS_LABEL: Record<StudyStatus, string> = {
  "not-started": "未开始",
  learning: "学习中",
  mastered: "已掌握",
};

export type MasteryState = {
  status: StudyStatus;
  taskDone: boolean;
  accuracy: number | null;
  weak: boolean;
};

export type MasteryMap = Record<string, MasteryState>;

export type MockExam = {
  id: string;
  name: string;
  date: string;
  politics: number;
  english: number;
  math: number;
  cs408: number;
};

export type Goals = Record<SubjectId, number>;

export type DayLog = { minutes: number; tasks: number };

export type StudyLog = Record<string, DayLog>;

/** 按日期（YYYY-MM-DD）记录的手动补充学习时长（分钟） */
export type ManualMinutes = Record<string, number>;

export type TodayState = { date: string; ids: string[] };

export type AppMeta = { version: number };
