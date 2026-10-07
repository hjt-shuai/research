"use client";

import { useState } from "react";
import { useLibrary } from "./useLibrary";
import { resourcesOfTask } from "@/lib/db/service";
import { ALL_TASKS } from "@/lib/progress";
import { RESOURCE_CATEGORY_LABEL, type Resource } from "@/lib/db/types";

/**
 * 月度任务 ↔ 资料绑定（§30）。
 * 任务上直接显示已绑定的资料，并提供「开始学习」直接打开对应资料。
 */
export default function TaskResources({ taskId }: { taskId: string }) {
  const { store, bindResource, unbindResource, openUserFile } = useLibrary();
  const [open, setOpen] = useState(false);

  const bound = resourcesOfTask(store, taskId);
  const task = ALL_TASKS.find((t) => t.id === taskId);
  const subject = task?.subject ?? null;

  const candidates = store.resources
    .filter((r) => r.status !== "REMOVED")
    .filter((r) => !subject || r.subject === subject || r.subject === "official" || r.subject === "general")
    .sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial))
    .slice(0, 40);

  const startStudy = async (r: Resource) => {
    if (r.filePath) {
      const ok = await openUserFile(r.id);
      if (!ok) window.alert("该资料没有保存在本机的文件，可在资料中心查看详情。");
      return;
    }
    if (r.sourceUrl) {
      window.open(r.sourceUrl, "_blank", "noopener,noreferrer");
      return;
    }
    window.alert(`「${r.title}」还没有登记链接或文件，可在资料中心补充。`);
  };

  return (
    <div className="task-res">
      <div className="task-res-row">
        {bound.length === 0 && <span className="hint">未绑定资料</span>}
        {bound.map((r) => (
          <button
            key={r.id}
            type="button"
            className="chip"
            title={`${RESOURCE_CATEGORY_LABEL[r.category]}${r.sourceUrl ? ` · ${r.sourceUrl}` : ""}`}
            onClick={() => startStudy(r)}
          >
            {r.isOfficial ? "官方 · " : ""}
            {r.title.length > 18 ? `${r.title.slice(0, 18)}…` : r.title}
          </button>
        ))}
        {bound.length > 0 && (
          <button type="button" className="ghost-btn tiny" onClick={() => startStudy(bound[0])}>
            开始学习
          </button>
        )}
        <button type="button" className="ghost-btn tiny" onClick={() => setOpen((o) => !o)}>
          {open ? "收起" : "＋ 绑定资料"}
        </button>
      </div>

      {open && (
        <div className="task-res-picker">
          {candidates.length === 0 ? (
            <p className="hint">资料中心还没有这个科目的资料，先去 /resources 添加或上传。</p>
          ) : (
            <ul>
              {candidates.map((r) => {
                const isBound = bound.some((b) => b.id === r.id);
                return (
                  <li key={r.id}>
                    <label className="task kp-check" style={{ marginTop: 0 }}>
                      <input
                        type="checkbox"
                        checked={isBound}
                        onChange={() => (isBound ? unbindResource(taskId, r.id) : bindResource(taskId, r.id))}
                      />
                      <span className="task-text">
                        {r.isOfficial ? "[官方] " : ""}
                        {r.title}
                        <span className="hint"> · {RESOURCE_CATEGORY_LABEL[r.category]}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
