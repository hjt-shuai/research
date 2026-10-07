"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLibrary } from "./useLibrary";
import { dueSources, isPeakSeason, seasonNote } from "@/lib/db/syncService";
import { useLocalStorage } from "@/lib/useLocalStorage";

function fmt(iso: string | null): string {
  if (!iso) return "尚未同步";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 首页「资料同步中心」简卡（§8） */
export default function SyncCenterCard() {
  const { store, syncNow, simulate } = useLibrary();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showLog, setShowLog] = useState(false);
  const { value: autoSync } = useLocalStorage<boolean>("kaoyan.autoSync", false);
  const [autoRan, setAutoRan] = useState(false);

  const due = dueSources(store);
  const results = Object.values(store.syncState.results);
  const lastRun = store.syncState.lastRunAt;
  const lastRunResults = results.filter((r) => lastRun && r.checkedAt === lastRun);
  const failed = lastRunResults.filter((r) => r.status === "FAILED").length;
  const changed = lastRunResults.filter((r) => r.status === "CHANGED").length;
  const pending = store.updateLog.filter((e) => e.confirmStatus === "PENDING").length;

  const run = async () => {
    setBusy(true);
    setMsg("");
    const s = await syncNow({ trigger: "MANUAL", onlyDue: false });
    setBusy(false);
    setMsg(
      `已检查 ${s.checked} 个来源：无变化 ${s.unchanged}，发现更新 ${s.changed}，失败 ${s.failed}，待确认 ${s.pendingCount} 条。`,
    );
  };

  // 打开页面时自动检查（仅在用户开启开关时，且每会话只跑一次）
  useEffect(() => {
    if (!autoSync || autoRan) return;
    if (!due.length) return;
    setAutoRan(true);
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync, autoRan, due.length]);

  return (
    <section className={`card${isPeakSeason() ? " is-current" : ""}`} aria-label="资料同步中心">
      <div className="section-head-row">
        <h2 className="section-title">资料同步中心</h2>
        <Link className="text-link" href="/updates">
          更新中心 →
        </Link>
      </div>
      <p className="section-note" style={{ marginTop: -6 }}>
        数字为最近一次同步的结果；「发现更新」显示的是累计待确认条数。
      </p>

      <div className="sync-grid">
        <div className="stat-tile">
          <span className="stat-label">上次同步</span>
          <span className="stat-value" style={{ fontSize: 14 }}>
            {fmt(store.syncState.lastRunAt)}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">同步状态</span>
          <span className="stat-value" style={{ fontSize: 16 }}>
            {busy ? "同步中…" : failed > 0 ? "⚠ 有失败" : lastRun ? "正常" : "尚未同步"}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">待检查</span>
          <span className="stat-value">{due.length}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">发现更新</span>
          <span className="stat-value">{changed || pending}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">同步失败</span>
          <span className="stat-value">{failed}</span>
        </div>
      </div>

      <div className="res-actions">
        <button type="button" className="primary-btn" disabled={busy} onClick={run}>
          {busy ? "检查中…" : "立即检查更新"}
        </button>
        <button type="button" className="ghost-btn" disabled={busy} onClick={run}>
          同步全部
        </button>
        <button type="button" className="ghost-btn" onClick={() => setShowLog((v) => !v)}>
          {showLog ? "收起更新记录" : "查看更新记录"}
        </button>
        <button
          type="button"
          className="ghost-btn"
          disabled={busy}
          title="不联网，验证「检测 → 新版本 → 待确认」链路"
          onClick={() => {
            const s = simulate("year-opened");
            setMsg(`【模拟】已演示「官网新开放 2028 招生目录」：待确认 ${s.pendingCount} 条，去更新中心处理。`);
          }}
        >
          模拟检测（演示）
        </button>
      </div>

      {msg && <p className="backup-status">{msg}</p>}
      {!msg && <p className="hint">{seasonNote()}</p>}

      {showLog && (
        <ul className="intel-list" style={{ marginTop: 10 }}>
          {store.updateLog.length === 0 && <li className="empty-note">还没有更新记录。</li>}
          {[...store.updateLog]
            .reverse()
            .slice(0, 8)
            .map((e) => (
              <li
                key={e.id}
                className={`intel-item${e.severity === "CRITICAL" ? " is-critical" : e.severity === "IMPORTANT" ? " is-important" : ""}`}
              >
                <span className="badge is-year">{e.trigger === "SIMULATE" ? "模拟" : "自动"}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{e.title}</strong>
                  <div className="hint">{e.changes[0] ?? ""}</div>
                </span>
                <span className="intel-time">{fmt(e.at)}</span>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
