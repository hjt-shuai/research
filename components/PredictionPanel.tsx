"use client";

import {
  MAIN_TARGET,
  TARGET_TIERS,
  predictionFrom,
} from "@/lib/scoring";
import { useAppStore } from "./AppStoreProvider";

const SPRINT = TARGET_TIERS.find((t) => t.key === "sprint")!.value;

export default function PredictionPanel() {
  const { store } = useAppStore();
  const { value: prediction, count } = predictionFrom(store.mocks);

  if (prediction == null || count === 0) {
    return (
      <section className="card prediction-panel" aria-label="当前预测分">
        <p className="eyebrow">当前预测分</p>
        <p className="prediction-empty">暂无</p>
        <p className="hint">完成至少一次完整模考后，将基于近 3 次总分平均自动计算。</p>
      </section>
    );
  }

  const gap = prediction - MAIN_TARGET;
  const gapLabel = gap >= 0 ? `+${gap}` : String(gap);
  let status = "继续强化";
  if (prediction >= SPRINT) status = "达到冲刺目标";
  else if (prediction >= MAIN_TARGET) status = "已达到主目标";

  return (
    <section className="card prediction-panel" aria-label="当前预测分">
      <div className="prediction-head">
        <div>
          <p className="eyebrow">当前预测分</p>
          <p className="prediction-value">{prediction}</p>
        </div>
        <div className="prediction-meta">
          <p>
            距离主目标：<strong>{gapLabel}</strong>
          </p>
          <p className="prediction-status">{status}</p>
        </div>
      </div>
      <p className="hint">基于最近 {Math.min(count, 3)} 次模考总分平均 · 共 {count} 次记录</p>
    </section>
  );
}
