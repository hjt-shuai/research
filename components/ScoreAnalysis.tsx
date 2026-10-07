"use client";

import { SUBJECT_NAME } from "@/lib/plan";
import { DEFAULT_GOALS, analyze } from "@/lib/scoring";
import { useAppStore } from "./AppStoreProvider";

export default function ScoreAnalysis() {
  const { store } = useAppStore();
  const a = analyze(store.mocks, store.goals ?? DEFAULT_GOALS);

  if (a.count === 0) {
    return (
      <section className="card score-analysis" id="analysis" aria-label="成绩分析">
        <h2 className="section-title">成绩分析</h2>
        <p className="hint">添加模考后将自动生成分析与建议。</p>
      </section>
    );
  }

  const focus = a.biggestGap ?? a.weakest;
  const focusName = focus ? SUBJECT_NAME[focus.subject] : "";

  return (
    <section className="card score-analysis" id="analysis" aria-label="成绩分析">
      <h2 className="section-title">成绩分析</h2>
      <ul className="analysis-list">
        {a.weakest && (
          <li>
            当前最弱科目：<strong>{SUBJECT_NAME[a.weakest.subject]}</strong>
            （近 3 次平均 {a.weakest.avg3} 分）
          </li>
        )}
        {a.strongest && (
          <li>
            当前最强科目：<strong>{SUBJECT_NAME[a.strongest.subject]}</strong>
            （近 3 次平均 {a.strongest.avg3} 分）
          </li>
        )}
        {focus && (
          <li>
            距离目标差距最大：<strong>{focusName}</strong>，目标 {focus.target} 分，还差{" "}
            {focus.gap} 分
          </li>
        )}
        <li>
          最近是否在进步：
          {a.improving ? "是" : "否"}
          {a.count >= 2 && `（最近一次较近期平均 ${a.overallDelta >= 0 ? "+" : ""}${a.overallDelta} 分）`}
        </li>
        {a.declining.length > 0 && (
          <li>
            近期下降科目：
            {a.declining.map((id) => SUBJECT_NAME[id]).join("、")}
          </li>
        )}
      </ul>
      {focus && (
        <p className="analysis-advice">
          建议未来两周增加 <strong>{focusName}</strong> 学习时间。
        </p>
      )}
    </section>
  );
}
