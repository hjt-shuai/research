"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "./AppStoreProvider";

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function diffParts(target: string, now: number): Parts | null {
  const t = new Date(target).getTime();
  if (Number.isNaN(t)) return null;
  let ms = t - now;
  if (ms < 0) ms = 0;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return { days, hours, minutes, seconds };
}

export default function Countdown() {
  const { store, setExamDate, loaded } = useAppStore();
  const target = store.examDate;
  const [now, setNow] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const parts = now !== null ? diffParts(target, now) : null;
  const dateObj = new Date(target);
  const valid = !Number.isNaN(dateObj.getTime());

  const cells: { label: string; value: number | null }[] = [
    { label: "天", value: parts?.days ?? null },
    { label: "时", value: parts?.hours ?? null },
    { label: "分", value: parts?.minutes ?? null },
    { label: "秒", value: parts?.seconds ?? null },
  ];

  return (
    <section className="card countdown" aria-label="考研倒计时">
      <div className="countdown-head">
        <div>
          <p className="eyebrow">距离预计初试还有</p>
          <p className="countdown-motto">坚持每天，就是最快的路径</p>
        </div>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setEditOpen((o) => !o)}
        >
          修改初试日期
        </button>
      </div>

      <div className="countdown-grid">
        {cells.map((c) => (
          <div className="countdown-cell" key={c.label}>
            <span className="countdown-num">
              {c.value === null ? "--" : String(c.value).padStart(2, "0")}
            </span>
            <span className="countdown-unit">{c.label}</span>
          </div>
        ))}
      </div>

      {editOpen && (
        <label className="date-field countdown-edit">
          <span>备考规划初试日期（预计）</span>
          <input
            type="datetime-local"
            value={target}
            min="2026-01-01T00:00"
            onChange={(e) => {
              // 清空输入时不写入空值，避免倒计时变成空档
              if (e.target.value) setExamDate(e.target.value, true);
            }}
            aria-label="设置初试日期"
          />
        </label>
      )}

      <p className="countdown-foot">
        {store.examDateUserSet && valid ? (
          <>
            预计初试日（备考规划）：{dateObj.getFullYear()} 年{" "}
            {dateObj.getMonth() + 1} 月 {dateObj.getDate()} 日（周
            {WEEK[dateObj.getDay()]}）·{" "}
            {loaded ? "已保存在本机浏览器" : "读取中…"}
          </>
        ) : (
          <>
            预计：2027 年 12 月下旬 ·{" "}
            {loaded ? "已保存在本机浏览器" : "读取中…"}
          </>
        )}
      </p>
      <p className="hint">
        日期为当前备考口径，待官方公布 2028 届初试安排后可在此修改校准。
      </p>
    </section>
  );
}
