"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MAIN_TARGET,
  avg,
  examTotal,
  recentFirst,
  sortByDateAsc,
} from "@/lib/scoring";
import { useAppStore } from "./AppStoreProvider";
import TrendChart from "./TrendChart";

export default function MockCenter() {
  const { store, addMock, removeMock } = useAppStore();
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [politics, setPolitics] = useState("");
  const [english, setEnglish] = useState("");
  const [math, setMath] = useState("");
  const [cs408, setCs408] = useState("");

  const sorted = sortByDateAsc(store.mocks);
  const totals = sorted.map(examTotal);
  const maxTotal = totals.length ? Math.max(...totals) : null;
  const latest = totals.length ? totals[totals.length - 1] : null;
  const avg3 = totals.length ? Math.round(avg(totals.slice(-3))) : null;
  const gap375 = latest != null ? latest - MAIN_TARGET : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number(politics);
    const en = Number(english);
    const ma = Number(math);
    const c = Number(cs408);
    if (!name.trim() || !date) return;
    if ([p, en, ma, c].some((n) => Number.isNaN(n))) return;
    addMock({
      name: name.trim(),
      date,
      politics: p,
      english: en,
      math: ma,
      cs408: c,
    });
    setName("");
    setPolitics("");
    setEnglish("");
    setMath("");
    setCs408("");
  };

  return (
    <div className="sub-page">
      <p className="eyebrow">
        <Link href="/">← 返回首页</Link>
      </p>
      <h1 className="page-title">模考中心</h1>

      <form className="card mock-form" onSubmit={submit}>
        <h2 className="section-title">添加模考</h2>
        <div className="form-grid">
          <label>
            考试名称
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            考试日期
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            政治
            <input type="number" min={0} max={100} value={politics} onChange={(e) => setPolitics(e.target.value)} required />
          </label>
          <label>
            英语
            <input type="number" min={0} max={100} value={english} onChange={(e) => setEnglish(e.target.value)} required />
          </label>
          <label>
            数学
            <input type="number" min={0} max={150} value={math} onChange={(e) => setMath(e.target.value)} required />
          </label>
          <label>
            408
            <input type="number" min={0} max={150} value={cs408} onChange={(e) => setCs408(e.target.value)} required />
          </label>
        </div>
        <button type="submit" className="primary-btn">
          保存记录
        </button>
      </form>

      <section className="card mock-stats">
        <h2 className="section-title">统计</h2>
        <dl className="stats-dl">
          <div><dt>考试次数</dt><dd>{store.mocks.length}</dd></div>
          <div><dt>最高总分</dt><dd>{maxTotal ?? "—"}</dd></div>
          <div><dt>最近一次</dt><dd>{latest ?? "—"}</dd></div>
          <div><dt>近 3 次平均</dt><dd>{avg3 ?? "—"}</dd></div>
          <div><dt>距主目标 375</dt><dd>{gap375 != null ? (gap375 >= 0 ? `+${gap375}` : gap375) : "—"}</dd></div>
        </dl>
      </section>

      {store.mocks.length > 0 && (
        <section className="card">
          <h2 className="section-title">总分趋势</h2>
          <TrendChart mocks={store.mocks} goals={store.goals} />
        </section>
      )}

      <section className="card">
        <h2 className="section-title">历史记录</h2>
        <ul className="mock-history">
          {recentFirst(store.mocks).map((m) => (
            <li key={m.id}>
              <div>
                <strong>{m.name}</strong>
                <span className="hint"> · {m.date}</span>
              </div>
              <div className="mock-history-scores">
                政 {m.politics} / 英 {m.english} / 数 {m.math} / 408 {m.cs408}
                <strong> = {examTotal(m)}</strong>
              </div>
              <button type="button" className="ghost-btn" onClick={() => removeMock(m.id)}>
                删除
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
