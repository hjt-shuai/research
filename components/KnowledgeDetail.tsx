"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  KNOWLEDGE,
  defaultMastery,
  computeMastery,
  type KpNode,
} from "@/lib/knowledge";
import { linkedTaskProgress, taskIdsForKp, taskRef } from "@/lib/kpTasks";
import { SUBJECTS, type SubjectId } from "@/lib/plan";
import { monthPlanById } from "@/lib/progress";
import { SUBJECT_MAX, avg, sortByDateAsc } from "@/lib/scoring";
import { STUDY_STATUS_LABEL, type StudyStatus } from "@/lib/types";
import { useAppStore } from "./AppStoreProvider";

function KpEditor({
  node,
  hint,
  depth = 0,
}: {
  node: KpNode;
  hint: number | null;
  depth?: number;
}) {
  const { store, updateMastery, toggleTask } = useAppStore();
  const state = store.mastery[node.id] ?? defaultMastery();
  const linked = linkedTaskProgress(node.id, store.tasks);
  const pct = computeMastery(store.mastery[node.id], linked);

  if (node.children?.length) {
    return (
      <div className="kp-branch" style={{ marginLeft: depth ? 12 : 0 }}>
        <h3 className="kp-branch-title">{node.name}</h3>
        {node.children.map((c) => (
          <KpEditor key={c.id} node={c} hint={hint} depth={depth + 1} />
        ))}
      </div>
    );
  }

  const linkedTasks = taskIdsForKp(node.id)
    .map((id) => taskRef(id))
    .filter((t): t is NonNullable<ReturnType<typeof taskRef>> => t !== null);

  return (
    <div className="kp-leaf card-inner">
      <div className="kp-leaf-head">
        <strong>{node.name}</strong>
        <span className="mastery-row-pct">{pct}%</span>
      </div>

      <div className="kp-meta">
        <span>
          任务完成度：
          {linked.total
            ? `${linked.done}/${linked.total}（${Math.round((linked.ratio ?? 0) * 100)}%）`
            : "无关联任务"}
        </span>
        <span>学习状态：{STUDY_STATUS_LABEL[state.status]}</span>
        <span>正确率：{state.accuracy == null ? "未填" : `${state.accuracy}%`}</span>
      </div>

      <div className="kp-controls">
        <label>
          学习状态
          <select
            value={state.status}
            onChange={(e) =>
              updateMastery(node.id, {
                status: e.target.value as StudyStatus,
              })
            }
          >
            {(Object.keys(STUDY_STATUS_LABEL) as StudyStatus[]).map((k) => (
              <option key={k} value={k}>
                {STUDY_STATUS_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="kp-check">
          <input
            type="checkbox"
            checked={state.taskDone}
            onChange={(e) =>
              updateMastery(node.id, { taskDone: e.target.checked })
            }
          />
          任务已完成
        </label>
        <label className="kp-accuracy">
          正确率 %
          <input
            type="number"
            min={0}
            max={100}
            placeholder="可选"
            value={state.accuracy ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              updateMastery(node.id, {
                accuracy: v === "" ? null : Number(v),
              });
            }}
          />
          {hint != null && (
            <button
              type="button"
              className="ghost-btn tiny"
              onClick={() => updateMastery(node.id, { accuracy: hint })}
            >
              按模考得分率填 {hint}%
            </button>
          )}
        </label>
        <label className="kp-check">
          <input
            type="checkbox"
            checked={state.weak}
            onChange={(e) =>
              updateMastery(node.id, { weak: e.target.checked })
            }
          />
          标记为薄弱
        </label>
      </div>

      {linkedTasks.length > 0 && (
        <details className="kp-linked">
          <summary>
            关联月度任务 {linked.done}/{linked.total}（勾选即计入掌握度）
          </summary>
          <ul className="kp-linked-list">
            {linkedTasks.map((t) => (
              <li key={t.id}>
                <label className={`task${store.tasks[t.id] ? " done" : ""}`}>
                  <input
                    type="checkbox"
                    checked={!!store.tasks[t.id]}
                    onChange={() => toggleTask(t.id)}
                  />
                  <span className="kp-task-month">
                    {monthPlanById(t.monthId)?.label ?? t.monthId}
                  </span>
                  <span className="task-text">{t.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function KnowledgeDetail() {
  const { store } = useAppStore();
  const params = useSearchParams();
  const subject = (params.get("subject") as SubjectId) || "cs408";
  const valid = SUBJECTS.some((s) => s.id === subject);
  const active = valid ? subject : "cs408";
  const nodes = KNOWLEDGE[active];

  const sorted = sortByDateAsc(store.mocks);
  const recent = sorted.slice(-3);
  const hint = recent.length
    ? Math.round(
        (avg(recent.map((m) => m[active])) / SUBJECT_MAX[active]) * 100,
      )
    : null;

  return (
    <div className="sub-page">
      <p className="eyebrow">
        <Link href="/">← 返回首页</Link>
      </p>
      <h1 className="page-title">知识掌握度详情</h1>
      <div className="subject-tabs">
        {SUBJECTS.map((s) => (
          <Link
            key={s.id}
            href={`/knowledge?subject=${s.id}`}
            className={active === s.id ? "is-active" : ""}
          >
            {s.short}
          </Link>
        ))}
      </div>
      <section className="card">
        <p className="section-note">
          掌握度 = 任务完成度 40% + 学习状态 30% + 正确率 30%（未填正确率时按 任务/状态
          各 50% 计算）。勾选月度任务会自动计入对应知识点。
        </p>
        {active === "cs408" && (
          <p className="hint kp-tree-hint">
            408：数据结构 · 组成原理 · 操作系统 · 计算机网络
          </p>
        )}
        {nodes.map((n) => (
          <KpEditor key={n.id} node={n} hint={hint} />
        ))}
      </section>
    </div>
  );
}
