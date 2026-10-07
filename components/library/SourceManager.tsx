"use client";

import { useState } from "react";
import { useLibrary } from "../useLibrary";
import {
  CHECK_INTERVAL_LABEL,
  SOURCE_TIER,
  SOURCE_TYPE_LABEL,
  SYNC_STATUS_LABEL,
  type CheckInterval,
  type SourceType,
} from "@/lib/db/types";

const TYPES = Object.keys(SOURCE_TYPE_LABEL) as SourceType[];
const INTERVALS = Object.keys(CHECK_INTERVAL_LABEL) as CheckInterval[];

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const STATUS_CLASS: Record<string, string> = {
  OK: "is-current",
  NOT_MODIFIED: "is-current",
  CHANGED: "is-review",
  FAILED: "is-review",
  IDLE: "is-draft",
  SKIPPED: "is-draft",
};

/** 信息源管理器：官方来源清单 + 检查频率 + 同步状态（§3/§4/§23/§37） */
export default function SourceManager({ onCheckOne }: { onCheckOne: (sourceId: string) => void }) {
  const { store, addSource, updateSource, removeSource, restoreSeedsAction } = useLibrary();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<SourceType>("OFFICIAL_ADMISSION");
  const [interval, setInterval] = useState<CheckInterval>("WEEKLY");
  const [schoolId, setSchoolId] = useState("");
  const [msg, setMsg] = useState("");

  const add = () => {
    if (!name.trim() || !url.trim()) {
      setMsg("请填写来源名称与网址。");
      return;
    }
    if (!/^https?:\/\//i.test(url.trim())) {
      setMsg("网址需要以 http:// 或 https:// 开头。");
      return;
    }
    addSource({
      sourceName: name,
      url,
      sourceType: type,
      checkInterval: interval,
      schoolId,
      kind: "DOC_LIST",
    });
    setName("");
    setUrl("");
    setMsg("已添加来源。可以点「立即检查」验证能否正常抓取。");
  };

  return (
    <section className="card" aria-label="信息源管理器">
      <div className="section-head-row">
        <h3 className="section-title">信息源管理器</h3>
        <div className="res-actions">
          <button type="button" className="ghost-btn" onClick={() => setOpen((o) => !o)}>
            {open ? "收起新增" : "＋ 添加来源"}
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              if (window.confirm("恢复内置信息源与院校档案？\n\n只会补齐缺失项，已有数据不会被覆盖。")) {
                restoreSeedsAction();
                setMsg("已恢复内置信息源 / 院校档案（未覆盖你已有数据）。");
              }
            }}
          >
            恢复内置来源
          </button>
        </div>
      </div>

      <p className="section-note">
        可信度优先级：招生单位官方招生网（1）＞ 学院官方页面（2）＞ 研招网（3）＞ 教育部（4）＞
        出版社 / 课程（5）＞ 其他（6）。低优先级来源不能覆盖高优先级来源。
      </p>

      {open && (
        <div className="filter-bar">
          <label className="field field-grow">
            来源名称
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：某大学研究生招生网" />
          </label>
          <label className="field field-grow">
            网址
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </label>
          <label className="field">
            来源类型
            <select value={type} onChange={(e) => setType(e.target.value as SourceType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {SOURCE_TYPE_LABEL[t]}（优先级 {SOURCE_TIER[t]}）
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            检查频率
            <select value={interval} onChange={(e) => setInterval(e.target.value as CheckInterval)}>
              {INTERVALS.map((i) => (
                <option key={i} value={i}>
                  {CHECK_INTERVAL_LABEL[i]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            归属学校
            <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              <option value="">不限 / 全国性</option>
              {store.schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="primary-btn" onClick={add}>
            添加
          </button>
        </div>
      )}

      {msg && <p className="backup-status">{msg}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>来源</th>
              <th>类型 / 优先级</th>
              <th>官方域名</th>
              <th>频率</th>
              <th>状态</th>
              <th>最后检查</th>
              <th>最后成功</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {store.sources.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.sourceName}</strong>
                  <div className="hint" style={{ marginTop: 2 }}>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.url.length > 46 ? `${s.url.slice(0, 46)}…` : s.url}
                      </a>
                    ) : (
                      "无链接（本地 / 手动登记）"
                    )}
                  </div>
                  {s.lastTitle && <div className="hint">最近标题：{s.lastTitle.slice(0, 40)}</div>}
                  {s.lastError && <div className="hint warn-line">⚠ {s.lastError.slice(0, 80)}</div>}
                  {s.lastFinalDomain && s.officialDomain && s.lastFinalDomain !== s.officialDomain && (
                    <div className="hint warn-line">
                      ⚠ 实际落点 {s.lastFinalDomain} ≠ 官方域名 {s.officialDomain}
                    </div>
                  )}
                </td>
                <td>
                  {SOURCE_TYPE_LABEL[s.sourceType]}
                  <div className="pill">优先级 {SOURCE_TIER[s.sourceType]}</div>
                </td>
                <td>
                  {s.officialDomain || "—"}
                  {s.year != null && <div className="hint">{s.year} 年目录</div>}
                </td>
                <td>
                  <select
                    value={s.checkInterval}
                    onChange={(e) => updateSource(s.id, { checkInterval: e.target.value as CheckInterval })}
                    aria-label={`${s.sourceName} 检查频率`}
                  >
                    {INTERVALS.map((i) => (
                      <option key={i} value={i}>
                        {CHECK_INTERVAL_LABEL[i]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className={`badge ${STATUS_CLASS[s.syncStatus] ?? "is-draft"}`}>
                    {SYNC_STATUS_LABEL[s.syncStatus]}
                  </span>
                  <div className="hint">{s.lastDocCount != null ? `${s.lastDocCount} 条条目` : ""}</div>
                </td>
                <td>{fmt(s.lastCheckedAt)}</td>
                <td>{fmt(s.lastSuccessAt)}</td>
                <td>
                  <div className="res-actions">
                    <button
                      type="button"
                      className="ghost-btn tiny"
                      disabled={!s.url}
                      onClick={() => onCheckOne(s.id)}
                    >
                      立即检查
                    </button>
                    <label className="kp-check" style={{ marginTop: 0, fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={(e) => updateSource(s.id, { enabled: e.target.checked })}
                      />
                      启用
                    </label>
                    {!s.isSeed && (
                      <button
                        type="button"
                        className="ghost-btn tiny"
                        onClick={() => {
                          if (window.confirm(`删除来源「${s.sourceName}」？已收录的资料不会被删除。`)) removeSource(s.id);
                        }}
                      >
                        删除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        共 {store.sources.length} 个来源，其中 {store.sources.filter((s) => s.enabled).length} 个已启用。
        招生季（9–12 月）会自动切换为高频同步；学院官网可能有安全策略，抓取失败时会保留上一次成功数据。
      </p>
    </section>
  );
}
