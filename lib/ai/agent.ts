import { weakPoints } from "../knowledge";
import { SUBJECT_NAME, SUBJECTS, type SubjectId } from "../plan";
import {
  ALL_TASKS,
  currentMonthPlan,
  localDateKey,
  overallProgress,
  subjectProgress,
} from "../progress";
import {
  DEFAULT_GOALS,
  MAIN_TARGET,
  analyze,
  avg,
  examTotal,
  goalsTotal,
  predictionFrom,
  recentFirst,
  sortByDateAsc,
} from "../scoring";
import {
  consecutiveDays,
  formatHours,
  minutesThisWeek,
  minutesToday,
} from "../streak";
import { buildMessages } from "./prompts";
import { getAdvisor, getAdvisorFor } from "./service";
import type { AiAdvice, AiContext, AiSection } from "./types";

/**
 * Agent 层：负责把「本机备考数据」整理成结构化快照，再交给 Provider 生成建议。
 * 换模型时只要换 Provider，这一层不用动。
 */
export function buildDataSnapshot(ctx: AiContext, now: Date = new Date()): string {
  const { store, todayIds } = ctx;
  const done = store.tasks;
  const overall = overallProgress(done);
  const subs = subjectProgress(done);
  const month = currentMonthPlan(now);
  const monthTasks = ALL_TASKS.filter((t) => t.monthId === month.id);
  const monthDone = monthTasks.filter((t) => done[t.id]).length;
  const todayDone = todayIds.filter((id) => done[id]).length;
  const goals = store.goals ?? DEFAULT_GOALS;

  const lines: string[] = [];
  lines.push(`今天：${localDateKey(now)}`);
  lines.push(
    `总体进度：${overall.done}/${overall.total}（${overall.pct}%）`,
  );
  lines.push(
    `科目完成率：${SUBJECTS.map((s) => `${s.short} ${subs[s.id].pct}%`).join("｜")}`,
  );
  lines.push(`当前月（${month.label}）：${monthDone}/${monthTasks.length}`);
  lines.push(`今日任务：${todayDone}/${todayIds.length} 项已完成`);
  lines.push(
    `学习时长：今日 ${formatHours(minutesToday(store.studyLog, store.manualMinutes, now))} 小时，本周 ${formatHours(
      minutesThisWeek(store.studyLog, store.manualMinutes, now),
    )} 小时，连续 ${consecutiveDays(store.studyLog, now)} 天`,
  );
  lines.push(
    `目标分：${SUBJECTS.map((s) => `${s.short} ${goals[s.id]}`).join("｜")}（合计 ${goalsTotal(goals)}，主目标口径 ${MAIN_TARGET}）`,
  );

  const sorted = sortByDateAsc(store.mocks);
  if (!sorted.length) {
    lines.push("模考：暂无记录");
  } else {
    const totals = sorted.map(examTotal);
    const { value: prediction } = predictionFrom(store.mocks);
    lines.push(
      `模考 ${sorted.length} 次，总分走势：${totals.join(" → ")}（近 3 次平均 ${prediction ?? "—"}）`,
    );
    const latest = recentFirst(store.mocks)[0];
    if (latest) {
      lines.push(
        `最近一次：${latest.name}（${latest.date}）总分 ${examTotal(latest)}｜政治 ${latest.politics}、英语 ${latest.english}、数学 ${latest.math}、408 ${latest.cs408}`,
      );
    }
    const a = analyze(store.mocks, goals);
    if (a.weakest) {
      lines.push(
        `近 3 次各科平均：${SUBJECTS.map((s) => {
          const scores = sorted.map((m) => m[s.id]).slice(-3);
          return `${s.short} ${Math.round(avg(scores))}（目标 ${goals[s.id]}）`;
        }).join("｜")}`,
      );
      lines.push(
        `最弱科目：${SUBJECT_NAME[a.weakest.subject]}｜差距最大：${a.biggestGap ? SUBJECT_NAME[a.biggestGap.subject] : "—"}｜近期趋势：${a.improving ? "上升" : "持平或下降"}`,
      );
    }
  }

  const weak = weakPoints(store.mastery, done);
  lines.push(
    weak.length
      ? `薄弱知识点：${weak.slice(0, 6).map((w) => `${w.name}(${w.mastery}%)`).join("、")}`
      : "薄弱知识点：未标记",
  );

  const lowest = ([...SUBJECTS].map((s) => s.id) as SubjectId[]).sort(
    (x, y) => subs[x].pct - subs[y].pct,
  )[0];
  lines.push(`任务推进最慢科目：${SUBJECT_NAME[lowest]}（${subs[lowest].pct}%）`);

  return lines.join("\n");
}

export function buildAgentPrompt(
  section: AiSection,
  ctx: AiContext,
): { system: string; messages: { role: "system" | "user"; content: string }[] } {
  const snapshot = buildDataSnapshot(ctx);
  const messages = buildMessages(section, snapshot);
  return { system: messages[0].content, messages };
}

export type AgentRun = {
  providerId: string;
  advice: AiAdvice;
  snapshot: string;
};

function pickAdvisor(providerId?: string) {
  return providerId ? getAdvisorFor(providerId) : getAdvisor();
}

function isPromise(v: unknown): v is Promise<AiAdvice> {
  return typeof (v as Promise<AiAdvice> | null)?.then === "function";
}

/** 同步 Provider（本地规则 / 占位实现）用这个 */
export function runAgent(ctx: AiContext, providerId?: string): AgentRun {
  const advisor = pickAdvisor(providerId);
  const result = advisor.getAdvice(ctx);
  if (isPromise(result)) {
    throw new Error(
      `Provider「${advisor.id}」是异步实现，请改用 runAgentAsync。`,
    );
  }
  return {
    providerId: advisor.id,
    advice: result,
    snapshot: buildDataSnapshot(ctx),
  };
}

/** 未来的 DeepSeek / OpenAI / 通义 等网络 Provider 用这个 */
export async function runAgentAsync(
  ctx: AiContext,
  providerId?: string,
): Promise<AgentRun> {
  const advisor = pickAdvisor(providerId);
  return {
    providerId: advisor.id,
    advice: await advisor.getAdvice(ctx),
    snapshot: buildDataSnapshot(ctx),
  };
}
