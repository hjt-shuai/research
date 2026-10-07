"use client";

import { useState } from "react";
import { SUBJECTS, type SubjectId } from "@/lib/plan";
import {
  DEFAULT_GOALS,
  MAIN_TARGET,
  SUBJECT_MAX,
  TARGET_TIERS,
  clampGoal,
  goalsTotal,
} from "@/lib/scoring";
import { useAppStore } from "./AppStoreProvider";

export default function GoalsDashboard() {
  const { store, setGoals } = useAppStore();
  const goals = store.goals ?? DEFAULT_GOALS;
  const [editing, setEditing] = useState(false);

  const total = goalsTotal(goals);
  const diff = total - MAIN_TARGET;

  const update = (id: SubjectId, raw: string) => {
    setGoals({ ...goals, [id]: clampGoal(id, raw === "" ? 0 : raw) });
  };

  return (
    <section className="card goals-dashboard" aria-label="目标分数">
      <div className="section-head-row">
        <p className="eyebrow">目标总分</p>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setEditing((e) => !e)}
        >
          {editing ? "完成编辑" : "修改目标"}
        </button>
      </div>

      <div className="goals-hero">
        <span className="metric-hero">{MAIN_TARGET}+</span>
        <span className="goals-hero-sub">分 · 主目标口径</span>
      </div>

      <div className="tier-row">
        {TARGET_TIERS.map((t) => (
          <div
            key={t.key}
            className={`tier-chip${t.value === MAIN_TARGET ? " is-main" : ""}`}
          >
            <span className="tier-label">{t.label}</span>
            <span className="tier-value">{t.value}+</span>
          </div>
        ))}
      </div>

      <div className="subject-goals-grid">
        {SUBJECTS.map((s) => (
          <div className="subject-goal-card" key={s.id}>
            <span className="subject-dot" style={{ background: s.color }} />
            <div className="subject-goal-body">
              <p className="subject-goal-name">{s.short}</p>
              {editing ? (
                <label className="goal-input-wrap">
                  <input
                    type="number"
                    className="goal-input"
                    min={0}
                    max={SUBJECT_MAX[s.id]}
                    step={1}
                    value={goals[s.id] === 0 ? "" : goals[s.id]}
                    placeholder="0"
                    aria-label={`${s.name}目标分`}
                    onChange={(e) => update(s.id, e.target.value)}
                  />
                  <span className="goal-input-max">/ {SUBJECT_MAX[s.id]}</span>
                </label>
              ) : (
                <p className="subject-goal-score">
                  {goals[s.id]}
                  <span> / {SUBJECT_MAX[s.id]}</span>
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="goals-total">
        四科目标合计 <strong>{total}</strong> 分
        {diff === 0
          ? "（与主目标 375 一致）"
          : `（与主目标 375 相差 ${diff > 0 ? "+" : ""}${diff}）`}
      </p>

      {editing && (
        <div className="goals-edit-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setGoals({ ...DEFAULT_GOALS })}
          >
            恢复建议目标（70 / 70 / 120 / 115）
          </button>
          <span className="hint">
            目标分只影响差值、完成度与建议，不会改动已有的任务与模考记录。
          </span>
        </div>
      )}
    </section>
  );
}
