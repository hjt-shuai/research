"use client";

import { useMemo, useState } from "react";
import ResourceCard from "./ResourceCard";
import ResourceForm from "./ResourceForm";
import SourceManager from "./SourceManager";
import { useLibrary } from "../useLibrary";
import { filterResources, libraryStats } from "@/lib/db/service";
import {
  CHECK_INTERVAL_LABEL,
  RESOURCE_CATEGORY_LABEL,
  RESOURCE_STATUS_LABEL,
  RESOURCE_SUBJECT_LABEL,
  SYNC_STATUS_LABEL,
  type ResourceCategory,
  type ResourceStatus,
  type ResourceSubject,
} from "@/lib/db/types";

const TABS: { id: string; label: string }[] = [
  { id: "ALL", label: "全部" },
  { id: "OFFICIAL", label: "官方" },
  { id: "MATH_1", label: "数学一" },
  { id: "ENGLISH_1", label: "英语一" },
  { id: "CS_408", label: "408" },
  { id: "POLITICS", label: "政治" },
  { id: "REAL_PAPER", label: "真题" },
  { id: "MOCK_PAPER", label: "模拟" },
  { id: "SCHOOL", label: "院校" },
  { id: "MY_UPLOAD", label: "我的资料" },
  { id: "FAVORITE", label: "收藏" },
];

const CATEGORIES = Object.keys(RESOURCE_CATEGORY_LABEL) as ResourceCategory[];
const SUBJECTS = Object.keys(RESOURCE_SUBJECT_LABEL) as ResourceSubject[];
const STATUSES = Object.keys(RESOURCE_STATUS_LABEL) as ResourceStatus[];
const YEARS = [2024, 2025, 2026, 2027, 2028];

function fmt(iso: string | null): string {
  if (!iso) return "从未同步";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ResourceCenter() {
  const { store, syncNow } = useLibrary();
  const [tab, setTab] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const [year, setYear] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [sourceId, setSourceId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => libraryStats(store), [store]);

  const list = useMemo(
    () =>
      filterResources(store.resources, store.sources, {
        tab: tab === "ALL" || tab === "FAVORITE" ? undefined : tab,
        favoritesOnly: tab === "FAVORITE",
        keyword,
        year: year ? Number(year) : "all",
        subject: (subject as ResourceSubject) || "all",
        category: (category as ResourceCategory) || "all",
        sourceId: sourceId || "all",
        status: (status as ResourceStatus) || "all",
      }),
    [store.resources, store.sources, tab, keyword, year, subject, category, sourceId, status],
  );

  const latest = useMemo(
    () =>
      [...store.resources]
        .filter((r) => r.status !== "REMOVED")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6),
    [store.resources],
  );

  const pendingCount = store.updateLog.filter((e) => e.confirmStatus === "PENDING").length;

  const checkOne = async (id: string) => {
    setBusy(true);
    const s = await syncNow({ trigger: "MANUAL", sourceIds: [id] });
    setBusy(false);
    setSyncMsg(
      `检查完成：${s.checked} 个来源，无变化 ${s.unchanged}，发现更新 ${s.changed}，失败 ${s.failed}。待确认 ${s.pendingCount} 条。`,
    );
  };

  return (
    <div className="sub-page">
      <div className="sub-page-head">
        <div>
          <h1 className="page-title-sm">📚 资料中心</h1>
          <p className="section-note" style={{ margin: 0 }}>
            官方信息、考试科目资料、真题、错题与「我的资料」统一入口。每条资料都记录来源、发布时间与最后检查时间。
          </p>
        </div>
        <div className="res-actions">
          <button type="button" className="ghost-btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "收起新增" : "＋ 新增资料"}
          </button>
          <button type="button" className="ghost-btn" onClick={() => setShowSources((v) => !v)}>
            {showSources ? "收起信息源" : "信息源管理器"}
          </button>
        </div>
      </div>

      <section className="card" aria-label="资料库概览">
        <div className="stat-grid">
          <div className="stat-tile">
            <span className="stat-label">资料总数</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">官方资料</span>
            <span className="stat-value">{stats.official}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">我的资料</span>
            <span className="stat-value">{stats.mine}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">待确认 / 草稿</span>
            <span className="stat-value">{stats.needReview}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">收藏</span>
            <span className="stat-value">{stats.favorites}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">上次同步</span>
            <span className="stat-value" style={{ fontSize: 14 }}>
              {fmt(store.syncState.lastRunAt)}
            </span>
          </div>
        </div>
        <p className="hint">
          来源 {store.sources.length} 个（启用 {store.sources.filter((s) => s.enabled).length} 个）· 待确认更新{" "}
          {pendingCount} 条 ·{" "}
          <a href="/updates">到更新中心查看</a>
        </p>
      </section>

      {showForm && <ResourceForm />}
      {showSources && <SourceManager onCheckOne={checkOne} />}

      <section aria-label="资料列表">
        <div className="res-actions" style={{ marginBottom: 12 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chip${tab === t.id ? " is-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="filter-bar">
          <label className="field field-grow">
            搜索
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="例如：408 操作系统"
              aria-label="搜索资料"
            />
          </label>
          <label className="field">
            年份
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">全部</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            科目
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">全部</option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {RESOURCE_SUBJECT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            资料类型
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">全部</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {RESOURCE_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            来源
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">全部</option>
              {store.sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sourceName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            状态
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">全部</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RESOURCE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setKeyword("");
              setYear("");
              setSubject("");
              setCategory("");
              setSourceId("");
              setStatus("");
              setTab("ALL");
            }}
          >
            清空筛选
          </button>
        </div>

        {syncMsg && <p className="backup-status">{syncMsg}</p>}
        {busy && <p className="hint">正在检查官网…</p>}

        <p className="hint">
          命中 {list.length} 条{tab === "ALL" ? "" : `（页签：${TABS.find((t) => t.id === tab)?.label}）`}
        </p>

        {list.length === 0 ? (
          <p className="empty-note">
            没有符合条件的资料。可以换关键词 / 清除筛选，或点「＋ 新增资料」登记一份。
          </p>
        ) : (
          <div className="res-grid">
            {list.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        )}
      </section>

      <section className="card" aria-label="最新更新">
        <h3 className="section-title">最新更新</h3>
        <ul className="intel-list">
          {latest.map((r) => (
            <li key={r.id} className={`intel-item${r.status === "NEED_REVIEW" ? " is-important" : ""}`}>
              <span className="badge is-year">{r.year ?? "通用"}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>{r.title}</strong>
                <div className="hint" style={{ marginTop: 2 }}>
                  {RESOURCE_CATEGORY_LABEL[r.category]} · v{r.version} ·{" "}
                  {store.sources.find((s) => s.id === r.sourceId)?.sourceName ?? "未标注来源"}
                </div>
              </span>
              <span className="intel-time">{fmt(r.updatedAt)}</span>
            </li>
          ))}
        </ul>
        <p className="hint">
          同步状态：{SYNC_STATUS_LABEL[store.syncState.results[Object.keys(store.syncState.results)[0] ?? ""]?.status ?? "IDLE"]} ·
          检查频率按来源独立配置（{CHECK_INTERVAL_LABEL.WEEKLY} / {CHECK_INTERVAL_LABEL.DAILY} / {CHECK_INTERVAL_LABEL.MANUAL}）
        </p>
      </section>
    </div>
  );
}
