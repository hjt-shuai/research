import type { AppStore } from "../store";

export type AiContext = {
  store: AppStore;
  todayIds: string[];
};

export type AiAdvice = {
  todayAnalysis: string;
  scoreAnalysis: string;
  weakPoints: string;
  nextWeekPlan: string;
};

export type AiSection = keyof AiAdvice;

export const AI_SECTIONS: { key: AiSection; title: string }[] = [
  { key: "todayAnalysis", title: "今日学习分析" },
  { key: "scoreAnalysis", title: "最近成绩分析" },
  { key: "weakPoints", title: "薄弱知识点" },
  { key: "nextWeekPlan", title: "下周计划建议" },
];

export const SECTION_TITLE: Record<AiSection, string> = {
  todayAnalysis: "今日学习分析",
  scoreAnalysis: "最近成绩分析",
  weakPoints: "薄弱知识点",
  nextWeekPlan: "下周计划建议",
};

export interface AiProvider {
  id: string;
  getAdvice(ctx: AiContext): Promise<AiAdvice> | AiAdvice;
}
