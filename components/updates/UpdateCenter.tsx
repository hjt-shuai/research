"use client";

import { useMemo, useState } from "react";
import { useLibrary } from "../useLibrary";
import { canConfirm, pendingUpdates } from "@/lib/db/service";
import { SIM_SCENARIOS, isPeakSeason, seasonNote, type SimScenario } from "@/lib/db/syncService";
import { useLocalStorage } from "@/lib/useLocalStorage";
import {
  CHANGE_TYPE_LABEL,
  CONFIRM_STATUS_LABEL,
  RESOURCE_CATEGORY_LABEL,
  SYNC_STATUS_LABEL,
  type UpdateEntry,
} from "@/lib/db/types";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const SEV_CLASS: Record<UpdateEntry["severity"], string> = {
  INFO: "",
  IMPORTANT: " is-important",
  CRITICAL: " is-critical",
};

/** 更新中心：同步中心 + 更新日志 + 待确认处理（§8/§9/§24/§25/§39） */
export default function UpdateCenter() {
  const { store, syncNow, simulate, confirmUpdate, rejectUpdate } = useLibrary();
  const [busy, setBusy] = useState<null | "CHECK" | "ALL" | "SIM">(null);
  const [msg, setMsg] = useState("");
  const [showLog, setShowLog] = useState(true);
  const { value: autoSync, setValue: setAutoSync } = useLocalStorage<boolean>("kaoyan.autoSync", false);

  const pending = useMemo(() => pendingUpdates(store), [store]);

  const results = Object.values(store.syncState.results);
  const lastRun = store.syncState.lastRunAt;
  const lastRunResults = results.filter((r) => lastRun && r.checkedAt === lastRun);
  const failed = lastRunResults.filter((r) => r.status === "FAILED").length;
  const changed = lastRunResults.filter((r) => r.status === "CHANGED").length;
  const unchanged = lastRunResults.filter((r) => r.status === "OK" || r.status === "NOT_MODIFIED").length;
  const dueCount = store.sources.filter((s) => s.enabled && s.url && s.kind !== "MANUAL").length;
  const overallStatus = busy
    ? "同步中…"
    : failed > 0
      ? "⚠ 部分来源检查失败"
      : lastRun
        ? "正常"
        : "尚未同步";

  const runCheck = async (mode: "CHECK" | "ALL") => {
    setBusy(mode);
    setMsg("");
    try {
      const s = await syncNow(
        mode === "CHECK" ? { trigger: "MANUAL", onlyDue: false } : { trigger: "MANUAL", onlyDue: false },
      );
      setMsg(
        `${mode === "CHECK" ? "检查" : "同步"}完成：${s.checked} 个来源 · 无变化 ${s.unchanged} · 发现更新 ${s.changed}${
          s.opened ? `（含新开放 ${s.opened} 个年度目录）` : ""
        } · 失败 ${s.failed} · 待确认 ${s.pendingCount} 条。\n关键约束：本次没有覆盖任何「当前有效」的正式信息，变化都停在「待确认」。`,
      );
    } catch (e) {
      setMsg(`同步出错：${(e as Error).message}。本地数据未做任何修改。`);
    } finally {
      setBusy(null);
    }
  };

  const runSim = (scenario: SimScenario) => {
    setBusy("SIM");
    const s = simulate(scenario);
    setBusy(null);
    setMsg(
      `【模拟】场景「${scenario}」完成：待确认 ${s.pendingCount} 条。所有模拟产物都标注了【模拟】，不会写入任何编造的招生数据。`,
    );
  };

  return (
    <div className="sub-page">
      <div className="sub-page-head">
        <div>
          <h1 className="page-title-sm">⚠ 更新中心</h1>
          <p className="section-note" style={{ margin: 0 }}>
            自动同步只做「检查 + 建新版本 + 标记待确认」，永远不会直接覆盖「当前有效」的正式信息。
          </p>
        </div>
      </div>

      <section className={`card${isPeakSeason() ? " is-current" : ""}`} aria-label="资料同步中心">
        <div className="section-head-row">
          <h3 className="section-title">资料同步中心</h3>
          <span className={`badge ${failed > 0 ? "is-review" : "is-current"}`}>{overallStatus}</span>
        </div>
        <p className="section-note" style={{ marginTop: -6 }}>
          下列「无变化 / 发现更新 / 同步失败」是<strong>最近一次</strong>同步的结果；「待确认」是累计未处理条数。
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
              {overallStatus}
            </span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">可检查来源</span>
            <span className="stat-value">{dueCount}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">无变化</span>
            <span className="stat-value">{unchanged}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">发现更新</span>
            <span className="stat-value">{changed}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">同步失败</span>
            <span className="stat-value">{failed}</span>
          </div>
        </div>

        <p className={`intel-item${isPeakSeason() ? " is-important" : ""}`} style={{ marginBottom: 12 }}>
          {seasonNote()}
        </p>

        <div className="res-actions">
          <button type="button" className="primary-btn" disabled={busy !== null} onClick={() => runCheck("CHECK")}>
            {busy === "CHECK" ? "检查中…" : "立即检查更新"}
          </button>
          <button type="button" className="ghost-btn" disabled={busy !== null} onClick={() => runCheck("ALL")}>
            {busy === "ALL" ? "同步中…" : "同步全部"}
          </button>
          <button type="button" className="ghost-btn" onClick={() => setShowLog((v) => !v)}>
            {showLog ? "收起更新记录" : `查看更新记录（${store.updateLog.length}）`}
          </button>
          <label className="kp-check" style={{ marginTop: 0 }}>
            <input
              type="checkbox"
              checked={!!autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
            />
            打开页面时自动检查（本地应用没有后台定时器，用「到期即检查」代替每日/每周任务）
          </label>
        </div>

        {msg && (
          <p className="backup-status" style={{ whiteSpace: "pre-wrap" }}>
            {msg}
          </p>
        )}

        <p className="hint">
          说明：浏览器直连官网会被 CORS 拦截，因此同步走「前端 → /api/sync（本地 Node 服务）→ 官网」。
          学院官网有安全策略时抓取会失败，失败只会记录状态，旧数据继续使用。
        </p>
      </section>

      <section className="card" aria-label="待确认更新">
        <div className="section-head-row">
          <h3 className="section-title">待确认更新（{pending.length}）</h3>
          <span className="hint">涉及考试科目 / 招生人数 / 专业代码 / 学制 / 复试线等敏感字段时，必须人工确认</span>
        </div>
        {pending.length === 0 ? (
          <p className="empty-note">
            没有待确认项。点「立即检查更新」会去官网检查；想先看流程可以点下面的「模拟检测（演示）」。
          </p>
        ) : (
          <ul className="intel-list">
            {pending.map((e) => {
              const guard = canConfirm(store, e);
              return (
                <li key={e.id} className={`intel-item${SEV_CLASS[e.severity]}`}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="q-head">
                      <span className="badge is-review">{e.severity === "CRITICAL" ? "重要变化" : "待确认"}</span>
                      <strong>{e.title}</strong>
                      <span className="intel-time">{fmt(e.at)}</span>
                    </div>
                    {e.category && <div className="hint">{RESOURCE_CATEGORY_LABEL[e.category]}</div>}
                    <ul className="log-changes">
                      {e.changes.map((c, i) => (
                        <li key={i}>· {c}</li>
                      ))}
                    </ul>
                    {e.detail && <p className="hint">{e.detail}</p>}
                    {e.sourceUrl && (
                      <p className="hint">
                        来源：{" "}
                        <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {e.sourceUrl.slice(0, 60)}
                        </a>
                      </p>
                    )}
                    {!guard.allowed && <p className="hint warn-line">🔒 {guard.reason}</p>}
                    <div className="res-actions" style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="primary-btn"
                        disabled={!guard.allowed}
                        onClick={() => {
                          if (
                            window.confirm(
                              `确认更新「${e.title}」？\n\n确认后该版本会成为「当前有效」，同分类的官方旧版本自动转为「已归档」（历史不会删除）。`,
                            )
                          ) {
                            confirmUpdate(e.id);
                            setMsg("已确认更新，并把该版本设为当前有效；旧版本已归档（数据保留）。");
                          }
                        }}
                      >
                        确认更新
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => {
                          if (window.confirm("忽略这条更新？当前正式信息保持不变，记录会留痕。")) {
                            rejectUpdate(e.id);
                            setMsg("已忽略该更新，当前正式信息未改变。");
                          }
                        }}
                      >
                        忽略
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card" aria-label="模拟检测">
        <div className="section-head-row">
          <h3 className="section-title">模拟检测（演示 / 自测）</h3>
          <span className="hint">不联网，不会写入任何编造的招生数字</span>
        </div>
        <div className="res-actions">
          {SIM_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="ghost-btn"
              disabled={busy !== null}
              title={s.hint}
              onClick={() => runSim(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="hint">
          四个场景分别验证：年度目录开放（可确认）· 内容变化（建新版本待确认）· 第三方传闻（确认被阻止，
          官方信息不被覆盖）· 抓取失败（保留旧数据）。
        </p>
      </section>

      {showLog && (
        <section className="card" aria-label="更新日志">
          <h3 className="section-title">更新日志（最近 {Math.min(store.updateLog.length, 60)} 条）</h3>
          {store.updateLog.length === 0 ? (
            <p className="empty-note">还没有任何同步记录。</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>学校 / 专业</th>
                    <th>资料</th>
                    <th>版本</th>
                    <th>变化类型</th>
                    <th>来源</th>
                    <th>确认状态</th>
                  </tr>
                </thead>
                <tbody>
                  {[...store.updateLog]
                    .reverse()
                    .slice(0, 60)
                    .map((e) => (
                      <tr key={e.id}>
                        <td className="num">{fmt(e.at)}</td>
                        <td>
                          {store.schools.find((s) => s.id === e.schoolId)?.name ?? "—"}
                          {e.majorCode ? ` / ${e.majorCode}` : ""}
                        </td>
                        <td>
                          <strong>{e.title}</strong>
                          {e.category && <div className="hint">{RESOURCE_CATEGORY_LABEL[e.category]}</div>}
                          <ul className="log-changes">
                            {e.changes.slice(0, 4).map((c, i) => (
                              <li key={i}>· {c}</li>
                            ))}
                          </ul>
                        </td>
                        <td className="num">
                          {e.oldVersion != null ? `v${e.oldVersion} → ` : ""}
                          {e.newVersion != null ? `v${e.newVersion}` : "—"}
                        </td>
                        <td>
                          {CHANGE_TYPE_LABEL[e.changeType]}
                          <div className="hint">
                            {e.trigger === "SIMULATE" ? "模拟" : e.trigger === "AUTO" ? "自动" : e.trigger === "MANUAL" ? "手动检查" : "手动录入"}
                          </div>
                        </td>
                        <td>
                          {store.sources.find((s) => s.id === e.sourceId)?.sourceName ?? "—"}
                          {e.sourceUrl && (
                            <div className="hint">
                              <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">
                                原始链接
                              </a>
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              e.confirmStatus === "PENDING"
                                ? "is-review"
                                : e.confirmStatus === "CONFIRMED"
                                  ? "is-current"
                                  : "is-draft"
                            }`}
                          >
                            {CONFIRM_STATUS_LABEL[e.confirmStatus]}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="card" aria-label="各来源最近检查结果">
        <h3 className="section-title">各来源最近检查结果</h3>
        {results.length === 0 ? (
          <p className="empty-note">还没有检查记录。</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>来源</th>
                  <th>状态</th>
                  <th>最终域名</th>
                  <th>官方域名一致</th>
                  <th>条目数</th>
                  <th>目录是否开放</th>
                  <th>错误</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.sourceId}>
                    <td>{store.sources.find((s) => s.id === r.sourceId)?.sourceName ?? r.sourceId}</td>
                    <td>
                      <span className={`badge ${r.status === "FAILED" ? "is-review" : "is-current"}`}>
                        {SYNC_STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td>{r.finalDomain ?? "—"}</td>
                    <td>{r.officialDomainOk ? "是" : "⚠ 否"}</td>
                    <td className="num">{r.docCount ?? "—"}</td>
                    <td>{r.notPublished ? "尚未开放" : "已开放 / 不适用"}</td>
                    <td style={{ maxWidth: 260 }}>{r.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
