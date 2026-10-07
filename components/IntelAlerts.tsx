"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLibrary } from "./useLibrary";
import { TARGET_MAJOR_CODE, TARGET_SCHOOL_ID } from "@/lib/db/types";

type Alert = { level: "INFO" | "IMPORTANT" | "CRITICAL"; text: string; at?: string | null; href?: string };

/**
 * 📢 最新招生情报（§26）
 * 内容全部由真实状态推导：年度档案状态、官方证据、待确认更新、同步失败。
 * 不编造任何未公布的招生信息。
 */
export default function IntelAlerts() {
  const { store } = useLibrary();

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];
    const school = store.schools.find((s) => s.id === TARGET_SCHOOL_ID);
    const major = school?.majorCode || TARGET_MAJOR_CODE;

    // 年度档案状态（2027/2028 尚未发布 = 官方证据）
    for (const year of [2028, 2027]) {
      const row = store.schoolYears.find((y) => y.schoolId === TARGET_SCHOOL_ID && y.year === year);
      if (row && row.status === "PENDING") {
        out.push({
          level: "IMPORTANT",
          text: `${school?.name ?? "电子科技大学"}暂未发布 ${year} 招生目录（${row.evidenceText || "官网显示尚未开放"}），${year} 的考试科目 / 招生人数 / 复试线均待官方公布。`,
          at: row.updatedAt,
          href: row.evidenceUrl || undefined,
        });
      }
    }

    // 已收录的官方资料
    const charter = store.resources.find((r) => r.id === "res-uestc-charter-2026");
    if (charter) {
      out.push({
        level: "INFO",
        text: `已收录 ${charter.year} 年招生章程（发布时间 ${charter.publishedAt ?? "见来源"}）：学校代码 10614、学制 3 年。`,
        at: charter.updatedAt,
        href: charter.sourceUrl,
      });
    }

    if (school?.examSubjects) {
      out.push({
        level: "INFO",
        text: `${major} 当前按「${school.examSubjects}」备考（当前备考口径，招生目录发布后校准）。`,
        href: school.officialLinks[0]?.url,
      });
    }

    out.push({
      level: "INFO",
      text: `预计初试日期：${
        store.examDateUserSet ? "已由我手动设定" : "2027 年 12 月下旬（预计，待官方公布）"
      }，可在首页「修改初试日期」调整。`,
      href: "/",
    });

    // 待确认更新（按严重程度着色）
    const pending = store.updateLog.filter((e) => e.confirmStatus === "PENDING");
    for (const e of pending.slice(-3).reverse()) {
      out.push({
        level: e.severity === "CRITICAL" ? "CRITICAL" : "IMPORTANT",
        text: `${e.title}：${e.changes[0] ?? "检测到变化"}（待你确认，当前正式信息未被覆盖）`,
        at: e.at,
        href: "/updates",
      });
    }

    // 同步失败提醒
    const failed = Object.values(store.syncState.results).filter((r) => r.status === "FAILED");
    for (const f of failed.slice(0, 2)) {
      const src = store.sources.find((s) => s.id === f.sourceId);
      out.push({
        level: "IMPORTANT",
        text: `${src?.sourceName ?? f.sourceId} 最近一次检查失败：${(f.error ?? "未知错误").slice(0, 60)}（已保留上次成功数据）`,
        at: f.checkedAt,
        href: "/updates",
      });
    }

    return out.slice(0, 7);
  }, [store]);

  const cls = (l: Alert["level"]) =>
    l === "CRITICAL" ? "intel-item is-critical" : l === "IMPORTANT" ? "intel-item is-important" : "intel-item";

  return (
    <section className="card" aria-label="最新招生情报">
      <div className="section-head-row">
        <h2 className="section-title">📢 最新招生情报</h2>
        <Link className="text-link" href="/updates">
          更新中心 →
        </Link>
      </div>
      <ul className="intel-list">
        {alerts.map((a, i) => (
          <li key={i} className={cls(a.level)}>
            <span className="badge is-year">
              {a.level === "CRITICAL" ? "重要" : a.level === "IMPORTANT" ? "提醒" : "普通"}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              {a.text}
              {a.href && (
                <>
                  {" "}
                  {a.href.startsWith("/") ? (
                    <Link className="text-link" href={a.href}>
                      查看
                    </Link>
                  ) : (
                    <a className="text-link" href={a.href} target="_blank" rel="noopener noreferrer">
                      官方来源
                    </a>
                  )}
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">
        颜色含义：蓝色＝普通提醒，橙色＝重要变化，红色＝重大变化。所有未来信息均标注「预计 / 待官方确认 / 当前参考」，不构成官方结论。
      </p>
    </section>
  );
}
