import { weakPoints } from "../knowledge";
import { SUBJECTS, SUBJECT_NAME } from "../plan";
import {
  ALL_TASKS,
  currentMonthPlan,
  overallProgress,
  subjectProgress,
} from "../progress";
import { DEFAULT_GOALS, analyze } from "../scoring";
import type { AiAdvice, AiContext, AiProvider } from "./types";

export class RulesAdvisor implements AiProvider {
  id = "rules-local";

  getAdvice(ctx: AiContext): AiAdvice {
    const { store, todayIds } = ctx;
    const done = store.tasks;
    const overall = overallProgress(done);
    const subs = subjectProgress(done);
    const month = currentMonthPlan();
    const monthTasks = ALL_TASKS.filter((t) => t.monthId === month.id);
    const monthDone = monthTasks.filter((t) => done[t.id]).length;
    const todayDone = todayIds.filter((id) => done[id]).length;

    const todayAnalysis = `今日计划 ${todayIds.length} 项，已完成 ${todayDone} 项。当前月（${month.label}）进度 ${monthDone}/${monthTasks.length}。总体任务完成 ${overall.pct}%。`;

    const a = analyze(store.mocks, store.goals ?? DEFAULT_GOALS);
    let scoreAnalysis = "尚未有模考记录，建议在强化阶段开始后每月至少 1 次全科模考。";
    if (a.count > 0) {
      scoreAnalysis = `共 ${a.count} 次模考，预测分约 ${a.prediction ?? "—"}。`;
      if (a.weakest) {
        scoreAnalysis += `最弱科目：${SUBJECT_NAME[a.weakest.subject]}（近 3 次均 ${a.weakest.avg3}）。`;
      }
      scoreAnalysis += a.improving ? " 总分趋势向上。" : " 建议稳住基础、减少波动。";
    }

    const weak = weakPoints(store.mastery, store.tasks);
    const weakPointsText =
      weak.length > 0
        ? `已标记薄弱：${weak.slice(0, 5).map((w) => w.name).join("、")}。`
        : "暂无薄弱知识点标记，可在知识掌握度页标记后获得更准建议。";

    const lowest = SUBJECTS.map((s) => s.id).sort(
      (x, y) => subs[x].pct - subs[y].pct,
    )[0];
    const nextWeekPlan = `下周优先：${SUBJECT_NAME[lowest]}（当前 ${subs[lowest].pct}%）+ 当前月未完成任务；若模考显示 ${a.biggestGap ? SUBJECT_NAME[a.biggestGap.subject] : "某科"} 差距大，每天加 30–45 分钟专项。`;

    return {
      todayAnalysis,
      scoreAnalysis,
      weakPoints: weakPointsText,
      nextWeekPlan,
    };
  }
}
