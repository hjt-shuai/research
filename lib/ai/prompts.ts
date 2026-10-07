import { SECTION_TITLE, type AiSection } from "./types";

export const SYSTEM_PROMPT = `你是考研备考助手，面向电子科技大学 085404 计算机技术（全日制专硕）。
科目：101 政治、201 英语一、301 数学一、408 计算机学科专业基础。
主目标 375+（保底 365+ / 冲刺 385+）。
回答应简洁、可执行，不涉及未公布的官方招生数据；涉及 2028 年的信息一律标注为“预计/当前备考口径/待官方公布”。`;

export const SECTION_INSTRUCTIONS: Record<AiSection, string> = {
  todayAnalysis:
    "根据今日任务完成情况与当前学习时长，用 2–3 句话评价今天的执行情况，并给出今晚剩余时间的安排建议。",
  scoreAnalysis:
    "根据模考记录评价成绩走势，指出与目标分的差距与最需要补的科目，用 2–3 句话说明原因。",
  weakPoints:
    "列出当前薄弱知识点，说明它们为什么会拖累总分，并给出优先攻克顺序。",
  nextWeekPlan:
    "给出一份未来 7 天可执行的计划，按科目分配时间，说明每天的重点与产出物。",
};

export function buildUserPrompt(section: AiSection, data: string): string {
  return `【任务】${SECTION_TITLE[section]}\n${SECTION_INSTRUCTIONS[section]}\n\n【备考数据快照】\n${data}`;
}

export function buildMessages(
  section: AiSection,
  data: string,
): { role: "system" | "user"; content: string }[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(section, data) },
  ];
}
