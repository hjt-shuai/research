"use client";

import { useState } from "react";
import { useLibrary } from "../useLibrary";
import { versionsOf, promotionGuard } from "@/lib/db/service";
import { ALL_TASKS } from "@/lib/progress";
import {
  RESOURCE_CATEGORY_LABEL,
  RESOURCE_STATUS_LABEL,
  SOURCE_TYPE_LABEL,
  FACT_ORIGIN_LABEL,
  type Resource,
  type ResourceStatus,
} from "@/lib/db/types";

const STATUS_CLASS: Record<ResourceStatus, string> = {
  CURRENT: "is-current",
  NEED_REVIEW: "is-review",
  DRAFT: "is-draft",
  ARCHIVED: "is-archived",
  EXPIRED: "is-expired",
  REMOVED: "is-removed",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "未检查";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ResourceCard({
  resource,
  compact = false,
}: {
  resource: Resource;
  compact?: boolean;
}) {
  const {
    store,
    toggleFavorite,
    promoteResource,
    archiveResource,
    deleteResource,
    restoreResource,
    openUserFile,
    bindResource,
  } = useLibrary();
  const [open, setOpen] = useState(false);
  const [bindOpen, setBindOpen] = useState(false);

  const source = store.sources.find((s) => s.id === resource.sourceId) ?? null;
  const versions = versionsOf(store, resource.id);
  const isFile = !!resource.filePath;
  const guard = promotionGuard(resource);

  const openSource = async () => {
    if (isFile) {
      const ok = await openUserFile(resource.id);
      if (!ok) window.alert("该文件未保存在本机（只登记了元数据），无法打开。");
      return;
    }
    if (resource.sourceUrl) window.open(resource.sourceUrl, "_blank", "noopener,noreferrer");
  };

  const bindableTasks = Object.keys(store.taskResources).length;

  return (
    <article className={`card res-card${compact ? " is-compact" : ""}`}>
      <header className="res-card-head">
        <div className="res-card-title-row">
          <h3 className="res-card-title">{resource.title}</h3>
        </div>
        <div className="res-badges">
          <span className={`badge ${STATUS_CLASS[resource.status]}`}>
            {RESOURCE_STATUS_LABEL[resource.status]}
          </span>
          <span className={`badge ${resource.isOfficial ? "is-official" : "is-mine"}`}>
            {resource.isOfficial ? "官方" : "我的资料"}
          </span>
          {resource.year != null && <span className="badge is-year">{resource.year}</span>}
        </div>
      </header>

      <p className="res-card-sub">
        {RESOURCE_CATEGORY_LABEL[resource.category]}
        {resource.majorCode ? ` · ${resource.majorCode}` : ""}
        {resource.version > 1 ? ` · v${resource.version}` : ""}
        {isFile ? " · 本地文件" : ""}
      </p>

      {resource.description && <p className="res-card-desc">{resource.description}</p>}

      <dl className="res-meta">
        <div>
          <dt>来源</dt>
          <dd>{source ? source.sourceName : isFile ? "我的资料（本机）" : "未标注来源"}</dd>
        </div>
        <div>
          <dt>来源类型</dt>
          <dd>
            {source ? (
              <span className={`src-type ${resource.isOfficial ? "is-official" : "is-third"}`}>
                {SOURCE_TYPE_LABEL[source.sourceType]}
              </span>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt>发布时间</dt>
          <dd>{fmtDate(resource.publishedAt)}</dd>
        </div>
        <div>
          <dt>最后检查</dt>
          <dd>{source ? fmtTime(source.lastCheckedAt) : "不参与自动更新"}</dd>
        </div>
      </dl>

      <div className="res-actions">
        <button type="button" className="ghost-btn" onClick={() => setOpen((o) => !o)}>
          {open ? "收起" : "查看"}
        </button>
        {resource.sourceUrl || isFile ? (
          <button type="button" className="ghost-btn" onClick={openSource}>
            打开来源
          </button>
        ) : (
          <button type="button" className="ghost-btn" disabled title="该资料没有登记链接">
            打开来源
          </button>
        )}
        <button type="button" className="ghost-btn" onClick={() => setOpen(true)}>
          历史版本（{versions.length}）
        </button>
        <button
          type="button"
          className={`ghost-btn${resource.favorite ? " is-active" : ""}`}
          onClick={() => toggleFavorite(resource.id)}
        >
          {resource.favorite ? "★ 已收藏" : "☆ 标记收藏"}
        </button>
      </div>

      {open && (
        <div className="res-detail">
          {resource.facts.length > 0 && (
            <div className="res-facts">
              <h4 className="res-detail-title">关键信息（每条都可追溯来源）</h4>
              <ul>
                {resource.facts.map((f, i) => (
                  <li key={`${f.key}-${i}`}>
                    <span className="fact-key">{f.key}</span>
                    <span className="fact-value">{f.value || "暂无官方数据"}</span>
                    <span className={`fact-from is-${f.from.toLowerCase()}`}>{FACT_ORIGIN_LABEL[f.from]}</span>
                    {f.note && <span className="fact-note">{f.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {source && (
            <div className="res-source-box">
              <h4 className="res-detail-title">来源信息</h4>
              <ul className="res-source-list">
                <li>来源：{source.sourceName}（{SOURCE_TYPE_LABEL[source.sourceType]}）</li>
                <li>原始链接：{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.url}</a> : "—"}</li>
                <li>官方域名：{source.officialDomain || "—"}</li>
                <li>
                  状态：
                  {source.lastError ? ` ⚠ 最近一次检查失败：${source.lastError}` : " ✔ 最近一次检查正常"}
                </li>
                <li>最后成功：{fmtTime(source.lastSuccessAt)}</li>
                {source.lastFinalDomain && source.lastFinalDomain !== source.officialDomain && (
                  <li className="warn-line">
                    ⚠ 实际落点域名 {source.lastFinalDomain} 与官方域名不一致，请人工核对
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="res-versions">
            <h4 className="res-detail-title">历史版本（旧版本永不被删除）</h4>
            <ol className="ver-list">
              {versions.map((v) => (
                <li key={v.id} className={v.id === resource.currentVersionId ? "is-current" : ""}>
                  <div className="ver-head">
                    <strong>v{v.version}</strong>
                    <span className="ver-type">
                      {v.changeType === "CREATED"
                        ? "创建"
                        : v.changeType === "SYNC_DETECTED"
                          ? "自动检测"
                          : v.changeType === "STATUS_CHANGE"
                            ? "状态变更"
                            : "手动编辑"}
                    </span>
                    <span className="ver-time">{fmtTime(v.createdAt)}</span>
                    {v.id === resource.currentVersionId && <span className="badge is-current">当前</span>}
                  </div>
                  <ul className="ver-changes">
                    {v.changeSummary.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                  <p className="ver-src">
                    来源链接：{v.sourceUrl ? <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer">{v.sourceUrl.slice(0, 60)}</a> : "—"}
                    {v.publishedAt ? ` · 发布时间 ${v.publishedAt}` : ""}
                    {v.contentHash ? ` · hash ${v.contentHash.slice(0, 10)}` : ""}
                  </p>
                  {v.id !== resource.currentVersionId && (
                    <button
                      type="button"
                      className="ghost-btn tiny"
                      onClick={() => {
                        if (window.confirm(`把 v${v.version} 设为当前版本？\n\n同分类的官方旧版本会自动转为「已归档」，历史记录不会删除。`)) {
                          promoteResource(resource.id);
                        }
                      }}
                    >
                      设为当前版本
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="res-manage">
            <h4 className="res-detail-title">管理</h4>
            {!guard.allowed && <p className="hint warn-line">🔒 {guard.reason}</p>}
            <div className="res-actions">
              {resource.status !== "CURRENT" && (
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={!guard.allowed}
                  title={guard.allowed ? "" : guard.reason}
                  onClick={() => {
                    if (window.confirm(`把「${resource.title}」设为当前有效版本？`)) promoteResource(resource.id);
                  }}
                >
                  设为当前有效
                </button>
              )}
              {resource.status === "CURRENT" && (
                <button type="button" className="ghost-btn" onClick={() => archiveResource(resource.id)}>
                  归档
                </button>
              )}
              {resource.status === "REMOVED" ? (
                <button type="button" className="ghost-btn" onClick={() => restoreResource(resource.id)}>
                  恢复资料
                </button>
              ) : (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    if (
                      window.confirm(
                        `删除「${resource.title}」？\n\n只把状态改成「已删除」，历史版本与元数据全部保留，可随时恢复。`,
                      )
                    ) {
                      deleteResource(resource.id);
                    }
                  }}
                >
                  删除资料
                </button>
              )}
              <button type="button" className="ghost-btn" onClick={() => setBindOpen((b) => !b)}>
                绑定到月度任务
              </button>
            </div>

            {bindOpen && (
              <div className="res-bind">
                <p className="hint">
                  选择要绑定该资料的月度任务（绑定后可在月度任务的「开始学习」里直接打开）。
                  {bindableTasks === 0 ? " 目前还没有任何绑定记录。" : ""}
                </p>
                <TaskBindPicker resourceId={resource.id} onDone={() => setBindOpen(false)} bind={bindResource} />
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function TaskBindPicker({
  resourceId,
  onDone,
  bind,
}: {
  resourceId: string;
  onDone: () => void;
  bind: (taskId: string, resourceId: string) => void;
}) {
  const [taskId, setTaskId] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const months = [...new Set(ALL_TASKS.map((t) => t.monthId))].sort();
  const tasks = ALL_TASKS.filter((t) => !monthFilter || t.monthId === monthFilter);

  return (
    <div className="res-bind-row">
      <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} aria-label="选择月份">
        <option value="">全部月份</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select value={taskId} onChange={(e) => setTaskId(e.target.value)} aria-label="选择月度任务">
        <option value="">选择月度任务…</option>
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.monthId} · {t.text.slice(0, 32)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="primary-btn"
        disabled={!taskId}
        onClick={() => {
          if (taskId) {
            bind(taskId, resourceId);
            onDone();
          }
        }}
      >
        绑定
      </button>
    </div>
  );
}

export { fmtDate, fmtTime };
